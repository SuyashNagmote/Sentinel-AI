import type {
  DecodedAction,
  RiskFinding,
  Severity,
  SimulationEffect,
  TransactionPayload,
  UserIntent,
} from "@/src/modules/transaction/types";

/** Expanded suspicious contract addresses — known drainer deployers and exploit contracts */
const suspiciousContracts = new Set([
  // Sentinel markers
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
  "0xfacefacefacefacefacefacefacefaceface0002",
  // Real known exploit addresses
  "0x3dabf0eaec4698cb8b1f47f25a66cf5ad4e3faff",
  "0xa09871aeadf4994ca12f5c0b6056bbd1d343c029",
  "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b",
  "0x8589427373d6d84e98730d7795d8f6f8731fda16",
  "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
  "0x48c04ed5691981c42154c6167398f95e8f38a7ff",
  "0xb3764761e297d6f121e79c32a65829cd1ddb4d32",
  "0x59abf3837fa962d6853b4cc0a19513aa031fd32b",
  "0x707012f45837a303db4e0dba43e67e13a42cdaa5",
  "0xc8a65fadf0e0ddaf421f28feab69bf6e2e589963",
  "0x3b22621a2b0e1f8dd3056975efc2150d5fbee980",
  "0x000000005804b22091aa9830e50459a15e7c9241", // Inferno drainer
  "0x0000000099cb7fc48a935bceb9f05bbae54e8987", // MS drainer
  "0xa0c7bd318d69424603cbf91e969ac1570b96c7c9", // Angel drainer
  "0x0000000000000000000000000000000000000001", // Precompile abuse
  "0x000000000000000000000000000000000000dead", // Burn redirect
]);

const riskySources = [
  /airdrop/i,
  /verify/i,
  /urgent/i,
  /claim/i,
  /free[-_]?(mint|token|eth|nft)/i,
  /security[-_]?alert/i,
  /wallet[-_]?(sync|restore|update)/i,
  /giveaway/i,
  /bonus/i,
];

const replaySelectors = new Set(["0xd505accf", "0x4c8fe526", "0x2b67b570"]);
const sensitiveMethods = new Set([
  "permit2",
  "multicall",
  "approve",
  "permit",
  "increaseAllowance",
  "setApprovalForAll",
  "permit2.permit",
  "permit2.permitBatch",
]);

const intentMap: Record<UserIntent, string[]> = {
  send: ["transfer", "native-transfer"],
  claim: ["transfer", "native-transfer"],
  swap: ["multicall", "contract-call", "transfer", "approve"],
  approve: ["approve", "permit", "grant-permissions"],
  "grant-permissions": ["approve", "permit"],
  "contract-call": ["contract-call", "multicall"],
  other: ["contract-call", "multicall", "transfer", "native-transfer", "approve", "permit"],
};

function rank(severity: Severity) {
  return {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 0.95,
  }[severity];
}

export function evaluateRisk(
  payload: TransactionPayload,
  decoded: DecodedAction,
  effects: SimulationEffect[],
  options?: {
    chainReverted?: boolean;
    newDestination?: boolean;
    repeatedSimilarTransactions?: number;
  }
): {
  findings: RiskFinding[];
  score: number;
  severity: Severity;
  verdict: string;
  confidence: number;
  reasons: string[];
  intent: {
    declared?: UserIntent;
    inferred: string;
    matches: boolean;
    explanation: string;
  };
} {
  const findings: RiskFinding[] = [];
  const reasons: string[] = [];
  const inferredIntent =
    decoded.kind === "approve" || decoded.kind === "permit"
      ? "grant-permissions"
      : decoded.kind === "transfer" || decoded.kind === "native-transfer"
        ? "send"
        : decoded.kind === "multicall"
          ? "swap-or-batched-call"
          : "contract-call";
  const declaredIntent = payload.metadata?.intent;
  const matchesIntent = !declaredIntent || intentMap[declaredIntent]?.includes(decoded.kind) || false;

  // ─── Unlimited approval ───
  if (decoded.kind === "approve" && decoded.isUnlimited) {
    findings.push({
      id: "unlimited-approval",
      title: "Unlimited token approval",
      description:
        "This signature would allow the spender to move all approved tokens later without asking again.",
      severity: "critical",
      action: "Block by default unless this spender is audited and expected.",
    });
    reasons.push("Unlimited approval can grant long-lived control over wallet assets.");
  }

  // ─── Permit signature ───
  if (decoded.kind === "permit") {
    findings.push({
      id: "permit-signature",
      title: "Off-chain approval signature",
      description:
        "This action uses permit-style signing, which can grant token spending rights without an on-chain approval transaction.",
      severity: "high",
      action: "Only sign permit payloads from verified apps with clear business intent.",
    });
    reasons.push("Permit signatures can be abused because users often mistake them for harmless logins.");
  }

  // ─── Multicall with hidden approvals ───
  if (decoded.kind === "multicall") {
    const hiddenApprovals =
      decoded.innerActions?.filter((a) => a.kind === "approve" || a.kind === "permit") ?? [];

    if (hiddenApprovals.length > 0) {
      findings.push({
        id: "hidden-approval-in-multicall",
        title: `Hidden ${hiddenApprovals.length > 1 ? "approvals" : "approval"} inside batched call`,
        description: `${hiddenApprovals.length} approval/permit operation(s) found nested inside a multicall. This is a common drainer technique to hide token spending rights inside legitimate-looking batches.`,
        severity: "critical",
        action: "Block signing — hidden approvals in multicalls are a high-confidence drain pattern.",
      });
      reasons.push("Hidden approvals inside multicalls are a primary drainer attack vector.");
    } else {
      findings.push({
        id: "batched-execution",
        title: "Batched or nested contract execution",
        description:
          "The transaction bundles multiple inner calls, which is a common structure for advanced drains and hidden approval flows.",
        severity: "high",
        action: "Expand every inner call or block if the batch cannot be decoded safely.",
      });
      reasons.push("Nested call batches reduce transparency and make phishing payloads harder to inspect.");
    }
  }

  // ─── High value native transfer ───
  if (decoded.kind === "native-transfer" && Number(decoded.amount) >= 1) {
    findings.push({
      id: "high-value-native-transfer",
      title: "High value native asset transfer",
      description:
        "The transaction directly sends a meaningful amount of native currency out of the wallet.",
      severity: "high",
      action: "Verify the recipient and business intent before proceeding.",
    });
    reasons.push("Large native transfers are irreversible and should match a clear user action.");
  }

  // ─── Untrusted context ───
  if (!payload.trusted) {
    findings.push({
      id: "untrusted-context",
      title: "Untrusted contract context",
      description:
        "The destination is not marked as trusted, so this request should be treated as potentially hostile.",
      severity: "high",
      action: "Ask for additional verification or route through a policy engine.",
    });
    reasons.push("The transaction comes from an untrusted context.");
  }

  // ─── Known suspicious contract ───
  if (suspiciousContracts.has(payload.to.toLowerCase())) {
    findings.push({
      id: "suspicious-contract",
      title: "Known suspicious destination",
      description:
        "The contract matches a denylist entry used by Sentinel's threat intelligence database.",
      severity: "critical",
      action: "Block signing and escalate for review.",
    });
    reasons.push("Destination address matches a known exploit or drainer address.");
  }

  // ─── Phishing language ───
  if (
    riskySources.some((pattern) =>
      pattern.test(`${payload.metadata?.source ?? ""} ${payload.metadata?.dappName ?? ""}`)
    )
  ) {
    findings.push({
      id: "phishing-pattern",
      title: "Phishing-style language detected",
      description:
        "The source metadata contains patterns often used in fake claims, urgency prompts, and wallet verification scams.",
      severity: "medium",
      action: "Cross-check the dapp domain and expected user journey.",
    });
    reasons.push("The dapp metadata contains phishing-style urgency or reward language.");
  }

  // ─── Opaque contract call ───
  if (decoded.kind === "contract-call" && !decoded.method) {
    findings.push({
      id: "opaque-call",
      title: "Opaque contract call",
      description:
        "The calldata could not be resolved into a known safe function, increasing the risk of blind signing.",
      severity: "high",
      action: "Simulate on a trusted engine or require manual review.",
    });
    reasons.push("The call selector is not transparently decoded.");
  }

  // ─── Sensitive method ───
  if (decoded.kind === "contract-call" && decoded.method && sensitiveMethods.has(decoded.method)) {
    findings.push({
      id: "sensitive-method",
      title: "Sensitive contract method detected",
      description: `The selector maps to ${decoded.method}, which often appears in permissioned or batched execution flows.`,
      severity: "high",
      action: "Require explicit confirmation of what this method changes before signing.",
    });
    reasons.push(`Sensitive method ${decoded.method} needs stronger scrutiny.`);
  }

  // ─── Replay-prone selector ───
  if (replaySelectors.has(decoded.kind === "contract-call" ? decoded.selector : "")) {
    findings.push({
      id: "signature-replay-surface",
      title: "Replay-prone signature pathway",
      description:
        "The payload uses a selector associated with delegated approvals that should be checked for expiry, nonce binding, and spender scope.",
      severity: "high",
      action: "Reject signatures without clear expiry, nonce, and spender validation.",
    });
    reasons.push("Delegated signature flows increase replay and misuse risk.");
  }

  // ─── Intent mismatch ───
  if (!matchesIntent && declaredIntent) {
    findings.push({
      id: "intent-mismatch",
      title: "Declared intent does not match decoded action",
      description: `The user flow says "${declaredIntent}" but the transaction decodes as "${inferredIntent}". This mismatch is a common scam pattern.`,
      severity: "critical",
      action: "Block by default and ask the user to confirm what they expected to happen.",
    });
    reasons.push("Intent mismatch is one of the strongest phishing indicators.");
  }

  // ─── New destination ───
  if (options?.newDestination) {
    findings.push({
      id: "new-destination",
      title: "First-time destination for this wallet",
      description:
        "This wallet has little or no prior history with the destination, which raises novelty risk.",
      severity: "medium",
      action: "Ask for confirmation because the counterparty is behaviorally new.",
    });
    reasons.push("The destination is new for this wallet.");
  }

  // ─── Burst pattern ───
  if ((options?.repeatedSimilarTransactions ?? 0) >= 3) {
    findings.push({
      id: "burst-pattern",
      title: "Repeated similar transaction burst",
      description:
        "The wallet has generated several near-identical transactions recently, which can indicate automation, retries, or attack loops.",
      severity: "medium",
      action: "Throttle signing and review why the same call is repeating.",
    });
    reasons.push("Bursting similar transactions may indicate a compromised flow.");
  }

  // ─── Revert on simulation ───
  if (options?.chainReverted) {
    findings.push({
      id: "revert-on-simulation",
      title: "Execution reverted during preflight",
      description:
        "RPC preflight indicates the call may revert, which can mean stale state, malformed calldata, or hidden control flow.",
      severity: "medium",
      action: "Do not sign until the revert reason and current chain state are understood.",
    });
    reasons.push("Preflight execution did not complete cleanly.");
  }

  // ─── Normal outflow (no issues found) ───
  if (effects.some((effect) => effect.direction === "out") && findings.length === 0) {
    findings.push({
      id: "normal-outflow",
      title: "Expected outbound movement",
      description:
        "Assets leave the wallet as part of the transaction, but no malicious pattern was detected.",
      severity: "low",
      action: "Proceed if the amount and recipient match user intent.",
    });
  }

  const score = Math.min(
    1,
    findings.reduce((max, finding) => Math.max(max, rank(finding.severity)), 0.08) +
      Math.min(0.18, findings.length * 0.03)
  );

  const severity =
    score >= 0.9 ? "critical" : score >= 0.7 ? "high" : score >= 0.45 ? "medium" : "low";

  const verdict =
    severity === "critical"
      ? "Do not sign"
      : severity === "high"
        ? "High-risk transaction"
        : severity === "medium"
          ? "Review before signing"
          : "Low-risk but verify";

  const confidence = Math.min(
    0.98,
    0.52 +
      findings.length * 0.08 +
      (matchesIntent ? 0.04 : 0.14) +
      (payload.trusted ? 0.03 : 0) +
      (options?.chainReverted ? 0.06 : 0)
  );

  return {
    findings,
    score,
    severity,
    verdict,
    confidence,
    reasons: reasons.slice(0, 4),
    intent: {
      declared: declaredIntent,
      inferred: inferredIntent,
      matches: matchesIntent,
      explanation: matchesIntent
        ? "The decoded action is broadly consistent with the declared user goal."
        : "The decoded action conflicts with the user's declared goal, which is a strong phishing signal.",
    },
  };
}
