import { NextResponse } from "next/server";
import { z } from "zod";

import { recordFeedback } from "@/src/modules/database/repository";
import { verifyToken } from "@/src/modules/security/auth";
import { enforceRateLimit } from "@/src/modules/security/rate-limit";

const schema = z.object({
  verdict: z.enum(["correct", "false-positive", "false-negative"]),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const session = token ? verifyToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rate = await enforceRateLimit(`feedback:${session.address}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = schema.parse(await request.json());
  await recordFeedback(session.address, body.verdict, body.notes);
  return NextResponse.json({ ok: true });
}
