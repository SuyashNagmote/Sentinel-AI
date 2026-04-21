import { createHash } from "crypto";

import { bytesToHex, signWithPQC } from "./pqc";
import type { AnalysisResult } from "@/src/modules/transaction/types";

export function signAnalysisResult(result: Omit<AnalysisResult, "resultIntegrity">) {
  const payload = JSON.stringify(result);
  const publicDigest = createHash("sha256").update(payload).digest("hex");
  
  // Use true Post-Quantum Cryptography (ML-DSA-65) instead of standard HMAC
  const payloadBytes = new TextEncoder().encode(payload);
  const signatureBytes = signWithPQC(payloadBytes);
  const signature = bytesToHex(signatureBytes);

  return {
    signature,
    algorithm: "ml-dsa-65" as const,
    verifier: "sentinel-node-pqc" as const,
    publicDigest,
    verificationId: `verify_${publicDigest.slice(0, 12)}`
  };
}
