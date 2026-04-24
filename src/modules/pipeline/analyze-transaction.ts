import { createHash } from "crypto";

import { decodeTransaction } from "@/src/modules/blockchain/decoder";
import { getChainContext } from "@/src/modules/blockchain/provider";
import { explainTransaction } from "@/src/modules/ai/explainer";
import { inferUserIntent } from "@/src/modules/ai/intent-inference";
import { readCache, writeCache } from "@/src/modules/cache/redis";
import { getFeedbackCount, recordAnalysis } from "@/src/modules/database/repository";
import { logEvent, logError, logDebug } from "@/src/modules/observability/logger";
import { getReputationContext, reputationFindings } from "@/src/modules/reputation/service";
import { evaluateRisk } from "@/src/modules/risk/engine";
import { signAnalysisResult } from "@/src/modules/security/integrity";
import { buildSigningPreview } from "@/src/modules/signing/service";
import { simulateTransaction } from "@/src/modules/simulation/service";
import { getAddressThreatIntel } from "@/src/modules/threat-intel/goplus";
import { transactionPayloadSchema } from "@/src/modules/transaction/schema";
import type { AnalysisResult, RiskFinding, TransactionPayload } from "@/src/modules/transaction/types";
import { insertLeaf, getMerklePath } from "@/src/modules/zk/merkle";
import { recordComplianceAttestation } from "@/src/modules/zk/service";

function cacheKey(payload: TransactionPayload, blockNumber?: number) {
  return createHash("sha256")
    .update(JSON.stringify({ payload, blockNumber: blockNumber ?? "heuristic" }))
    .digest("hex");
}

function buildSimulationSummary(source: "tenderly" | "rpc-trace" | "heuristic") {
  const limitations =
    source === "tenderly"
      ? [
          "Tenderly simulation provides high-fidelity EVM trace but does not guarantee on-chain outcome.",
          "State can change between simulation and actual signing.",
        ]
      : source === "rpc-trace"
        ? [
            "RPC trace provides internal call and transfer visibility but may miss complex DeFi interactions.",
            "Not all RPC providers support debug_traceCall.",
            "State can change between analysis and signing.",
          ]
        : [
            "Preflight is advisory and does not execute a full EVM state transition.",
            "Nested multicall and flash-loan semantics still require a dedicated simulator.",
            "State can change between analysis and signing.",
          ];

  return {
    mode: source as "heuristic" | "rpc-estimate" | "rpc-trace" | "tenderly",
    supportsNestedCalls: source === "tenderly",
    limitations,
  };
}

export async function analyzeTransaction(
  rawPayload: unknown,
  actorAddress?: string
): Promise<AnalysisResult> {
  const payload = transactionPayloadSchema.parse(rawPayload);
  const chainContext = await getChainContext(payload);
  const reputation = await getReputationContext(payload);
  const key = cacheKey(payload, chainContext.blockNumber);
  const cached = await readCache(key);

  if (cached) {
    logDebug("pipeline.cache_hit", { key: key.slice(0, 12) });
    const parsed = JSON.parse(cached) as AnalysisResult;
    const attestation = await recordComplianceAttestation(payload, parsed.severity);
    const signingPolicy = buildSigningPreview(payload, parsed.severity);
    return {
      ...parsed,
      attestation,
      signingPolicy,
      telemetry: {
        ...parsed.telemetry,
        cached: true,
        liveRpc: chainContext.source === "rpc",
        feedbackCount: await getFeedbackCount(),
        authMode: "wallet-signature",
        rateLimitMode: "memory",
      },
    } as AnalysisResult;
  }

  const decoded = decodeTransaction(payload);
  const intentInference = await inferUserIntent(payload, decoded);
  const shouldApplyInferredIntent =
    (!payload.metadata?.intent || payload.metadata.intent === "other") &&
    !!intentInference.intent &&
    intentInference.confidence >= 0.65;
  const effectivePayload = shouldApplyInferredIntent
    ? {
        ...payload,
        metadata: {
          ...payload.metadata,
          intent: intentInference.intent,
        },
      }
    : payload;
  const simulation = await simulateTransaction(payload, decoded);

  // Real threat intelligence from GoPlus API
  let threatIntelFindings: RiskFinding[] = [];
  let threatIntelScore = 0;
  try {
    const threatIntel = await getAddressThreatIntel(payload.to, payload.chainId);
    threatIntelScore = threatIntel.riskScore;
    threatIntelFindings = threatIntel.findings.map((finding, i) => ({
      id: `goplus-${i}`,
      title: finding.replace("GoPlus: ", ""),
      description: `Real-time threat intelligence from GoPlus Security API (${threatIntel.source}).`,
      severity:
        threatIntel.riskScore >= 0.8
          ? ("critical" as const)
          : threatIntel.riskScore >= 0.5
            ? ("high" as const)
            : ("medium" as const),
      action: threatIntel.riskScore >= 0.8 ? "Block signing immediately." : "Review with caution.",
    }));
  } catch (e) {
    logError("pipeline.goplus_failed", e, { address: payload.to });
  }

  const risk = evaluateRisk(effectivePayload, decoded, simulation.effects, {
    chainReverted: chainContext.callOutcome === "revert",
    newDestination: reputation.userNovelty === "new",
    repeatedSimilarTransactions: reputation.recentSimilarTransactions,
  });
  const combinedFindings = [...risk.findings, ...reputationFindings(reputation), ...threatIntelFindings];
  const recalculatedScore = Math.min(
    1,
    Math.max(
      risk.score,
      threatIntelScore,
      reputation.destinationLabel === "deny" ? 0.95 : reputation.userNovelty === "new" ? 0.55 : 0.1,
      reputation.domainRisk === "suspicious" ? 0.82 : 0.1,
      chainContext.callOutcome === "revert" ? 0.65 : 0.1
    )
  );
  const severity =
    recalculatedScore >= 0.9
      ? "critical"
      : recalculatedScore >= 0.7
        ? "high"
        : recalculatedScore >= 0.45
          ? "medium"
          : "low";
  const verdict =
    severity === "critical"
      ? "Drain risk detected"
      : severity === "high"
        ? "Suspicious transaction"
        : severity === "medium"
          ? "Review required"
          : "Appears low risk";
  const attestation = await recordComplianceAttestation(payload, severity);
  const signingPolicy = buildSigningPreview(payload, severity);
  const explanation = await explainTransaction({
    payload,
    decoded,
    effects: simulation.effects,
    findings: combinedFindings,
    severity,
  });

  let zkContext: AnalysisResult["zkContext"];
  if (payload.identityCommitment && (severity === "low" || severity === "medium" || severity === "high")) {
    try {
      const commitmentBigInt = BigInt(payload.identityCommitment);
      const leafIndex = await insertLeaf(commitmentBigInt);
      const merkle = await getMerklePath(leafIndex);
      zkContext = {
        merkleRoot: String(merkle.root),
        merklePath: merkle.path.map(String),
        merkleIndices: merkle.indices,
      };
    } catch (e) {
      logError("pipeline.zk_merkle_failed", e);
    }
  }

  const unsignedResult: Omit<AnalysisResult, "resultIntegrity"> = {
    summary: explanation.summary,
    verdict,
    score: recalculatedScore,
    confidence: Math.max(risk.confidence, reputation.confidence),
    severity,
    decoded,
    effects: simulation.effects,
    findings: combinedFindings,
    reasons: [
      ...risk.reasons,
      chainContext.callOutcome === "revert" ? "RPC preflight indicates possible execution failure." : "",
      reputation.domainRisk === "suspicious" ? "The supplied dapp origin appears suspicious." : "",
      shouldApplyInferredIntent ? intentInference.explanation : "",
    ].filter(Boolean),
    intent: {
      ...risk.intent,
      declared: effectivePayload.metadata?.intent,
      source: shouldApplyInferredIntent ? "google-ai" : effectivePayload.metadata?.intent ? "user" : "none",
      confidence: shouldApplyInferredIntent ? intentInference.confidence : undefined,
      explanation: shouldApplyInferredIntent
        ? `${intentInference.explanation} ${risk.intent.explanation}`
        : risk.intent.explanation,
    },
    simulation: buildSimulationSummary(simulation.simulationSource),
    intelligence: {
      sourceCount: 4,
      matchedSignals: combinedFindings.map((finding) => finding.id),
      hasBlocklistMatch: reputation.destinationLabel === "deny",
      hasDomainRisk: reputation.domainRisk === "suspicious",
    },
    chainContext,
    reputation,
    attestation,
    zkContext,
    signingPolicy,
    telemetry: {
      usedGoogleAI: explanation.usedGoogleAI || intentInference.usedGoogleAI,
      liveRpc: chainContext.source === "rpc",
      cached: false,
      feedbackCount: await getFeedbackCount(),
      authMode: "wallet-signature",
      rateLimitMode: "memory",
    },
  };

  const result: AnalysisResult = {
    ...unsignedResult,
    resultIntegrity: signAnalysisResult(unsignedResult),
  };

  await writeCache(key, JSON.stringify(result));
  await recordAnalysis(payload, result, actorAddress);
  logEvent("analysis.completed", {
    actorAddress: actorAddress ?? "anonymous",
    severity: result.severity,
    verdict: result.verdict,
    simulationSource: simulation.simulationSource,
    cached: false,
  });

  return result;
}
