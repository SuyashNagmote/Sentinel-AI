import type { AnalysisResult, TransactionPayload } from "@/src/modules/transaction/types";

// Try SQLite first, fall back to in-memory
let useSqlite = false;
let sqliteModule: typeof import("./sqlite") | null = null;

try {
  sqliteModule = require("./sqlite");
  useSqlite = true;
} catch {
  // SQLite not available (e.g., edge runtime), use in-memory
}

const memoryLog: Array<{ payload: TransactionPayload; result: AnalysisResult }> = [];
const memoryNullifiers = new Set<string>();
const memoryFeedback: Array<{ actorAddress: string; verdict: string; notes?: string }> = [];

export async function recordAnalysis(
  payload: TransactionPayload,
  result: AnalysisResult,
  actorAddress?: string
) {
  if (useSqlite && sqliteModule) {
    try {
      sqliteModule.insertAnalysis(
        "",
        { chainId: payload.chainId, from: payload.from, to: payload.to },
        { severity: result.severity, verdict: result.verdict, score: result.score, decoded: result.decoded },
        JSON.stringify(result),
        actorAddress
      );
      return;
    } catch {
      // Fall through to memory
    }
  }

  memoryLog.push({ payload, result });
}

export function getMemoryLogs() {
  return memoryLog;
}

export async function consumeNullifier(nullifier: string, _policy: string) {
  if (memoryNullifiers.has(nullifier)) return false;
  memoryNullifiers.add(nullifier);
  return true;
}

export async function recordFeedback(actorAddress: string, verdict: string, notes?: string) {
  if (useSqlite && sqliteModule) {
    try {
      sqliteModule.insertFeedback(null, actorAddress, verdict, notes);
      return;
    } catch {
      // Fall through to memory
    }
  }

  memoryFeedback.push({ actorAddress, verdict, notes });
}

export function getFeedbackCount() {
  if (useSqlite && sqliteModule) {
    try {
      return sqliteModule.getFeedbackCountDb();
    } catch {
      // Fall through
    }
  }
  return memoryFeedback.length;
}
