import { z } from "zod";

export const transactionPayloadSchema = z.object({
  chainId: z.number().int().positive(),
  from: z.string().min(2),
  to: z.string().min(2),
  value: z.string().min(1),
  data: z.string().min(2),
  tokenSymbol: z.string().optional(),
  tokenDecimals: z.number().int().nonnegative().optional(),
  trusted: z.boolean().optional(),
  identityCommitment: z.string().optional(),
  metadata: z
    .object({
      source: z.string().optional(),
      dappName: z.string().optional(),
      url: z.string().optional(),
      intent: z
        .enum(["send", "claim", "swap", "approve", "grant-permissions", "contract-call", "other"])
        .optional()
    })
    .optional()
});
