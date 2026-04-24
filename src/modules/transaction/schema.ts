import { z } from "zod";

/** Validates a proper Ethereum address: 0x followed by exactly 40 hex characters */
const ethereumAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address (0x + 40 hex chars)");

/** Validates hex-encoded data (calldata). Minimum valid is "0x" for empty calls */
const hexData = z
  .string()
  .regex(/^0x([0-9a-fA-F]{2})*$/, "Must be valid hex-encoded data starting with 0x");

/** Validates ETH value — either a decimal string or hex-encoded */
const ethValue = z
  .string()
  .refine(
    (v) => /^0x[0-9a-fA-F]+$/.test(v) || /^\d+(\.\d+)?$/.test(v),
    "Must be a valid numeric value (decimal or 0x hex)"
  );

/** Known chain IDs for supported networks */
const SUPPORTED_CHAINS = new Set([
  1,      // Ethereum
  5,      // Goerli
  11155111, // Sepolia
  56,     // BSC
  137,    // Polygon
  42161,  // Arbitrum One
  10,     // Optimism
  43114,  // Avalanche
  8453,   // Base
  324,    // zkSync Era
  250,    // Fantom
  100,    // Gnosis
  1101,   // Polygon zkEVM
  534352, // Scroll
  59144,  // Linea
  81457,  // Blast
]);

export const transactionPayloadSchema = z.object({
  chainId: z
    .number()
    .int()
    .positive()
    .refine((id) => SUPPORTED_CHAINS.has(id), {
      message: `Unsupported chain ID. Supported: ${[...SUPPORTED_CHAINS].join(", ")}`,
    }),
  from: ethereumAddress,
  to: ethereumAddress,
  value: ethValue,
  data: hexData,
  tokenSymbol: z.string().max(20).optional(),
  tokenDecimals: z.number().int().min(0).max(36).optional(),
  trusted: z.boolean().optional(),
  identityCommitment: z.string().optional(),
  metadata: z
    .object({
      source: z.string().max(200).optional(),
      dappName: z.string().max(100).optional(),
      url: z.string().url().max(500).optional().or(z.literal("")),
      intent: z
        .enum(["send", "claim", "swap", "approve", "grant-permissions", "contract-call", "other"])
        .optional(),
    })
    .optional(),
});
