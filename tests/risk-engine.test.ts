import { describe, it, expect } from "vitest";
import { evaluateRisk } from "../src/modules/risk/engine";
import type { DecodedAction, SimulationEffect, TransactionPayload } from "../src/modules/transaction/types";

const basePayload: TransactionPayload = {
  chainId: 1,
  from: "0xabc0000000000000000000000000000000000001",
  to: "0xdef0000000000000000000000000000000000002",
  value: "0",
  data: "0x095ea7b3",
  trusted: false,
  metadata: { intent: "swap", source: "test", dappName: "TestDapp" },
};

const unlimitedApproval: DecodedAction = {
  kind: "approve",
  spender: "0xspender",
  amount: "unlimited",
  isUnlimited: true,
  tokenSymbol: "USDC",
};

const normalTransfer: DecodedAction = {
  kind: "transfer",
  recipient: "0xrecipient",
  amount: "100",
  tokenSymbol: "USDC",
};

const baseEffects: SimulationEffect[] = [
  { label: "Approval", from: "0xa", to: "0xb", asset: "USDC", amount: "unlimited", direction: "approval" },
];

describe("evaluateRisk", () => {
  it("flags unlimited approval as critical", () => {
    const result = evaluateRisk(basePayload, unlimitedApproval, baseEffects);
    expect(result.findings.some((f) => f.id === "unlimited-approval")).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("detects intent mismatch (user says swap, tx is approve)", () => {
    const result = evaluateRisk(
      { ...basePayload, metadata: { intent: "send", source: "test", dappName: "Test" } },
      unlimitedApproval,
      baseEffects
    );
    expect(result.findings.some((f) => f.id === "intent-mismatch")).toBe(true);
    expect(result.intent.matches).toBe(false);
  });

  it("passes intent match when declared matches decoded (send → transfer)", () => {
    const payload = { ...basePayload, trusted: true, metadata: { intent: "send" as const, source: "test", dappName: "Test" } };
    const effects: SimulationEffect[] = [
      { label: "Transfer", from: "0xa", to: "0xb", asset: "USDC", amount: "100", direction: "out" },
    ];
    const result = evaluateRisk(payload, normalTransfer, effects);
    expect(result.intent.matches).toBe(true);
  });

  it("flags untrusted context", () => {
    const result = evaluateRisk(basePayload, normalTransfer, []);
    expect(result.findings.some((f) => f.id === "untrusted-context")).toBe(true);
  });

  it("flags phishing language in metadata", () => {
    const payload = {
      ...basePayload,
      metadata: { intent: "claim" as const, source: "Urgent airdrop claim!", dappName: "VerifyNow" },
    };
    const result = evaluateRisk(payload, normalTransfer, []);
    expect(result.findings.some((f) => f.id === "phishing-pattern")).toBe(true);
  });

  it("flags suspicious contract from deny list", () => {
    const payload = { ...basePayload, to: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001" };
    const result = evaluateRisk(payload, normalTransfer, []);
    expect(result.findings.some((f) => f.id === "suspicious-contract")).toBe(true);
    expect(result.severity).toBe("critical");
  });

  it("handles new destination flag", () => {
    const result = evaluateRisk(basePayload, normalTransfer, [], { newDestination: true });
    expect(result.findings.some((f) => f.id === "new-destination")).toBe(true);
  });

  it("calculates confidence correctly", () => {
    const result = evaluateRisk(basePayload, unlimitedApproval, baseEffects);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.98);
  });
});
