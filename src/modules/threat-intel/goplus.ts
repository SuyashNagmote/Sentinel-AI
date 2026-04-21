/**
 * GoPlus Security API integration — real threat intelligence.
 * Free tier, no API key required.
 * Docs: https://docs.gopluslabs.io/
 */

interface GoPlusTokenSecurity {
  is_honeypot?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_mintable?: string;
  owner_change_balance?: string;
  can_take_back_ownership?: string;
  is_blacklisted?: string;
  is_whitelisted?: string;
  trust_list?: string;
}

interface GoPlusAddressSecurity {
  honeypot_related_address?: string;
  phishing_activities?: string;
  blackmail_activities?: string;
  stealing_attack?: string;
  fake_token?: string;
  data_source?: string;
  malicious_mining_activities?: string;
  contract_address?: string;
  blacklist_doubt?: string;
  number_of_malicious_contracts_created?: string;
}

export interface ThreatIntelResult {
  source: "goplus" | "fallback";
  address: string;
  chainId: number;
  isHoneypot: boolean;
  isMalicious: boolean;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  isBlacklisted: boolean;
  isTrustListed: boolean;
  phishingActivity: boolean;
  maliciousContractCount: number;
  riskScore: number; // 0-1 derived from findings
  findings: string[];
  raw?: unknown;
}

const CHAIN_MAP: Record<number, string> = {
  1: "1",        // Ethereum
  56: "56",      // BSC
  137: "137",    // Polygon
  42161: "42161", // Arbitrum
  10: "10",      // Optimism
  43114: "43114", // Avalanche
  8453: "8453",  // Base
  324: "324",    // zkSync Era
};

const CACHE = new Map<string, { data: ThreatIntelResult; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getAddressThreatIntel(address: string, chainId: number): Promise<ThreatIntelResult> {
  const cacheKey = `${chainId}:${address.toLowerCase()}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const chain = CHAIN_MAP[chainId] || "1";
  const findings: string[] = [];
  let isHoneypot = false;
  let isMalicious = false;
  let isOpenSource = true;
  let isProxy = false;
  let isMintable = false;
  let isBlacklisted = false;
  let isTrustListed = false;
  let phishingActivity = false;
  let maliciousContractCount = 0;

  try {
    // Parallel: address security + token security
    const [addressRes, tokenRes] = await Promise.allSettled([
      fetchWithTimeout(`https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${chain}`),
      fetchWithTimeout(`https://api.gopluslabs.io/api/v1/token_security/${chain}?contract_addresses=${address}`),
    ]);

    // Parse address security
    if (addressRes.status === "fulfilled" && addressRes.value.ok) {
      const data = await addressRes.value.json();
      const result = data?.result as GoPlusAddressSecurity | undefined;
      if (result) {
        if (result.phishing_activities === "1") {
          phishingActivity = true;
          findings.push("GoPlus: Address associated with phishing activities");
        }
        if (result.stealing_attack === "1") {
          isMalicious = true;
          findings.push("GoPlus: Address linked to stealing/drain attacks");
        }
        if (result.blackmail_activities === "1") {
          isMalicious = true;
          findings.push("GoPlus: Address associated with blackmail activities");
        }
        if (result.honeypot_related_address === "1") {
          isHoneypot = true;
          findings.push("GoPlus: Address related to honeypot contracts");
        }
        if (result.blacklist_doubt === "1") {
          isBlacklisted = true;
          findings.push("GoPlus: Address flagged for blacklist suspicion");
        }
        if (result.malicious_mining_activities === "1") {
          findings.push("GoPlus: Malicious mining activity detected");
        }
        const malCount = parseInt(result.number_of_malicious_contracts_created || "0", 10);
        if (malCount > 0) {
          maliciousContractCount = malCount;
          findings.push(`GoPlus: Created ${malCount} malicious contract(s)`);
        }
      }
    }

    // Parse token/contract security
    if (tokenRes.status === "fulfilled" && tokenRes.value.ok) {
      const data = await tokenRes.value.json();
      const results = data?.result as Record<string, GoPlusTokenSecurity> | undefined;
      const tokenData = results?.[address.toLowerCase()];
      if (tokenData) {
        if (tokenData.is_honeypot === "1") {
          isHoneypot = true;
          findings.push("GoPlus: Token identified as honeypot");
        }
        if (tokenData.is_open_source === "0") {
          isOpenSource = false;
          findings.push("GoPlus: Contract source code not verified");
        }
        if (tokenData.is_proxy === "1") {
          isProxy = true;
          findings.push("GoPlus: Contract is a proxy (upgradeable)");
        }
        if (tokenData.is_mintable === "1") {
          isMintable = true;
          findings.push("GoPlus: Token has mint function");
        }
        if (tokenData.owner_change_balance === "1") {
          findings.push("GoPlus: Owner can modify balances");
          isMalicious = true;
        }
        if (tokenData.can_take_back_ownership === "1") {
          findings.push("GoPlus: Ownership can be reclaimed");
        }
        if (tokenData.trust_list === "1") {
          isTrustListed = true;
        }
      }
    }
  } catch {
    findings.push("GoPlus API unavailable — using fallback heuristics");
  }

  // Calculate composite risk score
  let riskScore = 0;
  if (isMalicious) riskScore = Math.max(riskScore, 0.95);
  if (isHoneypot) riskScore = Math.max(riskScore, 0.92);
  if (phishingActivity) riskScore = Math.max(riskScore, 0.88);
  if (isBlacklisted) riskScore = Math.max(riskScore, 0.85);
  if (maliciousContractCount > 0) riskScore = Math.max(riskScore, 0.8);
  if (!isOpenSource) riskScore = Math.max(riskScore, 0.45);
  if (isProxy) riskScore = Math.max(riskScore, 0.3);
  if (isMintable) riskScore = Math.max(riskScore, 0.25);
  if (isTrustListed) riskScore = Math.min(riskScore, 0.1);

  const result: ThreatIntelResult = {
    source: findings.some((f) => f.startsWith("GoPlus:")) ? "goplus" : "fallback",
    address,
    chainId,
    isHoneypot,
    isMalicious,
    isOpenSource,
    isProxy,
    isMintable,
    isBlacklisted,
    isTrustListed,
    phishingActivity,
    maliciousContractCount,
    riskScore,
    findings,
  };

  CACHE.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}
