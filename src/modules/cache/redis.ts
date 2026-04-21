/**
 * Cache layer — uses SQLite when available, falls back to in-memory Map.
 * Redis integration preserved for when REDIS_URL is configured.
 */
import Redis from "ioredis";

let client: Redis | null = null;
const fallbackCache = new Map<string, { value: string; expiresAt: number }>();

// SQLite cache table (optional)
let sqliteDb: ReturnType<typeof import("better-sqlite3")> | null = null;
try {
  const { getDb } = require("../database/sqlite");
  sqliteDb = getDb();
  sqliteDb!.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
} catch {
  // SQLite not available, use in-memory
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

  // Try SQLite
  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare("SELECT value, expires_at FROM cache WHERE key = ?").get(key) as { value: string; expires_at: number } | undefined;
      if (row) {
        if (Date.now() > row.expires_at) {
          sqliteDb.prepare("DELETE FROM cache WHERE key = ?").run(key);
          return null;
        }
        return row.value;
      }
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

  // Write to SQLite
  if (sqliteDb) {
    try {
      sqliteDb.prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").run(key, value, expiresAt);
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
