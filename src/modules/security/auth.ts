import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { verifyMessage } from "ethers";

import { logWarn, logError, logInfo } from "@/src/modules/observability/logger";

const memoryNonces = new Map<string, { nonce: string; expiresAt: number; issuedAt: number }>();

async function getPgNonces() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await import("../database/postgres");
  } catch {
    return null;
  }
}

/**
 * Auth secret management. Priority:
 * 1. AUTH_SECRET env var (production — must be set)
 * 2. Auto-generated random secret (dev only — logged with warning)
 */
let _runtimeSecret: string | null = null;

function tokenSecret(): string {
  const envSecret = process.env.AUTH_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  if (envSecret) {
    logWarn("auth.secret.weak", {
      message: "AUTH_SECRET is set but shorter than 32 characters. Use a stronger secret in production.",
    });
    return envSecret;
  }

  // No env secret — generate a random one for this process lifetime
  if (!_runtimeSecret) {
    _runtimeSecret = randomBytes(64).toString("hex");
    logWarn("auth.secret.generated", {
      message:
        "No AUTH_SECRET env var set. Generated ephemeral secret for this process. " +
        "Tokens will be invalidated on restart. Set AUTH_SECRET for production.",
    });
  }

  return _runtimeSecret;
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signToken(address: string, nonce: string) {
  const secret = tokenSecret();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 1000 * 60 * 60; // 1 hour
  const sessionId = randomUUID();
  const payload = `${address}:${issuedAt}:${expiresAt}:${sessionId}:${nonce}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [address, issuedAt, expiresAt, sessionId, nonce, signature] = decoded.split(":");
    const payload = `${address}:${issuedAt}:${expiresAt}:${sessionId}:${nonce}`;
    const expected = createHmac("sha256", tokenSecret()).update(payload).digest("hex");

    if (!safeEquals(expected, signature)) return null;
    if (Number(expiresAt) < Date.now()) return null;
    return { address, issuedAt: Number(issuedAt), expiresAt: Number(expiresAt), sessionId };
  } catch {
    return null;
  }
}

export async function issueNonce(address: string) {
  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Persist to PostgreSQL if available
  const pgNonces = await getPgNonces();
  if (pgNonces) {
    try {
      await pgNonces.storeNonce(address, nonce, expiresAt);
      return nonce;
    } catch (e) {
      logError("auth.nonce.pg_failed", e, { address });
    }
  }

  memoryNonces.set(address.toLowerCase(), {
    nonce,
    expiresAt: expiresAt.getTime(),
    issuedAt: Date.now(),
  });
  return nonce;
}

export async function verifyWalletSignature(address: string, signature: string) {
  let nonce: string | null = null;

  // Try PostgreSQL first
  const pgNonces = await getPgNonces();
  if (pgNonces) {
    try {
      nonce = await pgNonces.getNonce(address);
      if (nonce) {
        const message = `Sentinel AI authentication nonce: ${nonce}`;
        const recovered = verifyMessage(message, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) return null;
        await pgNonces.deleteNonce(address);
        logInfo("auth.verified", { address, store: "postgres" });
        return signToken(address, nonce);
      }
    } catch (e) {
      logError("auth.verify.pg_failed", e, { address });
    }
  }

  // Fall back to in-memory
  const record = memoryNonces.get(address.toLowerCase());
  if (!record || record.expiresAt < Date.now()) return null;

  const message = `Sentinel AI authentication nonce: ${record.nonce}`;
  const recovered = verifyMessage(message, signature);
  if (recovered.toLowerCase() !== address.toLowerCase()) return null;

  memoryNonces.delete(address.toLowerCase());
  logInfo("auth.verified", { address, store: "memory" });
  return signToken(address, record.nonce);
}
