import { randomBytes } from "crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

import { logWarn, logInfo } from "@/src/modules/observability/logger";

/**
 * Production-grade PQC key management.
 *
 * Key sourcing priority:
 * 1. SENTINEL_PQC_SEED env var (hex-encoded 32-byte seed)
 * 2. Auto-generated random seed (development only — signatures won't verify across restarts)
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
    logInfo("pqc.seed.loaded", { source: "environment" });
    return new Uint8Array(bytes);
  }

  // No env seed — generate a cryptographically random seed for this process lifetime
  const randomSeed = randomBytes(32);
  logWarn("pqc.seed.generated", {
    message:
      "No SENTINEL_PQC_SEED env var set. Generated random PQC seed for this process. " +
      "Signatures will NOT verify across restarts. Set SENTINEL_PQC_SEED for production.",
  });

  return new Uint8Array(randomSeed);
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
