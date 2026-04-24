import { logError, logDebug } from "@/src/modules/observability/logger";
import type { AnalysisResult, TransactionPayload } from "@/src/modules/transaction/types";

const MAX_MEMORY_ENTRIES = 1000;
const memoryLog: Array<{ payload: TransactionPayload; result: AnalysisResult; timestamp: number }> = [];
const memoryNullifiers = new Set<string>();
const memoryFeedback: Array<{ actorAddress: string; verdict: string; notes?: string }> = [];

async function getPgModule() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await import("./postgres");
  } catch (e) {
    logError("repository.pg_import_failed", e);
    return null;
  }
}

export async function recordAnalysis(
  payload: TransactionPayload,
  result: AnalysisResult,
  actorAddress?: string,
  cacheKey?: string
) {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      await pgModule.insertAnalysis(
        cacheKey ?? null,
        {
          chainId: payload.chainId,
          from: payload.from,
          to: payload.to,
          selector: payload.data.slice(0, 10),
        },
        { severity: result.severity, verdict: result.verdict, score: result.score, decoded: result.decoded },
        JSON.stringify(result),
        actorAddress
      );
      return;
    } catch (e) {
      logError("repository.record_analysis.pg_failed", e, { severity: result.severity });
      // Fall through to memory
    }
  }

  // Bounded in-memory fallback — evict oldest when full
  if (memoryLog.length >= MAX_MEMORY_ENTRIES) {
    memoryLog.shift();
  }
  memoryLog.push({ payload, result, timestamp: Date.now() });
}

export function getMemoryLogs() {
  return memoryLog;
}

/**
 * Queries wallet interaction history from PostgreSQL or in-memory logs.
 * Used by the reputation service for novelty detection.
 */
export async function getWalletHistory(
  fromAddress: string
): Promise<Array<{ to_address: string; decoded_kind: string | null; created_at: string }>> {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      const { getPool, ensureMigrated } = pgModule;
      await ensureMigrated();
      const pool = getPool();
      const res = await pool.query(
        `SELECT to_address, decoded_kind, created_at FROM analyses 
         WHERE from_address = $1 ORDER BY created_at DESC LIMIT 200`,
        [fromAddress.toLowerCase()]
      );
      return res.rows;
    } catch (e) {
      logError("repository.wallet_history.pg_failed", e, { fromAddress });
    }
  }

  // Fallback to memory logs
  return memoryLog
    .filter((entry) => entry.payload.from.toLowerCase() === fromAddress.toLowerCase())
    .map((entry) => ({
      to_address: entry.payload.to,
      decoded_kind: entry.result.decoded?.kind ?? null,
      created_at: new Date(entry.timestamp).toISOString(),
    }));
}

/**
 * Count interactions with a specific destination from PostgreSQL or memory.
 */
export async function getDestinationInteractionCount(
  fromAddress: string,
  toAddress: string
): Promise<number> {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      const { getPool, ensureMigrated } = pgModule;
      await ensureMigrated();
      const pool = getPool();
      const res = await pool.query(
        `SELECT COUNT(*) as count FROM analyses 
         WHERE from_address = $1 AND to_address = $2`,
        [fromAddress.toLowerCase(), toAddress.toLowerCase()]
      );
      return parseInt(res.rows[0].count, 10);
    } catch (e) {
      logError("repository.destination_count.pg_failed", e, { fromAddress, toAddress });
    }
  }

  return memoryLog.filter(
    (entry) =>
      entry.payload.from.toLowerCase() === fromAddress.toLowerCase() &&
      entry.payload.to.toLowerCase() === toAddress.toLowerCase()
  ).length;
}

/**
 * Count recent similar transactions (same destination + same selector).
 */
export async function getSimilarTransactionCount(
  fromAddress: string,
  toAddress: string,
  selectorPrefix: string
): Promise<number> {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      const { getPool, ensureMigrated } = pgModule;
      await ensureMigrated();
      const pool = getPool();
      const res = await pool.query(
        `SELECT COUNT(*) as count FROM analyses 
         WHERE from_address = $1 AND to_address = $2 
         AND call_selector = $3
         AND created_at > NOW() - INTERVAL '1 hour'`,
        [fromAddress.toLowerCase(), toAddress.toLowerCase(), selectorPrefix]
      );
      return parseInt(res.rows[0].count, 10);
    } catch (e) {
      logError("repository.similar_tx_count.pg_failed", e, { fromAddress, toAddress });
    }
  }

  return memoryLog.filter(
    (entry) =>
      entry.payload.from.toLowerCase() === fromAddress.toLowerCase() &&
      entry.payload.to.toLowerCase() === toAddress.toLowerCase() &&
      entry.payload.data.slice(0, 10) === selectorPrefix
  ).length;
}

export async function consumeNullifier(
  nullifier: string,
  payload?: TransactionPayload,
  severity?: AnalysisResult["severity"]
) {
  const pgModule = await getPgModule();
  if (pgModule && payload && severity) {
    try {
      return await pgModule.consumeAttestationNullifier(
        `att_${nullifier.slice(0, 10)}`,
        nullifier,
        severity,
        payload.from,
        payload.to,
        payload.chainId
      );
    } catch (e) {
      logError("repository.nullifier.pg_failed", e, { nullifier: nullifier.slice(0, 16) + "..." });
    }
  }

  if (memoryNullifiers.has(nullifier)) return false;
  memoryNullifiers.add(nullifier);
  logDebug("repository.nullifier_consumed", { nullifier: nullifier.slice(0, 16) + "..." });
  return true;
}

export async function recordFeedback(actorAddress: string, verdict: string, notes?: string) {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      await pgModule.insertFeedback(null, actorAddress, verdict, notes);
      return;
    } catch (e) {
      logError("repository.feedback.pg_failed", e, { actorAddress, verdict });
      // Fall through to memory
    }
  }

  memoryFeedback.push({ actorAddress, verdict, notes });
}

export async function getFeedbackCount() {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      return await pgModule.getFeedbackCountDb();
    } catch (e) {
      logError("repository.feedback_count.pg_failed", e);
    }
  }
  return memoryFeedback.length;
}

export async function getPlatformMetrics() {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      return await pgModule.getPlatformMetricsPg();
    } catch (e) {
      logError("repository.metrics.pg_failed", e);
    }
  }
  
  // Fallback to memory
  const totalScanned = memoryLog.length;
  const threatsPrevented = memoryLog.filter(e => e.result.severity === 'high' || e.result.severity === 'critical').length;
  const recentAnalyses = memoryLog.slice(-10).reverse().map((r, i) => ({
    id: `mem-${i}`,
    severity: r.result.severity,
    verdict: r.result.verdict,
    timestamp: new Date(r.timestamp).toISOString(),
    decodedKind: r.result.decoded?.kind ?? "contract-call",
    summary: r.result.summary,
    source: maskAddress(r.payload.from),
    destination: maskAddress(r.payload.to)
  }));

  return { totalScanned, threatsPrevented, recentAnalyses };
}

function maskAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
