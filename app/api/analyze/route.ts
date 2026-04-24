import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { analyzeTransaction } from "@/src/modules/pipeline/analyze-transaction";
import { verifyToken } from "@/src/modules/security/auth";
import { enforceRateLimit } from "@/src/modules/security/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const rate = await enforceRateLimit(`analyze:${ip}`, 120, 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const session = token ? verifyToken(token) : null;
    const body = await request.json();
    const result = await analyzeTransaction(body, session?.address);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid transaction payload",
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected analysis error",
      },
      { status: 500 }
    );
  }
}
