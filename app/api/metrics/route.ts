import { NextResponse } from "next/server";
import { getPlatformMetrics } from "@/src/modules/database/repository";
import { verifyToken } from "@/src/modules/security/auth";
import { enforceRateLimit } from "@/src/modules/security/rate-limit";

export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const rate = await enforceRateLimit(`metrics:${ip}`, 30, 60_000);
    
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.replace("Bearer ", "");
    const session = bearerToken ? verifyToken(bearerToken) : null;
    const metricsKey = request.headers.get("x-metrics-key");
    const hasMetricsKey = Boolean(process.env.METRICS_READ_TOKEN) && metricsKey === process.env.METRICS_READ_TOKEN;

    if (!session && !hasMetricsKey) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const metrics = await getPlatformMetrics();
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch platform metrics" },
      { status: 500 }
    );
  }
}
