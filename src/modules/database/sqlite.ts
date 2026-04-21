import Database from "better-sqlite3";
import path from "path";

// Use a file in the project root for persistence across restarts.
// In production, this path should come from an env var.
const DB_PATH = process.env.SENTINEL_DB_PATH || path.resolve(process.cwd(), "sentinel.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL"); // Better concurrent read performance
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE,
      actor_address TEXT,
      chain_id INTEGER,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      severity TEXT NOT NULL,
      verdict TEXT NOT NULL,
      score REAL NOT NULL,
      decoded_kind TEXT,
      payload_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_severity ON analyses(severity);
    CREATE INDEX IF NOT EXISTS idx_analyses_actor ON analyses(actor_address);
    CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);

    CREATE TABLE IF NOT EXISTS attestations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attestation_id TEXT UNIQUE NOT NULL,
      nullifier TEXT,
      severity TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      chain_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER,
      actor_address TEXT,
      rating TEXT NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS auth_nonces (
      address TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      window_start TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── Analysis CRUD ───

export function insertAnalysis(
  cacheKey: string,
  payload: { chainId: number; from: string; to: string },
  result: { severity: string; verdict: string; score: number; decoded?: { kind?: string } },
  resultJson: string,
  actorAddress?: string
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analyses (cache_key, actor_address, chain_id, from_address, to_address, severity, verdict, score, decoded_kind, payload_json, result_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    cacheKey,
    actorAddress ?? null,
    payload.chainId,
    payload.from,
    payload.to,
    result.severity,
    result.verdict,
    result.score,
    result.decoded?.kind ?? null,
    JSON.stringify(payload),
    resultJson
  );
  return Number(info.lastInsertRowid);
}

export function getAnalysisByKey(cacheKey: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT result_json FROM analyses WHERE cache_key = ?").get(cacheKey) as { result_json: string } | undefined;
  return row?.result_json ?? null;
}

export function getRecentAnalyses(limit = 50): Array<{
  id: number;
  severity: string;
  verdict: string;
  score: number;
  from_address: string;
  to_address: string;
  created_at: string;
}> {
  const db = getDb();
  return db.prepare("SELECT id, severity, verdict, score, from_address, to_address, created_at FROM analyses ORDER BY created_at DESC LIMIT ?").all(limit) as Array<{
    id: number;
    severity: string;
    verdict: string;
    score: number;
    from_address: string;
    to_address: string;
    created_at: string;
  }>;
}

export function getAnalysisCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM analyses").get() as { count: number };
  return row.count;
}

// ─── Attestation CRUD ───

export function insertAttestation(
  attestationId: string,
  nullifier: string | null,
  severity: string,
  fromAddress: string,
  toAddress: string,
  chainId?: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO attestations (attestation_id, nullifier, severity, from_address, to_address, chain_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(attestationId, nullifier, severity, fromAddress, toAddress, chainId ?? null);
}

// ─── Feedback CRUD ───

export function insertFeedback(analysisId: number | null, actorAddress: string | null, rating: string, comment?: string): void {
  const db = getDb();
  db.prepare("INSERT INTO feedback (analysis_id, actor_address, rating, comment) VALUES (?, ?, ?, ?)").run(
    analysisId,
    actorAddress,
    rating,
    comment ?? null
  );
}

export function getFeedbackCountDb(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM feedback").get() as { count: number };
  return row.count;
}

// ─── Auth Nonces ───

export function storeNonce(address: string, nonce: string, expiresAt: Date): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO auth_nonces (address, nonce, expires_at) VALUES (?, ?, ?)").run(
    address.toLowerCase(),
    nonce,
    expiresAt.toISOString()
  );
}

export function getNonce(address: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT nonce, expires_at FROM auth_nonces WHERE address = ?").get(address.toLowerCase()) as { nonce: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM auth_nonces WHERE address = ?").run(address.toLowerCase());
    return null;
  }
  return row.nonce;
}

export function deleteNonce(address: string): void {
  const db = getDb();
  db.prepare("DELETE FROM auth_nonces WHERE address = ?").run(address.toLowerCase());
}

// ─── Rate Limiting ───

export function checkRateLimit(key: string, maxRequests: number, windowMinutes: number): boolean {
  const db = getDb();
  const now = new Date();
  const row = db.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").get(key) as { count: number; window_start: string } | undefined;

  if (!row) {
    db.prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)").run(key, now.toISOString());
    return true;
  }

  const windowStart = new Date(row.window_start);
  const elapsed = (now.getTime() - windowStart.getTime()) / 60000;

  if (elapsed > windowMinutes) {
    db.prepare("UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?").run(now.toISOString(), key);
    return true;
  }

  if (row.count >= maxRequests) return false;

  db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
  return true;
}
