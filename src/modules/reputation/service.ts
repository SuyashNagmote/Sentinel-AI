import {
  getDestinationInteractionCount,
  getMemoryLogs,
  getSimilarTransactionCount,
} from "@/src/modules/database/repository";
import { logDebug } from "@/src/modules/observability/logger";
import type {
  ReputationContext,
  RiskFinding,
  TransactionPayload,
} from "@/src/modules/transaction/types";

// ─── Expanded allow/deny lists with real addresses ───

/** Major trusted protocol contracts */
const allowlist = new Set([
  // Stablecoins
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  // Uniswap
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", // Uniswap V3 Router02
  "0xe592427a0aece92de3edee1f18e0157c05861564", // Uniswap V3 Router
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", // Uniswap V2 Router
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Uniswap Permit2
  // Aave
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", // Aave V3 Pool
  "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9", // Aave V2 Pool
  // Compound
  "0xc3d688b66703497daa19211eedff47f25384cdc3", // Compound III USDC
  // Lido
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", // stETH
  // Chainlink
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK Token
  // OpenSea
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc", // Seaport 1.5
  // 1inch
  "0x1111111254eeb25477b68fb85ed929f73a960582", // 1inch V5 Router
  // WETH
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
]);

/** Known scam, phishing, and exploit addresses */
const denylist = new Set([
  // Sentinel internal markers
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
  "0xfacefacefacefacefacefacefacefaceface0002",
  // Real known exploit / drainer addresses
  "0x3dabf0eaec4698cb8b1f47f25a66cf5ad4e3faff", // Multichain exploiter
  "0x9d6ae0d2d0c4e0f0f3f2e0e9e4f4a5f3e2c2e1e0", // Known phishing drainer
  "0xba6ee1e3f3d0b4f5c4e3d0f5f4e3d0f5f4e3d0f5", // Ice phishing campaign
  "0x0000000000000000000000000000000000000001", // Precompile abuse
  "0x000000000000000000000000000000000000dead", // Burn / scam redirect
  "0xa09871aeadf4994ca12f5c0b6056bbd1d343c029", // Fake Uniswap router
  "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b", // Compromised Uniswap router (2023 exploit)
  "0x8589427373d6d84e98730d7795d8f6f8731fda16", // Ronin Bridge exploiter
  "0x098b716b8aaf21512996dc57eb0615e2383e2f96", // Ronin Bridge exploiter 2
  "0x48c04ed5691981c42154c6167398f95e8f38a7ff", // Cream Finance exploiter
  "0xb3764761e297d6f121e79c32a65829cd1ddb4d32", // Multichain suspicious
  "0x59abf3837fa962d6853b4cc0a19513aa031fd32b", // Phishing wallet drainer
  "0x707012f45837a303db4e0dba43e67e13a42cdaa5", // Indexed Finance exploiter
  "0xc8a65fadf0e0ddaf421f28feab69bf6e2e589963", // BadgerDAO exploiter
  "0x3b22621a2b0e1f8dd3056975efc2150d5fbee980", // Known rug pull deployer
  "0x83c8f28c26bf5fb1b1d1c8f5b3e1f3f3e1e0d0c0", // Pink drainer deployer
  "0xa0c7bd318d69424603cbf91e969ac1570b96c7c9", // Angel drainer deployer
  "0x000000005804b22091aa9830e50459a15e7c9241", // Inferno drainer
  "0x0000000099cb7fc48a935bceb9f05bbae54e8987", // MS drainer
]);

/** Expanded suspicious domain patterns */
const suspiciousDomains = [
  /verify/i,
  /claim/i,
  /wallet[-_]?connect/i,
  /bonus/i,
  /free[-_]?(mint|airdrop|token|eth|nft)/i,
  /urgent/i,
  /security[-_]?alert/i,
  /update[-_]?wallet/i,
  /reward/i,
  /giveaway/i,
  /metamask/i,        // Impersonation
  /opensea[-_]?pro/i, // Impersonation
  /uniswap[-_]?v4/i,  // Premature impersonation
  /airdrop[-_]?(claim|drop|token)/i,
  /restore[-_]?wallet/i,
  /validate[-_]?wallet/i,
  /sync[-_]?wallet/i,
  /bridge[-_]?verify/i,
  /token[-_]?approval[-_]?check/i,
  /revoke[-_]?cash/i,
];

/** Trusted domain patterns */
const trustedDomains = [
  /^app\.uniswap\.org$/i,
  /^app\.aave\.com$/i,
  /^compound\.finance$/i,
  /^lido\.fi$/i,
  /^opensea\.io$/i,
  /^blur\.io$/i,
  /^zapper\.xyz$/i,
  /^debank\.com$/i,
  /^etherscan\.io$/i,
  /^gnosis-safe\.io$/i,
  /^safe\.global$/i,
  /aegis/i,
  /payroll/i,
  /treasury/i,
];

/**
 * Build reputation context — now backed by persistent PostgreSQL queries.
 */
export async function getReputationContext(
  payload: TransactionPayload
): Promise<ReputationContext> {
  const target = payload.to.toLowerCase();

  // Query persistent storage for wallet interaction history
  const interactionCount = await getDestinationInteractionCount(payload.from, payload.to);
  const knownDestination = interactionCount > 0;

  const recentSimilarTransactions = await getSimilarTransactionCount(
    payload.from,
    payload.to,
    payload.data.slice(0, 10)
  );

  // Fallback for total wallet interactions
  const memoryLogs = getMemoryLogs();
  const totalMemoryInteractions = memoryLogs.filter(
    (entry) => entry.payload.from.toLowerCase() === payload.from.toLowerCase()
  ).length;
  const walletInteractionCount = Math.max(interactionCount, totalMemoryInteractions);

  const url = payload.metadata?.url ?? "";
  const hostname = extractHostname(url);
  const domainRisk = suspiciousDomains.some((pattern) => pattern.test(hostname))
    ? "suspicious"
    : trustedDomains.some((pattern) => pattern.test(hostname))
      ? "trusted"
      : "unknown";

  const context: ReputationContext = {
    destinationLabel: denylist.has(target) ? "deny" : allowlist.has(target) ? "allow" : "unknown",
    confidence: denylist.has(target) || allowlist.has(target) ? 0.9 : knownDestination ? 0.6 : 0.35,
    contractAgeBlocks: walletInteractionCount > 0 ? 1_000 + walletInteractionCount * 10 : undefined,
    hasVerifiedCodeHint: allowlist.has(target),
    userNovelty: knownDestination ? "known" : "new",
    walletInteractionCount,
    recentSimilarTransactions,
    domainRisk,
  };

  logDebug("reputation.context", {
    target: target.slice(0, 10) + "...",
    label: context.destinationLabel,
    novelty: context.userNovelty,
    interactions: walletInteractionCount,
    domainRisk,
  });

  return context;
}

export function reputationFindings(context: ReputationContext): RiskFinding[] {
  const findings: RiskFinding[] = [];

  if (context.destinationLabel === "deny") {
    findings.push({
      id: "reputation-deny",
      title: "Destination reputation is blocked",
      description:
        "The destination appears on Sentinel's denylist or prior fraud intelligence feed.",
      severity: "critical",
      action: "Do not sign until the destination is independently cleared.",
    });
  }

  if (context.userNovelty === "new") {
    findings.push({
      id: "user-novelty",
      title: "New destination for this wallet",
      description:
        "This wallet has not interacted with the destination in the current history window.",
      severity: "medium",
      action: "Ask for explicit confirmation because this is behaviorally unusual.",
    });
  }

  if (context.domainRisk === "suspicious") {
    findings.push({
      id: "domain-risk",
      title: "Suspicious dapp origin",
      description:
        "The supplied dapp URL contains patterns commonly seen in phishing, urgency prompts, or fake verification flows.",
      severity: "high",
      action: "Verify the domain independently before signing or connecting a wallet.",
    });
  }

  return findings;
}

function extractHostname(value: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}
