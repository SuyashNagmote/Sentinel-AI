import { logDebug, logError, logInfo, logWarn } from "@/src/modules/observability/logger";
import type {
  DecodedAction,
  SimulationEffect,
  TransactionPayload,
} from "@/src/modules/transaction/types";

type SimulationResult = {
  effects: SimulationEffect[];
  simulationSource: "tenderly" | "rpc-trace" | "heuristic";
};

function parseTransactionValue(value: string): bigint {
  if (!value || value === "0") return 0n;
  if (value.startsWith("0x")) return BigInt(value);

  const [wholePart, fractionPart = ""] = value.split(".");
  const normalizedFraction = `${fractionPart}000000000000000000`.slice(0, 18);
  return BigInt(wholePart || "0") * 10n ** 18n + BigInt(normalizedFraction);
}

/** Tenderly Simulation API (when TENDERLY_ACCESS_KEY is set) */
async function simulateViaTenderly(
  payload: TransactionPayload
): Promise<SimulationResult | null> {
  const accessKey = process.env.TENDERLY_ACCESS_KEY;
  const account = process.env.TENDERLY_ACCOUNT;
  const project = process.env.TENDERLY_PROJECT;

  if (!accessKey || !account || !project) return null;

  try {
    const response = await fetch(
      `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Key": accessKey,
        },
        body: JSON.stringify({
          network_id: String(payload.chainId),
          from: payload.from,
          to: payload.to,
          input: payload.data,
          value: payload.value === "0" ? "0" : payload.value,
          save: false,
          save_if_fails: false,
          simulation_type: "full",
          generate_access_list: true,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      logWarn("simulation.tenderly.http_error", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = await response.json();
    const txInfo = data?.transaction;
    const effects: SimulationEffect[] = [];

    // Parse asset changes from Tenderly response
    const assetChanges = txInfo?.transaction_info?.asset_changes ?? [];
    for (const change of assetChanges) {
      effects.push({
        label: change.type === "Transfer" ? "Token transfer" : change.type ?? "Asset change",
        from: change.from ?? payload.from,
        to: change.to ?? payload.to,
        asset: change.token_info?.symbol ?? "Unknown",
        amount: change.raw_amount
          ? (Number(change.raw_amount) / Math.pow(10, change.token_info?.decimals ?? 18)).toString()
          : "Unknown",
        direction: change.from?.toLowerCase() === payload.from.toLowerCase() ? "out" : "in",
      });
    }

    // Parse balance changes as fallback
    const balanceChanges = txInfo?.transaction_info?.balance_diff ?? [];
    for (const diff of balanceChanges) {
      if (diff.dirty && diff.address?.toLowerCase() === payload.from.toLowerCase()) {
        const delta = BigInt(diff.dirty) - BigInt(diff.original ?? "0");
        if (delta < 0n) {
          effects.push({
            label: "Native ETH spent",
            from: payload.from,
            to: payload.to,
            asset: "ETH",
            amount: (Number(-delta) / 1e18).toFixed(6),
            direction: "out",
          });
        }
      }
    }

    logInfo("simulation.tenderly.success", {
      effectCount: effects.length,
      status: txInfo?.status ? "success" : "revert",
      gasUsed: txInfo?.gas_used,
    });

    return { effects, simulationSource: "tenderly" };
  } catch (e) {
    logError("simulation.tenderly.failed", e);
    return null;
  }
}

/** RPC-based trace simulation using eth_call + debug_traceCall */
async function simulateViaRPC(
  payload: TransactionPayload
): Promise<SimulationResult | null> {
  if (!process.env.RPC_URL) return null;

  try {
    const { JsonRpcProvider } = await import("ethers");
    const provider = new JsonRpcProvider(process.env.RPC_URL);
    const normalizedValue = parseTransactionValue(payload.value);

    // Attempt eth_call to detect reverts and get return data
    const callParams = {
      from: payload.from,
      to: payload.to,
      data: payload.data,
      value: normalizedValue === 0n ? undefined : normalizedValue,
    };

    let callResult: string | null = null;
    let reverted = false;

    try {
      callResult = await provider.call(callParams);
    } catch {
      reverted = true;
    }

    // Try debug_traceCall for internal call trace (supported by Alchemy, QuickNode, etc.)
    const effects: SimulationEffect[] = [];

    try {
      const traceResult = await provider.send("debug_traceCall", [
        {
          from: payload.from,
          to: payload.to,
          data: payload.data,
          value: normalizedValue === 0n ? "0x0" : "0x" + normalizedValue.toString(16),
        },
        "latest",
        { tracer: "callTracer", tracerConfig: { withLog: true } },
      ]);

      // Parse internal calls from trace
      if (traceResult?.calls) {
        for (const call of traceResult.calls as Array<{ from: string; to: string; value?: string; type?: string }>) {
          if (call.value && BigInt(call.value) > 0n) {
            effects.push({
              label: `Internal ${call.type ?? "CALL"}`,
              from: call.from,
              to: call.to,
              asset: "ETH",
              amount: (Number(BigInt(call.value)) / 1e18).toFixed(6),
              direction: call.from.toLowerCase() === payload.from.toLowerCase() ? "out" : "in",
            });
          }
        }
      }

      // Parse transfer logs from trace
      if (traceResult?.logs) {
        const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
        for (const log of traceResult.logs as Array<{ topics: string[]; data: string; address: string }>) {
          if (log.topics[0] === TRANSFER_TOPIC && log.topics.length >= 3) {
            const from = "0x" + log.topics[1].slice(26);
            const to = "0x" + log.topics[2].slice(26);
            const amount = BigInt(log.data);
            effects.push({
              label: "ERC-20 Transfer (traced)",
              from,
              to,
              asset: log.address.slice(0, 10) + "...",
              amount: amount.toString(),
              direction: from.toLowerCase() === payload.from.toLowerCase() ? "out" : "in",
            });
          }
        }
      }

      logInfo("simulation.rpc_trace.success", {
        effectCount: effects.length,
        reverted,
        hasCallResult: !!callResult,
      });

      return { effects, simulationSource: "rpc-trace" };
    } catch {
      // debug_traceCall not supported by this RPC — still return eth_call result
      logDebug("simulation.rpc_trace.unsupported", {
        message: "debug_traceCall not available, using eth_call only",
      });

      if (reverted) {
        effects.push({
          label: "Transaction would revert",
          from: payload.from,
          to: payload.to,
          asset: "N/A",
          amount: "N/A",
          direction: "out",
        });
      }

      return effects.length > 0 ? { effects, simulationSource: "rpc-trace" } : null;
    }
  } catch (e) {
    logError("simulation.rpc.failed", e);
    return null;
  }
}

/** Heuristic simulation — pattern matching on decoded actions (always available) */
function simulateHeuristic(
  payload: TransactionPayload,
  decoded: DecodedAction
): SimulationResult {
  const effects: SimulationEffect[] = [];

  if (decoded.kind === "approve") {
    effects.push({
      label: decoded.isUnlimited ? "Unlimited allowance granted" : "Allowance update",
      from: payload.from,
      to: decoded.spender,
      asset: decoded.tokenSymbol,
      amount: decoded.isUnlimited ? "Unlimited" : decoded.amount,
      direction: "approval",
    });
  }

  if (decoded.kind === "permit") {
    effects.push({
      label: "Off-chain spending permission",
      from: payload.from,
      to: decoded.spender,
      asset: decoded.tokenSymbol,
      amount: decoded.amount ?? "Variable",
      direction: "approval",
    });
  }

  if (decoded.kind === "multicall") {
    effects.push({
      label: `Batched execution (${decoded.innerCalls} calls)`,
      from: payload.from,
      to: decoded.target,
      asset: payload.tokenSymbol ?? "Mixed assets",
      amount: payload.value === "0" ? "N/A" : payload.value,
      direction: "out",
    });

    // Surface effects from recursively decoded inner actions
    if (decoded.innerActions) {
      for (const inner of decoded.innerActions) {
        if (inner.kind === "approve") {
          effects.push({
            label: `Hidden approval in multicall${inner.isUnlimited ? " (UNLIMITED)" : ""}`,
            from: payload.from,
            to: inner.spender,
            asset: inner.tokenSymbol,
            amount: inner.isUnlimited ? "Unlimited" : inner.amount,
            direction: "approval",
          });
        }
        if (inner.kind === "permit") {
          effects.push({
            label: "Hidden permit in multicall",
            from: payload.from,
            to: inner.spender,
            asset: inner.tokenSymbol,
            amount: inner.amount ?? "Variable",
            direction: "approval",
          });
        }
        if (inner.kind === "transfer" || inner.kind === "native-transfer") {
          effects.push({
            label: `Transfer in multicall`,
            from: payload.from,
            to: inner.recipient,
            asset: inner.tokenSymbol,
            amount: inner.amount,
            direction: "out",
          });
        }
      }
    }
  }

  if (decoded.kind === "transfer" || decoded.kind === "native-transfer") {
    effects.push({
      label: "Assets leave wallet",
      from: payload.from,
      to: decoded.recipient,
      asset: decoded.tokenSymbol,
      amount: decoded.amount,
      direction: "out",
    });
  }

  if (decoded.kind === "contract-call") {
    effects.push({
      label: decoded.method ? `Contract call: ${decoded.method}` : "Opaque contract interaction",
      from: payload.from,
      to: decoded.target,
      asset: payload.tokenSymbol ?? "Unknown asset",
      amount: payload.value === "0" ? "N/A" : payload.value,
      direction: "out",
    });
  }

  return { effects, simulationSource: "heuristic" };
}

/**
 * Multi-tier simulation pipeline:
 * 1. Tenderly Simulation API (full EVM trace, most accurate)
 * 2. RPC debug_traceCall (internal calls + transfer logs)
 * 3. Heuristic pattern matching (always available)
 */
export async function simulateTransaction(
  payload: TransactionPayload,
  decoded: DecodedAction
): Promise<SimulationResult> {
  // Tier 1: Try Tenderly
  const tenderlyResult = await simulateViaTenderly(payload);
  if (tenderlyResult && tenderlyResult.effects.length > 0) {
    return tenderlyResult;
  }

  // Tier 2: Try RPC trace
  const rpcResult = await simulateViaRPC(payload);
  if (rpcResult && rpcResult.effects.length > 0) {
    return rpcResult;
  }

  // Tier 3: Heuristic fallback (always works)
  return simulateHeuristic(payload, decoded);
}
