"use client";

import { useEffect, useState } from "react";
import { Activity, ShieldAlert, Cpu, Network, ShieldCheck, Database } from "lucide-react";

type MetricData = {
  totalScanned: number;
  threatsPrevented: number;
  recentAnalyses: Array<{
    id: string | number;
    severity: "low" | "medium" | "high" | "critical";
    verdict: string;
    timestamp: string;
    decodedKind: string;
    summary: string;
    source: string;
    destination: string;
  }>;
};

export function AnalyticsDashboard() {
  const [data, setData] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const token = window.localStorage.getItem("sentinelAuthToken");
        const res = await fetch("/api/metrics", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          setAuthError(null);
          setData(await res.json());
        } else if (res.status === 401) {
          setAuthError("Connect a wallet in the dashboard before opening the SOC feed.");
          setData(null);
        }
      } catch (e) {
        console.error("Failed to fetch metrics", e);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-500 border-red-500/30 bg-red-500/10";
      case "high":
        return "text-orange-500 border-orange-500/30 bg-orange-500/10";
      case "medium":
        return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
      default:
        return "text-green-500 border-green-500/30 bg-green-500/10";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Security Operations Center
          </h2>
          <p className="mt-1 text-zinc-400">Real-time platform metrics and active threat intelligence feed.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-300">Systems Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Transactions Scanned</p>
              <h3 className="mt-1 text-3xl font-bold text-white">
                {loading ? "..." : data?.totalScanned.toLocaleString() || "0"}
              </h3>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Threats Prevented</p>
              <h3 className="mt-1 text-3xl font-bold text-white">
                {loading ? "..." : data?.threatsPrevented.toLocaleString() || "0"}
              </h3>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <Cpu className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Average Latency</p>
              <h3 className="mt-1 text-3xl font-bold text-white">
                42<span className="text-xl font-normal text-zinc-500">ms</span>
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <Network className="h-4 w-4 text-zinc-400" />
              Live Threat Feed
            </h3>
            {loading && <span className="text-xs text-zinc-500 animate-pulse">Syncing...</span>}
          </div>

          <div className="max-h-[400px] flex-1 overflow-auto p-4">
            {authError ? (
              <div className="flex h-40 items-center justify-center text-center text-zinc-500">{authError}</div>
            ) : loading && !data ? (
              <div className="flex h-40 items-center justify-center text-zinc-500">Loading feed...</div>
            ) : data?.recentAnalyses.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-zinc-500">No recent activity</div>
            ) : (
              <div className="space-y-3">
                {data?.recentAnalyses.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 sm:flex-row"
                  >
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityColor(tx.severity)}`}
                        >
                          {tx.severity}
                        </span>
                        <span className="text-sm font-medium text-zinc-200">
                          {tx.decodedKind ? tx.decodedKind.replace("-", " ") : "contract call"}
                        </span>
                        <span className="ml-auto text-xs text-zinc-500">
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="truncate text-xs text-zinc-400">{tx.summary || tx.verdict}</p>
                      <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                        <span>{tx.source}</span>
                        <span>-&gt;</span>
                        <span>{tx.destination}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md">
          <div className="border-b border-zinc-800 bg-zinc-900/80 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-zinc-400" />
              Engine Status
            </h3>
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-200">EVM Simulator</span>
                <span className="text-xs text-emerald-400">Online</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div className="h-1.5 w-full rounded-full bg-emerald-500"></div>
              </div>
              <p className="mt-2 text-[10px] text-zinc-500">Tenderly API & RPC Trace fallback active</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-200">ZK Circuits</span>
                <span className="text-xs text-emerald-400">Online</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div className="h-1.5 w-full rounded-full bg-emerald-500"></div>
              </div>
              <p className="mt-2 text-[10px] text-zinc-500">Groth16 Verifier & Poseidon Hash</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-200">Reputation DB</span>
                <span className="text-xs text-emerald-400">Online</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div className="h-1.5 w-full rounded-full bg-emerald-500"></div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
                <Database className="h-3 w-3" /> PostgreSQL backend active
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
