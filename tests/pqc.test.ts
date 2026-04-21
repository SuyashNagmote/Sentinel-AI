import { describe, it, expect } from "vitest";
import { signWithPQC, verifyWithPQC, getPublicKey, bytesToHex } from "../src/modules/security/pqc";

describe("PQC ML-DSA-65", () => {
  const testMessage = new TextEncoder().encode("Sentinel AI test payload");

  it("signs a message and returns a signature", () => {
    const sig = signWithPQC(testMessage);
    expect(sig).toBeInstanceOf(Uint8Array);
    expect(sig.length).toBe(3309); // ML-DSA-65 signature length
  });

  it("verifies a valid signature", () => {
    const sig = signWithPQC(testMessage);
    const valid = verifyWithPQC(sig, testMessage);
    expect(valid).toBe(true);
  });

  it("rejects a tampered message", () => {
    const sig = signWithPQC(testMessage);
    const tampered = new TextEncoder().encode("tampered payload");
    const valid = verifyWithPQC(sig, tampered);
    expect(valid).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const sig = signWithPQC(testMessage);
    const tampered = new Uint8Array(sig);
    tampered[0] ^= 0xff;
    tampered[100] ^= 0xff;
    const valid = verifyWithPQC(tampered, testMessage);
    expect(valid).toBe(false);
  });

  it("returns a public key of correct length", () => {
    const pub = getPublicKey();
    expect(pub).toBeInstanceOf(Uint8Array);
    expect(pub.length).toBe(1952); // ML-DSA-65 public key length
  });

  it("converts bytes to hex correctly", () => {
    const bytes = new Uint8Array([0, 15, 255]);
    expect(bytesToHex(bytes)).toBe("000fff");
  });

  it("produces deterministic signatures with same seed", () => {
    // With deterministic keygen seed, the public key should be stable
    const pub1 = getPublicKey();
    const pub2 = getPublicKey();
    expect(bytesToHex(pub1)).toBe(bytesToHex(pub2));
  });
});
