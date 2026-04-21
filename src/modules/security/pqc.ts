import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

/**
 * Production-grade PQC key management.
 *
 * Key sourcing priority:
 * 1. SENTINEL_PQC_SEED env var (hex-encoded 32-byte seed)
 * 2. Deterministic fallback seed (development only)
 *
 * In production, SENTINEL_PQC_SEED should be injected via:
 * - Kubernetes secrets
 * - Docker secrets
 * - Cloud provider secret manager (AWS Secrets Manager, GCP Secret Manager)
 * - Hardware Security Module (HSM)
 */
let systemKeys: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;

function getSeed(): Uint8Array {
  const envSeed = process.env.SENTINEL_PQC_SEED;

  if (envSeed) {
    const bytes = Buffer.from(envSeed, "hex");
    if (bytes.length !== 32) {
      throw new Error(`SENTINEL_PQC_SEED must be 32 bytes (64 hex chars), got ${bytes.length} bytes`);
    }
    return new Uint8Array(bytes);
  }

  // Development fallback — log warning
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[PQC] WARNING: Using deterministic fallback seed. Set SENTINEL_PQC_SEED for production."
    );
  }

  const fallback = new Uint8Array(32);
  for (let i = 0; i < 32; i++) fallback[i] = i;
  return fallback;
}

function getSystemKeys() {
  if (!systemKeys) {
    const seed = getSeed();
    systemKeys = ml_dsa65.keygen(seed);
  }
  return systemKeys;
}

/**
 * Signs a payload using ML-DSA-65 (Dilithium).
 * API: sign(message, secretKey) -> signature
 */
export function signWithPQC(payload: Uint8Array): Uint8Array {
  const keys = getSystemKeys();
  return ml_dsa65.sign(payload, keys.secretKey);
}

/**
 * Verifies a PQC signature using ML-DSA-65.
 * API: verify(signature, message, publicKey) -> boolean
 */
export function verifyWithPQC(signature: Uint8Array, payload: Uint8Array, publicKey?: Uint8Array): boolean {
  const pub = publicKey || getSystemKeys().publicKey;
  return ml_dsa65.verify(signature, payload, pub);
}

/**
 * Returns the system's PQC public key for external verifiers.
 */
export function getPublicKey(): Uint8Array {
  return getSystemKeys().publicKey;
}

/**
 * Returns the public key as hex for API responses.
 */
export function getPublicKeyHex(): string {
  return Buffer.from(getPublicKey()).toString("hex");
}

/**
 * Converts a Uint8Array to a hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
