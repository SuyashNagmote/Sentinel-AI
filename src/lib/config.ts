/**
 * Centralized, type-safe configuration.
 *
 * All environment variables are read and validated here at module load time.
 * Import `config` instead of reading `process.env` directly in other modules.
 *
 * Optional vars return `undefined` when not set — the app degrades gracefully
 * (see README for what each var enables).
 */
import { z } from "zod";

const schema = z.object({
  // ─── Runtime ───
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ─── Database ───
  /** PostgreSQL connection string. Enables persistence, analytics, and reliable rate limiting. */
  DATABASE_URL: z.string().url().optional(),

  // ─── Cache ───
  /** Redis connection string. Optional — falls back to PostgreSQL then in-memory. */
  REDIS_URL: z.string().optional(),

  // ─── Auth ───
  /**
   * Secret for signing JWT auth tokens. Must be at least 32 characters.
   * Without this, a random secret is generated per process — tokens are
   * invalidated on every cold start (unreliable on Vercel serverless).
   * Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   */
  AUTH_SECRET: z.string().min(32).optional(),

  // ─── PQC Key Management ───
  /**
   * 32-byte hex-encoded seed for ML-DSA-65 key generation.
   * Without this, a random seed is generated per process — PQC signatures
   * won't verify across restarts.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  SENTINEL_PQC_SEED: z.string().length(64).optional(),

  // ─── AI ───
  /** Google AI Studio key. Enables Gemini-powered explanations and intent inference. */
  GEMINI_API_KEY: z.string().optional(),
  /** Gemini model to use. Defaults to gemini-1.5-flash. */
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),

  // ─── Blockchain ───
  /**
   * Ethereum RPC URL. Enables live chain context and transaction tracing.
   * Use an RPC that supports debug_traceCall (Alchemy, QuickNode) for best results.
   */
  RPC_URL: z.string().url().optional(),

  // ─── Simulation ───
  /** Tenderly API key for full EVM simulation. */
  TENDERLY_ACCESS_KEY: z.string().optional(),
  /** Tenderly account slug. */
  TENDERLY_ACCOUNT: z.string().optional(),
  /** Tenderly project slug. */
  TENDERLY_PROJECT: z.string().optional(),

  // ─── ZK Proofs ───
  /**
   * Path to a Groth16 verification key JSON file.
   * Without this, ZK proof verification fails closed and proofs are rejected.
   */
  ZK_VERIFICATION_KEY_PATH: z.string().optional(),

  // ─── Observability ───
  /** Minimum log level: debug | info | warn | error. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // ─── API ───
  /** Shared secret for server-to-server access to /api/metrics. */
  METRICS_READ_TOKEN: z.string().optional(),
  /** Allowed CORS origin for API requests. Defaults to * (all origins). */
  CORS_ORIGIN: z.string().optional(),
});

// Parse and validate. On failure, log a clear error and throw so the
// misconfiguration is caught at startup rather than silently mid-request.
const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  throw new Error("Environment configuration is invalid. Check the errors above.");
}

export const config = parsed.data;

// Convenience booleans
export const isProd = config.NODE_ENV === "production";
export const isDev = config.NODE_ENV === "development";
export const hasDatabase = Boolean(config.DATABASE_URL);
export const hasRedis = Boolean(config.REDIS_URL);
export const hasGemini = Boolean(config.GEMINI_API_KEY);
export const hasRpc = Boolean(config.RPC_URL);
export const hasTenderly =
  Boolean(config.TENDERLY_ACCESS_KEY) &&
  Boolean(config.TENDERLY_ACCOUNT) &&
  Boolean(config.TENDERLY_PROJECT);
