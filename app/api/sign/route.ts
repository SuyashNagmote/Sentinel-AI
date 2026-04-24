import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { guardSignTransaction } from "@/src/modules/pipeline/sign-transaction";
import { verifyToken } from "@/src/modules/security/auth";
import { enforceRateLimit } from "@/src/modules/security/rate-limit";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const session = token ? verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rate = await enforceRateLimit(`sign:${session.address}`, 40, 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const result = await guardSignTransaction(body);
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
        error: error instanceof Error ? error.message : "Unexpected signing guard error",
      },
      { status: 500 }
    );
  }
}
