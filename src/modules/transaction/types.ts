export type Severity = "low" | "medium" | "high" | "critical";
export type UserIntent =
  | "send"
  | "claim"
  | "swap"
  | "approve"
  | "grant-permissions"
  | "contract-call"
  | "other";

export type TransactionPayload = {
  chainId: number;
  from: string;
  to: string;
  value: string;
  data: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  trusted?: boolean;
  metadata?: {
    source?: string;
    dappName?: string;
    url?: string;
    intent?: UserIntent;
  };
  identityCommitment?: string;
};

export type DecodedAction =
  | {
      kind: "approve";
      spender: string;
      amount: string;
      isUnlimited: boolean;
      tokenSymbol: string;
    }
  | {
      kind: "permit";
      owner?: string;
      spender: string;
      amount?: string;
      deadline?: string;
      tokenSymbol: string;
    }
  | {
      kind: "multicall";
      target: string;
      innerCalls: number;
      selector: string;
      /** Recursively decoded inner actions when decoding succeeds */
      innerActions?: DecodedAction[];
    }
  | {
      kind: "transfer";
      recipient: string;
      amount: string;
      tokenSymbol: string;
    }
  | {
      kind: "native-transfer";
      recipient: string;
      amount: string;
      tokenSymbol: string;
    }
  | {
      kind: "contract-call";
      method?: string;
      selector: string;
      target: string;
    };

export type SimulationEffect = {
  label: string;
  from: string;
  to: string;
  asset: string;
  amount: string;
  direction: "out" | "in" | "approval";
};

export type ChainContext = {
  blockNumber?: number;
  codePresent: boolean;
  transactionCount?: number;
  estimateGas?: string;
  gasInsight?: "estimated" | "fallback" | "unavailable";
  callOutcome: "success" | "revert" | "unknown";
  source: "rpc" | "heuristic";
  simulationMode: "rpc-estimate" | "heuristic";
};

export type ReputationContext = {
  destinationLabel: "allow" | "unknown" | "deny";
  confidence: number;
  contractAgeBlocks?: number;
  hasVerifiedCodeHint: boolean;
  userNovelty: "known" | "new";
  walletInteractionCount: number;
  recentSimilarTransactions: number;
  domainRisk: "trusted" | "unknown" | "suspicious";
};

export type RiskFinding = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  action: string;
};

export type ComplianceAttestation = {
  attestationId: string;
  nullifier: string;
  policy: string;
  createdAt: string;
  persistent: boolean;
};

export type AnalysisResult = {
  summary: string;
  verdict: string;
  score: number;
  confidence: number;
  severity: Severity;
  decoded: DecodedAction;
  effects: SimulationEffect[];
  findings: RiskFinding[];
  reasons: string[];
  intent: {
    declared?: UserIntent;
    inferred: string;
    matches: boolean;
    explanation: string;
    source?: "user" | "google-ai" | "none";
    confidence?: number;
  };
  simulation: {
    mode: "heuristic" | "rpc-estimate" | "rpc-trace" | "tenderly";
    supportsNestedCalls: boolean;
    limitations: string[];
  };
  intelligence: {
    sourceCount: number;
    matchedSignals: string[];
    hasBlocklistMatch: boolean;
    hasDomainRisk: boolean;
  };
  chainContext: ChainContext;
  reputation: ReputationContext;
  attestation: {
    accepted: boolean;
    record: ComplianceAttestation;
  };
  zkContext?: {
    merkleRoot: string;
    merklePath: string[];
    merkleIndices: number[];
  };
  signingPolicy: {
    allowed: boolean;
    mode: "allow" | "warn" | "block";
    reason: string;
    signer: "external-wallet" | "policy-blocked";
  };
  resultIntegrity: {
    signature: string;
    algorithm: "ml-dsa-65";
    verifier: "sentinel-node-pqc";
    publicDigest: string;
    verificationId: string;
  };
  telemetry: {
    usedGoogleAI: boolean;
    liveRpc: boolean;
    cached: boolean;
    feedbackCount: number;
    authMode: "wallet-signature";
    rateLimitMode: "memory" | "redis" | "postgres";
  };
};
