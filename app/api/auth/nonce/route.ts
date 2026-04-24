import { NextResponse } from "next/server";
import { z } from "zod";

import { issueNonce } from "@/src/modules/security/auth";
import { enforceRateLimit } from "@/src/modules/security/rate-limit";

const schema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rate = await enforceRateLimit(`nonce:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = schema.parse(await request.json());
  const nonce = await issueNonce(body.address);
  return NextResponse.json({
    nonce,
    message: `Sentinel AI authentication nonce: ${nonce}`,
  });
}
