import { describe, it, expect } from "vitest";
import { decodeTransaction } from "../src/modules/blockchain/decoder";
import type { TransactionPayload } from "../src/modules/transaction/types";

const basePayload: TransactionPayload = {
  chainId: 1,
  from: "0xabc0000000000000000000000000000000000001",
  to: "0xdef0000000000000000000000000000000000002",
  value: "0",
  data: "0x",
  trusted: false,
};

describe("decodeTransaction", () => {
  it("decodes native ETH transfer (empty data)", () => {
    const result = decodeTransaction({ ...basePayload, data: "0x", value: "1.5" });
    expect(result.kind).toBe("native-transfer");
    if (result.kind === "native-transfer") {
      expect(result.amount).toBe("1.5");
      expect(result.tokenSymbol).toBe("ETH");
    }
  });

  it("decodes ERC20 approve", () => {
    // approve(0xspender, MaxUint256)
    const data =
      "0x095ea7b3" +
      "000000000000000000000000abcdef1234567890abcdef1234567890abcdef12" +
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const result = decodeTransaction({ ...basePayload, data });
    expect(result.kind).toBe("approve");
    if (result.kind === "approve") {
      expect(result.isUnlimited).toBe(true);
    }
  });

  it("decodes ERC20 transfer", () => {
    // transfer(0xrecipient, 1000000) — 1 USDC (6 decimals)
    const data =
      "0xa9059cbb" +
      "000000000000000000000000abcdef1234567890abcdef1234567890abcdef12" +
      "00000000000000000000000000000000000000000000000000000000000f4240";
    const result = decodeTransaction({ ...basePayload, data, tokenDecimals: 6, tokenSymbol: "USDC" });
    expect(result.kind).toBe("transfer");
    if (result.kind === "transfer") {
      expect(result.amount).toBe("1.0");
      expect(result.tokenSymbol).toBe("USDC");
    }
  });

  it("returns contract-call for unknown selector", () => {
    const data = "0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001";
    const result = decodeTransaction({ ...basePayload, data });
    expect(result.kind).toBe("contract-call");
  });
});
