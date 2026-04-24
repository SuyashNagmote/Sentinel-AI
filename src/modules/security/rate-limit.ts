import { logDebug, logError } from "@/src/modules/observability/logger";

type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();

async function getPgRateLimit() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await import("../database/postgres");
  } catch {
    return null;
  }
}

export async function enforceRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number; mode: "postgres" | "memory" }> {
  // Try PostgreSQL-backed rate limiting
  const pg = await getPgRateLimit();
  if (pg) {
    try {
      const windowMinutes = Math.max(1, Math.round(windowMs / 60_000));
      const allowed = await pg.checkRateLimit(key, limit, windowMinutes);
      logDebug("rate_limit.check", { key, allowed, mode: "postgres" });
      return {
        allowed,
        remaining: allowed ? limit - 1 : 0,
        retryAfterMs: allowed ? undefined : windowMs,
        mode: "postgres",
      };
    } catch (e) {
      logError("rate_limit.pg_failed", e, { key, fallback: "memory" });
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, mode: "memory" };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now, mode: "memory" };
  }

  entry.count += 1;
  buckets.set(key, entry);
  return { allowed: true, remaining: limit - entry.count, mode: "memory" };
}
