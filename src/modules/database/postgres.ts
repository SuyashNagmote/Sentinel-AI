import { Pool } from "pg";

// Railway injects DATABASE_URL automatically when a Postgres service is attached.
const DATABASE_URL = process.env.DATABASE_URL;

let _pool: Pool | null = null;
let _migrated = false;

export function getPool(): Pool {
  if (!_pool) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Attach a PostgreSQL service in Railway or set it manually.");
    }
    _pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return _pool;
}

export async function ensureMigrated(): Promise<void> {
  if (_migrated) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analyses (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_severity ON analyses(severity);
    CREATE INDEX IF NOT EXISTS idx_analyses_actor ON analyses(actor_address);
    CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);

    CREATE TABLE IF NOT EXISTS attestations (
      id SERIAL PRIMARY KEY,
      attestation_id TEXT UNIQUE NOT NULL,
      nullifier TEXT,
      severity TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      chain_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      analysis_id INTEGER,
      actor_address TEXT,
      rating TEXT NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT fk_feedback_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS auth_nonces (
      address TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      window_start TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    );
  `);
  _migrated = true;
}

// ─── Analysis CRUD ───

export async function insertAnalysis(
  cacheKey: string,
  payload: { chainId: number; from: string; to: string },
  result: { severity: string; verdict: string; score: number; decoded?: { kind?: string } },
  resultJson: string,
  actorAddress?: string
): Promise<number> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO analyses (cache_key, actor_address, chain_id, from_address, to_address, severity, verdict, score, decoded_kind, payload_json, result_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (cache_key) DO UPDATE SET
       result_json = EXCLUDED.result_json,
       severity = EXCLUDED.severity,
       verdict = EXCLUDED.verdict,
       score = EXCLUDED.score
     RETURNING id`,
    [
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
      resultJson,
    ]
  );
  return res.rows[0].id;
}

export async function getAnalysisByKey(cacheKey: string): Promise<string | null> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query("SELECT result_json FROM analyses WHERE cache_key = $1", [cacheKey]);
  return res.rows[0]?.result_json ?? null;
}

export async function getRecentAnalyses(limit = 50): Promise<Array<{
  id: number;
  severity: string;
  verdict: string;
  score: number;
  from_address: string;
  to_address: string;
  created_at: string;
}>> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query(
    "SELECT id, severity, verdict, score, from_address, to_address, created_at FROM analyses ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return res.rows;
}

export async function getAnalysisCount(): Promise<number> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query("SELECT COUNT(*) as count FROM analyses");
  return parseInt(res.rows[0].count, 10);
}

// ─── Attestation CRUD ───

export async function insertAttestation(
  attestationId: string,
  nullifier: string | null,
  severity: string,
  fromAddress: string,
  toAddress: string,
  chainId?: number
): Promise<void> {
  await ensureMigrated();
  const pool = getPool();
  await pool.query(
    `INSERT INTO attestations (attestation_id, nullifier, severity, from_address, to_address, chain_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (attestation_id) DO NOTHING`,
    [attestationId, nullifier, severity, fromAddress, toAddress, chainId ?? null]
  );
}

// ─── Feedback CRUD ───

export async function insertFeedback(
  analysisId: number | null,
  actorAddress: string | null,
  rating: string,
  comment?: string
): Promise<void> {
  await ensureMigrated();
  const pool = getPool();
  await pool.query(
    "INSERT INTO feedback (analysis_id, actor_address, rating, comment) VALUES ($1, $2, $3, $4)",
    [analysisId, actorAddress, rating, comment ?? null]
  );
}

export async function getFeedbackCountDb(): Promise<number> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query("SELECT COUNT(*) as count FROM feedback");
  return parseInt(res.rows[0].count, 10);
}

// ─── Auth Nonces ───

export async function storeNonce(address: string, nonce: string, expiresAt: Date): Promise<void> {
  await ensureMigrated();
  const pool = getPool();
  await pool.query(
    "INSERT INTO auth_nonces (address, nonce, expires_at) VALUES ($1, $2, $3) ON CONFLICT (address) DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at",
    [address.toLowerCase(), nonce, expiresAt.toISOString()]
  );
}

export async function getNonce(address: string): Promise<string | null> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query(
    "SELECT nonce, expires_at FROM auth_nonces WHERE address = $1",
    [address.toLowerCase()]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (new Date(row.expires_at) < new Date()) {
    await pool.query("DELETE FROM auth_nonces WHERE address = $1", [address.toLowerCase()]);
    return null;
  }
  return row.nonce;
}

export async function deleteNonce(address: string): Promise<void> {
  await ensureMigrated();
  const pool = getPool();
  await pool.query("DELETE FROM auth_nonces WHERE address = $1", [address.toLowerCase()]);
}

// ─── Rate Limiting ───

export async function checkRateLimit(key: string, maxRequests: number, windowMinutes: number): Promise<boolean> {
  await ensureMigrated();
  const pool = getPool();
  const now = new Date();
  const res = await pool.query("SELECT count, window_start FROM rate_limits WHERE key = $1", [key]);

  if (res.rows.length === 0) {
    await pool.query("INSERT INTO rate_limits (key, count, window_start) VALUES ($1, 1, $2)", [key, now.toISOString()]);
    return true;
  }

  const row = res.rows[0];
  const windowStart = new Date(row.window_start);
  const elapsed = (now.getTime() - windowStart.getTime()) / 60000;

  if (elapsed > windowMinutes) {
    await pool.query("UPDATE rate_limits SET count = 1, window_start = $1 WHERE key = $2", [now.toISOString(), key]);
    return true;
  }

  if (row.count >= maxRequests) return false;

  await pool.query("UPDATE rate_limits SET count = count + 1 WHERE key = $1", [key]);
  return true;
}

// ─── Cache (PostgreSQL-backed) ───

export async function readCachePg(key: string): Promise<string | null> {
  await ensureMigrated();
  const pool = getPool();
  const res = await pool.query("SELECT value, expires_at FROM cache WHERE key = $1", [key]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (Date.now() > parseInt(row.expires_at, 10)) {
    await pool.query("DELETE FROM cache WHERE key = $1", [key]);
    return null;
  }
  return row.value;
}

export async function writeCachePg(key: string, value: string, ttlSeconds = 300): Promise<void> {
  await ensureMigrated();
  const pool = getPool();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await pool.query(
    "INSERT INTO cache (key, value, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at",
    [key, value, expiresAt]
  );
}
