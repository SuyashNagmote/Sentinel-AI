import { createHash } from "crypto";

import { decodeTransaction } from "@/src/modules/blockchain/decoder";
import { getChainContext } from "@/src/modules/blockchain/provider";
import { explainTransaction } from "@/src/modules/ai/explainer";
import { readCache, writeCache } from "@/src/modules/cache/redis";
import { getFeedbackCount, recordAnalysis } from "@/src/modules/database/repository";
import { logEvent } from "@/src/modules/observability/logger";
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

function buildSimulationSummary(source: "rpc" | "heuristic") {
  return {
    mode: source === "rpc" ? ("rpc-estimate" as const) : ("heuristic" as const),
    supportsNestedCalls: false,
    limitations: [
      "Preflight is advisory and does not execute a full EVM state transition.",
      "Nested multicall and flash-loan semantics still require a dedicated simulator.",
      "State can change between analysis and signing."
    ]
  };
}

export async function analyzeTransaction(
  rawPayload: unknown,
  actorAddress?: string
): Promise<AnalysisResult> {
  const payload = transactionPayloadSchema.parse(rawPayload);
  const chainContext = await getChainContext(payload);
  const reputation = getReputationContext(payload);
  const key = cacheKey(payload, chainContext.blockNumber);
  const cached = await readCache(key);

  if (cached) {
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
        feedbackCount: getFeedbackCount(),
        authMode: "wallet-signature",
        rateLimitMode: "memory"
      }
    } as AnalysisResult;
  }

  const decoded = decodeTransaction(payload);
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
      severity: threatIntel.riskScore >= 0.8 ? "critical" as const : threatIntel.riskScore >= 0.5 ? "high" as const : "medium" as const,
      action: threatIntel.riskScore >= 0.8 ? "Block signing immediately." : "Review with caution."
    }));
  } catch {
    // GoPlus unavailable — continue with heuristic intelligence only
  }

  const risk = evaluateRisk(payload, decoded, simulation.effects, {
    chainReverted: chainContext.callOutcome === "revert",
    newDestination: reputation.userNovelty === "new",
    repeatedSimilarTransactions: reputation.recentSimilarTransactions
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
    severity
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
        merkleIndices: merkle.indices
      };
    } catch (e) {
      console.error("Failed to insert into ZK Merkle tree", e);
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
      reputation.domainRisk === "suspicious" ? "The supplied dapp origin appears suspicious." : ""
    ].filter(Boolean),
    intent: risk.intent,
    simulation: buildSimulationSummary(chainContext.source),
    intelligence: {
      sourceCount: 4,
      matchedSignals: combinedFindings.map((finding) => finding.id),
      hasBlocklistMatch: reputation.destinationLabel === "deny",
      hasDomainRisk: reputation.domainRisk === "suspicious"
    },
    chainContext,
    reputation,
    attestation,
    zkContext,
    signingPolicy,
    telemetry: {
      usedOpenAI: explanation.usedOpenAI,
      liveRpc: chainContext.source === "rpc",
      cached: false,
      feedbackCount: getFeedbackCount(),
      authMode: "wallet-signature",
      rateLimitMode: "memory"
    }
  };

  const result: AnalysisResult = {
    ...unsignedResult,
    resultIntegrity: signAnalysisResult(unsignedResult)
  };

  await writeCache(key, JSON.stringify(result));
  await recordAnalysis(payload, result, actorAddress);
  logEvent("analysis.completed", {
    actorAddress: actorAddress ?? "anonymous",
    severity: result.severity,
    verdict: result.verdict,
    cached: false
  });

  return result;
}
