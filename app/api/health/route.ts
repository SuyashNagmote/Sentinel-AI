import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string | number> = {
    status: "ok",
    service: "sentinel-ai",
  };

  // Verify PostgreSQL connectivity
  if (process.env.DATABASE_URL) {
    try {
      const { getAnalysisCount } = await import("@/src/modules/database/postgres");
      await getAnalysisCount();
      checks.database = "connected";
    } catch {
      checks.database = "unavailable";
    }
  } else {
    checks.database = "not_configured";
  }

  return NextResponse.json({
    ...checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
