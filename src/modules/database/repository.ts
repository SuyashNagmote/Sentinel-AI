import type { AnalysisResult, TransactionPayload } from "@/src/modules/transaction/types";

const memoryLog: Array<{ payload: TransactionPayload; result: AnalysisResult }> = [];
const memoryNullifiers = new Set<string>();
const memoryFeedback: Array<{ actorAddress: string; verdict: string; notes?: string }> = [];

async function getPgModule() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await import("./postgres");
  } catch {
    return null;
  }
}

export async function recordAnalysis(
  payload: TransactionPayload,
  result: AnalysisResult,
  actorAddress?: string
) {
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      await pgModule.insertAnalysis(
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
  const pgModule = await getPgModule();
  if (pgModule) {
    try {
      await pgModule.insertFeedback(null, actorAddress, verdict, notes);
      return;
    } catch {
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
    } catch {
      // Fall through
    }
  }
  return memoryFeedback.length;
}
