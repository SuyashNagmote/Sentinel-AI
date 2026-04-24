import { Interface, MaxUint256, formatUnits } from "ethers";

import { logDebug, logWarn } from "@/src/modules/observability/logger";
import type { DecodedAction, TransactionPayload } from "@/src/modules/transaction/types";

const erc20Interface = new Interface([
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
  "function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)",
  "function multicall(bytes[] data)",
]);

/** Extended ABI fragments for deeper decoding */
const extendedInterface = new Interface([
  // Uniswap V3 Router
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96))",
  "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum))",
  // Uniswap Permit2
  "function permit(address owner,address spender,uint256 amount,uint256 expiration,uint256 nonce,bytes signature)",
  // OpenSea Seaport
  "function fulfillBasicOrder((address considerationToken,uint256 considerationIdentifier,uint256 considerationAmount,address offerer,address zone,address offerToken,uint256 offerIdentifier,uint256 offerAmount,uint8 basicOrderType,uint256 startTime,uint256 endTime,bytes32 zoneHash,uint256 salt,bytes32 offererConduitKey,bytes32 fulfillerConduitKey,uint256 totalOriginalAdditionalRecipients,tuple(uint256 amount,address recipient)[] additionalRecipients,bytes signature))",
]);

const knownSelectors: Record<string, string> = {
  // Core ERC-20
  "0xd505accf": "permit2",
  "0x095ea7b3": "approve",
  "0xa9059cbb": "transfer",
  "0x23b872dd": "transferFrom",
  // Multicall variants
  "0xac9650d8": "multicall",
  "0x5ae401dc": "multicall",      // Uniswap V3 Router multicall(uint256,bytes[])
  "0x1f0464d1": "multicall",      // multicall(bytes32,bytes[])
  // Uniswap
  "0x414bf389": "exactInputSingle",
  "0xc04b8d59": "exactInput",
  "0xdb3e2198": "exactOutputSingle",
  "0xf28c0498": "exactOutput",
  "0x04e45aaf": "exactInputSingle", // V3 Router02
  // Token approvals & permits
  "0x2a2d80d1": "increaseAllowance",
  "0xa457c2d7": "decreaseAllowance",
  "0x4c8fe526": "permit2.permit",
  "0x2b67b570": "permit2.permitBatch",
  // OpenSea
  "0xfb0f3ee1": "fulfillBasicOrder",
  "0xe7acab24": "fulfillAdvancedOrder",
  // 1inch
  "0x12aa3caf": "swap",
  "0x0502b1c5": "unoswap",
  // ERC-721 / ERC-1155
  "0x42842e0e": "safeTransferFrom",
  "0xb88d4fde": "safeTransferFrom",
  "0xf242432a": "safeTransferFrom1155",
  "0x2eb2c2d6": "safeBatchTransferFrom1155",
  // Common governance
  "0x5c19a95c": "delegate",
  "0xb61d27f6": "execute",
};

/** Maximum recursion depth for multicall decoding */
const MAX_DECODE_DEPTH = 4;

/**
 * Recursively decode a single calldata fragment against known ABIs.
 */
function decodeCalldata(
  data: string,
  target: string,
  tokenDecimals: number,
  tokenSymbol: string,
  depth: number
): DecodedAction {
  if (depth > MAX_DECODE_DEPTH) {
    return { kind: "contract-call", selector: data.slice(0, 10), target };
  }

  if (data === "0x" || data === "0x0") {
    return { kind: "native-transfer", recipient: target, amount: "0", tokenSymbol: "ETH" };
  }

  try {
    const parsed = erc20Interface.parseTransaction({ data, value: BigInt(0) });
    if (!parsed) {
      // Selector not in ERC-20 ABI — try extended ABI, then knownSelectors
      try {
        const extParsed = extendedInterface.parseTransaction({ data, value: BigInt(0) });
        if (extParsed) {
          return { kind: "contract-call", method: extParsed.name, selector: data.slice(0, 10), target };
        }
      } catch { /* not in extended ABI either */ }

      const selector = data.slice(0, 10);
      return { kind: "contract-call", method: knownSelectors[selector], selector, target };
    }

    if (parsed.name === "approve") {
      const amount = parsed.args[1] as bigint;
      return {
        kind: "approve",
        spender: String(parsed.args[0]),
        amount: formatUnits(amount, tokenDecimals),
        isUnlimited: amount === MaxUint256,
        tokenSymbol,
      };
    }

    if (parsed.name === "transfer") {
      return {
        kind: "transfer",
        recipient: String(parsed.args[0]),
        amount: formatUnits(parsed.args[1] as bigint, tokenDecimals),
        tokenSymbol,
      };
    }

    if (parsed.name === "transferFrom") {
      return {
        kind: "transfer",
        recipient: String(parsed.args[1]),
        amount: formatUnits(parsed.args[2] as bigint, tokenDecimals),
        tokenSymbol,
      };
    }

    if (parsed.name === "permit") {
      return {
        kind: "permit",
        owner: String(parsed.args[0]),
        spender: String(parsed.args[1]),
        amount: formatUnits(parsed.args[2] as bigint, tokenDecimals),
        deadline: String(parsed.args[3]),
        tokenSymbol,
      };
    }

    if (parsed.name === "multicall") {
      const innerCallsData = Array.isArray(parsed.args[0]) ? (parsed.args[0] as string[]) : [];
      const innerActions: DecodedAction[] = [];

      for (const innerData of innerCallsData) {
        try {
          const innerDecoded = decodeCalldata(innerData, target, tokenDecimals, tokenSymbol, depth + 1);
          innerActions.push(innerDecoded);
        } catch {
          innerActions.push({
            kind: "contract-call",
            selector: typeof innerData === "string" ? innerData.slice(0, 10) : "0x",
            target,
          });
        }
      }

      logDebug("decoder.multicall", {
        target,
        totalInnerCalls: innerCallsData.length,
        decodedCount: innerActions.length,
        hiddenApprovals: innerActions.filter(
          (a) => a.kind === "approve" || a.kind === "permit"
        ).length,
      });

      return {
        kind: "multicall",
        target,
        innerCalls: innerCallsData.length,
        selector: data.slice(0, 10),
        innerActions,
      };
    }

    return {
      kind: "contract-call",
      method: parsed.name,
      selector: data.slice(0, 10),
      target,
    };
  } catch {
    // Try extended ABI fragments
    try {
      const extParsed = extendedInterface.parseTransaction({ data, value: BigInt(0) });
      if (extParsed) {
        return {
          kind: "contract-call",
          method: extParsed.name,
          selector: data.slice(0, 10),
          target,
        };
      }
    } catch {
      // Not in extended ABI either
    }

    const selector = data.slice(0, 10);
    return {
      kind: "contract-call",
      method: knownSelectors[selector],
      selector,
      target,
    };
  }
}

export function decodeTransaction(payload: TransactionPayload): DecodedAction {
  const decimals = payload.tokenDecimals ?? 18;
  const tokenSymbol = payload.tokenSymbol ?? "TOKEN";

  if (payload.data === "0x" || payload.data === "0x0") {
    return {
      kind: "native-transfer",
      recipient: payload.to,
      amount: payload.value,
      tokenSymbol: "ETH",
    };
  }

  const decoded = decodeCalldata(payload.data, payload.to, decimals, tokenSymbol, 0);

  // Log hidden approvals found inside multicalls
  if (decoded.kind === "multicall" && decoded.innerActions) {
    const hiddenApprovals = decoded.innerActions.filter(
      (a) => a.kind === "approve" || a.kind === "permit"
    );
    if (hiddenApprovals.length > 0) {
      logWarn("decoder.hidden_approvals_in_multicall", {
        target: payload.to,
        count: hiddenApprovals.length,
        types: hiddenApprovals.map((a) => a.kind),
      });
    }
  }

  return decoded;
}
