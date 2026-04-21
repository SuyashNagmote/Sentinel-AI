/**
 * Cache layer — uses PostgreSQL when DATABASE_URL is set, Redis when REDIS_URL is set,
 * falls back to in-memory Map.
 */
import Redis from "ioredis";

let client: Redis | null = null;
const fallbackCache = new Map<string, { value: string; expiresAt: number }>();

async function getPgCache() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await import("../database/postgres");
  } catch {
    return null;
  }
}

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
  }
  return client;
}

export async function readCache(key: string): Promise<string | null> {
  // Try Redis first
  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      const val = await redis.get(key);
      if (val) return val;
    } catch { /* fall through */ }
  }

  // Try PostgreSQL
  const pgCache = await getPgCache();
  if (pgCache) {
    try {
      const val = await pgCache.readCachePg(key);
      if (val) return val;
    } catch { /* fall through */ }
  }

  // In-memory fallback
  const mem = fallbackCache.get(key);
  if (mem) {
    if (Date.now() > mem.expiresAt) {
      fallbackCache.delete(key);
      return null;
    }
    return mem.value;
  }

  return null;
}

export async function writeCache(key: string, value: string, ttlSeconds = 300) {
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // Always write to in-memory for fast reads
  fallbackCache.set(key, { value, expiresAt });

  // Write to PostgreSQL
  const pgCache = await getPgCache();
  if (pgCache) {
    try {
      await pgCache.writeCachePg(key, value, ttlSeconds);
    } catch { /* ignore */ }
  }

  // Write to Redis if available
  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      await redis.set(key, value, "EX", ttlSeconds);
    } catch { /* ignore */ }
  }
}
