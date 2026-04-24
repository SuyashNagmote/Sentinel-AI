"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  KeyRound,
  Radar,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import { BrowserProvider } from "ethers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { defaultDemoTransaction, demoTransactions } from "@/src/lib/demo-data";
import { cn, formatAddress, percentage } from "@/src/lib/utils";
import type { AnalysisResult, RiskFinding, TransactionPayload, UserIntent } from "@/src/modules/transaction/types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    __sentinelOriginalRequest?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }
}

const initialJson = JSON.stringify(defaultDemoTransaction, null, 2);
const intentOptions: Array<{ label: string; value: UserIntent }> = [
  { label: "Send funds", value: "send" },
  { label: "Claim airdrop", value: "claim" },
  { label: "Swap tokens", value: "swap" },
  { label: "Approve spending", value: "approve" },
  { label: "Grant permissions", value: "grant-permissions" },
  { label: "General contract call", value: "contract-call" },
  { label: "Other", value: "other" }
];

function parsePayload(input: string) {
  return JSON.parse(input) as TransactionPayload;
}

function updatePayload(input: string, updater: (payload: TransactionPayload) => TransactionPayload) {
  try {
    const payload = parsePayload(input);
    return JSON.stringify(updater(payload), null, 2);
  } catch {
    return input;
  }
}

function toneForSeverity(severity?: AnalysisResult["severity"]) {
  if (severity === "critical") {
    return {
      badge: "border-danger/25 bg-danger/10 text-danger",
      panel: "border-danger/35 shadow-danger",
      icon: ShieldAlert
    };
  }

  if (severity === "high") {
    return {
      badge: "border-warning/25 bg-warning/10 text-warning",
      panel: "border-warning/25",
      icon: ShieldAlert
    };
  }

  return {
    badge: "border-primary/25 bg-primary/10 text-primary",
    panel: "border-primary/15",
    icon: CheckCircle2
  };
}

export function ClientDashboard() {
  const [selectedDemo, setSelectedDemo] = useState<string>(demoTransactions[1].id);
  const [input, setInput] = useState(initialJson);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [walletStatus, setWalletStatus] = useState<string>("Wallet not connected");
  const [feedbackStatus, setFeedbackStatus] = useState<string>("");
  const [interceptorEnabled, setInterceptorEnabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const prettySeverity = useMemo(() => analysis?.severity.toUpperCase() ?? "READY", [analysis]);
  const findings: RiskFinding[] =
    analysis?.findings ?? [
      {
        id: "placeholder",
        title: "Waiting for transaction data",
        description: "Load a scenario and compare what the user intended with what the payload will actually do.",
        severity: "low",
        action: "Choose a preset or paste a payload to start."
      }
    ];
  const payloadIntent = useMemo(() => {
    try {
      return parsePayload(input).metadata?.intent ?? "other";
    } catch {
      return "other";
    }
  }, [input]);
  const tone = toneForSeverity(analysis?.severity);
  const VerdictIcon = tone.icon;

  useEffect(() => {
    const storedToken = window.localStorage.getItem("sentinelAuthToken");
    const storedAddress = window.localStorage.getItem("sentinelWalletAddress");

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedAddress) {
      setWalletAddress(storedAddress);
      setWalletStatus(`Connected as ${formatAddress(storedAddress)}`);
    }
  }, []);

  useEffect(() => {
    const selected = demoTransactions.find((item) => item.id === selectedDemo);
    if (!selected) return;
    setAnalysis(null);
    setError(null);
    setInput(JSON.stringify(selected.payload, null, 2));
  }, [selectedDemo]);

  useEffect(() => {
    if (!window.ethereum) return;

    if (!interceptorEnabled) {
      if (window.__sentinelOriginalRequest) {
        window.ethereum.request = window.__sentinelOriginalRequest;
      }
      return;
    }

    if (!window.__sentinelOriginalRequest) {
      window.__sentinelOriginalRequest = window.ethereum.request.bind(window.ethereum);
    }

    window.ethereum.request = async (args) => {
      if (args.method === "eth_sendTransaction" || args.method === "eth_signTransaction") {
        const tx = (args.params?.[0] ?? {}) as Record<string, unknown>;
        const payload: TransactionPayload = {
          chainId: Number(tx.chainId ?? 1),
          from: String(tx.from ?? walletAddress),
          to: String(tx.to ?? ""),
          value: String(tx.value ?? "0"),
          data: String(tx.data ?? "0x"),
          trusted: false,
          metadata: {
            source: "Wallet interceptor",
            dappName: "Connected wallet",
            intent: payloadIntent
          }
        };

        const preflight = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        }).then((response) => response.json());

        if (preflight.severity === "critical" || preflight.severity === "high") {
          throw new Error(`Sentinel blocked signing: ${preflight.verdict}`);
        }
      }

      return window.__sentinelOriginalRequest!(args);
    };
  }, [interceptorEnabled, payloadIntent, token, walletAddress]);

  const runAnalysis = () => {
    startTransition(async () => {
      setError(null);
      setAnalysis(null);

      try {
        const payload = parsePayload(input);
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to analyze transaction");
        }

        setAnalysis(data);
      } catch (analysisError) {
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "Unexpected error while analyzing transaction"
        );
      }
    });
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setWalletStatus("No injected wallet found");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum as never);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ address })
      });
      const nonceData = await nonceResponse.json();
      const signature = await signer.signMessage(`Sentinel AI authentication nonce: ${nonceData.nonce}`);
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ address, signature })
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verifyData.error ?? "Authentication failed");

      setWalletAddress(address);
      setToken(verifyData.token);
      window.localStorage.setItem("sentinelAuthToken", verifyData.token);
      window.localStorage.setItem("sentinelWalletAddress", address);
      setWalletStatus(`Connected as ${formatAddress(address)}`);
      setInput(
        updatePayload(input, (payload) => ({
          ...payload,
          from: address
        }))
      );
    } catch (walletError) {
      setWalletStatus(walletError instanceof Error ? walletError.message : "Wallet connection failed");
    }
  };

  const sendFeedback = async (verdict: "correct" | "false-positive" | "false-negative") => {
    if (!token) {
      setFeedbackStatus("Connect wallet auth to submit feedback.");
      return;
    }

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ verdict })
    });

    const data = await response.json();
    setFeedbackStatus(response.ok ? "Feedback captured for future tuning." : data.error ?? "Feedback failed");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Transaction intake workspace</CardTitle>
                <CardDescription>
                  Feed Sentinel the raw payload, declare user intent, and decide whether wallet interception should be active.
                </CardDescription>
              </div>
              <Badge className="bg-white/[0.07] text-white/80">{prettySeverity}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Wallet authentication</div>
                    <p className="mt-1 text-sm text-white/60">{walletStatus}</p>
                  </div>
                  <Button variant="secondary" onClick={connectWallet}>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Interceptor</div>
                    <p className="mt-1 text-sm text-white/60">
                      {interceptorEnabled
                        ? "Intercepting provider requests from this session."
                        : "Disabled. Turn on to preflight transaction sends from this app."}
                    </p>
                  </div>
                  <Button
                    variant={interceptorEnabled ? "danger" : "secondary"}
                    onClick={() => setInterceptorEnabled((value) => !value)}
                  >
                    {interceptorEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_220px_1fr]">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Scenario</div>
                <Select value={selectedDemo} onValueChange={setSelectedDemo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {demoTransactions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Expected intent</div>
                <Select
                  value={payloadIntent}
                  onValueChange={(value) =>
                    setInput(
                      updatePayload(input, (payload) => ({
                        ...payload,
                        metadata: {
                          ...payload.metadata,
                          intent: value as UserIntent
                        }
                      }))
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose intent" />
                  </SelectTrigger>
                  <SelectContent>
                    {intentOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Decoded action</div>
                <Input
                  placeholder="Detected transaction type will appear here"
                  value={analysis?.decoded.kind ?? ""}
                  readOnly
                  className="text-white/60"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                spellCheck={false}
                className="min-h-[360px] border-0 bg-transparent font-mono text-[13px] leading-6"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runAnalysis} disabled={isPending}>
                <Sparkles className="mr-2 h-4 w-4" />
                {isPending ? "Analyzing transaction..." : "Analyze before signing"}
              </Button>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/60">
                Intent mismatch, permit abuse, novelty, batched-call risk, and policy integrity are all surfaced here.
              </div>
            </div>

            {error ? (
              <div className="rounded-[24px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-foreground">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Why this matters</CardTitle>
            <CardDescription>
              A strong security product does not just say something is dangerous. It explains why.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(analysis?.reasons ?? [
              "Sentinel will surface the strongest reasons for a block or review decision here.",
              "Signals combine declared intent, transaction structure, destination context, and policy rules."
            ]).map((reason) => (
              <div key={reason} className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-sm leading-6 text-white/75">
                {reason}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className={cn("overflow-hidden", tone.panel)}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <VerdictIcon className={cn("h-6 w-6", analysis?.severity === "critical" ? "text-danger" : analysis?.severity === "high" ? "text-warning" : "text-primary")} />
                    {analysis?.verdict ?? "Awaiting analysis"}
                  </CardTitle>
                  <CardDescription>
                    AI explains the result, but the final signing verdict comes from deterministic policy.
                  </CardDescription>
                </div>
                <Badge className={cn("border-white/10", tone.badge)}>
                  {analysis ? `${percentage(analysis.confidence)} confidence` : "Ready"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">Risk score</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{analysis ? percentage(analysis.score) : "0%"}</div>
                  <div className="mt-3">
                    <Progress value={analysis ? analysis.score * 100 : 0} />
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">Intent match</div>
                  <div className="mt-3 text-xl font-semibold text-white">
                    {analysis ? (analysis.intent.matches ? "Aligned" : "Mismatch") : "Pending"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {analysis?.intent.explanation ??
                      "Sentinel compares what the user meant to do with what the payload actually does."}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">Policy mode</div>
                  <div className="mt-3 text-xl font-semibold text-white">
                    {analysis?.signingPolicy.mode ?? "allow"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {analysis?.signingPolicy.reason ?? "Signing policy details will appear here after analysis."}
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/8 bg-white/[0.05] p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Human-readable explanation</div>
                <p className="mt-3 text-sm leading-7 text-white/80">
                  {analysis?.summary ?? "Sentinel AI will translate raw calldata into a plain-language explanation here."}
                </p>
              </div>

              <div className="grid gap-3">
                {findings.map((finding, index) => (
                  <motion.div
                    key={finding.id}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={cn(
                      "rounded-[24px] border px-4 py-4",
                      finding.severity === "critical" && "border-danger/35 bg-danger/10",
                      finding.severity === "high" && "border-warning/35 bg-warning/10",
                      (finding.severity === "medium" || finding.severity === "low") && "border-white/10 bg-white/[0.05]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 h-5 w-5",
                          finding.severity === "critical" && "text-danger",
                          finding.severity === "high" && "text-warning",
                          (finding.severity === "medium" || finding.severity === "low") && "text-primary"
                        )}
                      />
                      <div className="space-y-1">
                        <div className="font-semibold text-white">{finding.title}</div>
                        <p className="text-sm leading-6 text-white/72">{finding.description}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">{finding.action}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" onClick={() => sendFeedback("correct")}>
                  Verdict correct
                </Button>
                <Button variant="secondary" size="sm" onClick={() => sendFeedback("false-positive")}>
                  False positive
                </Button>
                <Button variant="secondary" size="sm" onClick={() => sendFeedback("false-negative")}>
                  False negative
                </Button>
              </div>
              {feedbackStatus ? <div className="text-sm text-white/60">{feedbackStatus}</div> : null}
            </CardContent>
          </Card>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Intent, simulation, and chain context</CardTitle>
            <CardDescription>
              Context-rich analysis is what makes security warnings feel trustworthy instead of generic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  Intent comparison
                </div>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {analysis
                    ? `Declared intent: ${analysis.intent.declared ?? "none"}. Inferred action: ${analysis.intent.inferred}. ${analysis.intent.explanation}`
                    : "Declare what the user is trying to do, then Sentinel will compare that with the decoded action."}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ScanSearch className="h-4 w-4 text-primary" />
                  Simulation honesty
                </div>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {analysis
                    ? `Mode: ${analysis.simulation.mode}. ${analysis.simulation.limitations[0]}`
                    : "Simulation output is clearly labeled advisory so the system never over-claims certainty."}
                </p>
              </div>
            </div>

            {(analysis?.effects ?? []).length > 0 ? (
              analysis?.effects.map((effect, index) => (
                <motion.div
                  key={`${effect.label}-${index}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Wallet className="h-5 w-5 text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{effect.label}</div>
                        <div className="text-sm text-white/50">
                          {formatAddress(effect.from)} <ArrowRight className="inline h-3 w-3" /> {formatAddress(effect.to)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">{effect.amount}</div>
                      <div className="text-sm text-white/50">{effect.asset}</div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/12 bg-white/4 p-5 text-sm text-white/55">
                No effects yet. Run an analysis to see assets or permissions moving across the graph.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Radar className="h-4 w-4 text-primary" />
                  Chain context
                </div>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {analysis
                    ? `Source: ${analysis.chainContext.source}. Call outcome: ${analysis.chainContext.callOutcome}. Gas insight: ${analysis.chainContext.gasInsight ?? "n/a"}.`
                    : "When RPC access is available, Sentinel supplements heuristics with live call and gas context."}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Activity className="h-4 w-4 text-primary" />
                  Reputation and behavior
                </div>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {analysis
                    ? `Destination: ${analysis.reputation.destinationLabel}. Novelty: ${analysis.reputation.userNovelty}. Similar calls: ${analysis.reputation.recentSimilarTransactions}. Domain risk: ${analysis.reputation.domainRisk}.`
                    : "Sentinel uses destination reputation, new-counterparty detection, and simple wallet baselines to add context."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Integrity and deployment posture</CardTitle>
            <CardDescription>
              These are the product trust signals operators and judges will care about.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Integrity record
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {analysis
                  ? `Verification ID ${analysis.resultIntegrity.verificationId}. Digest ${analysis.resultIntegrity.publicDigest.slice(0, 18)}... verifier ${analysis.resultIntegrity.verifier}.`
                  : "Each analysis result is signed and tagged with a public digest for operator visibility."}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <KeyRound className="h-4 w-4 text-primary" />
                Policy and auth
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {analysis
                  ? `${analysis.signingPolicy.reason} Auth: ${analysis.telemetry.authMode}. Rate limiting: ${analysis.telemetry.rateLimitMode}.`
                  : "Wallet-signature authentication and explicit policy decisions are surfaced alongside every analysis."}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Attestation record
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {analysis
                  ? `${analysis.attestation.record.attestationId} ${analysis.attestation.accepted ? "accepted" : "rejected"} with policy ${analysis.attestation.record.policy}.`
                  : "Sentinel stores replay-resistant policy records without pretending this layer is real zero-knowledge."}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Intelligence summary
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {analysis
                  ? `${analysis.intelligence.sourceCount} sources combined. Matched signals: ${analysis.intelligence.matchedSignals.slice(0, 4).join(", ") || "none"}.`
                  : "Local blocklists, domain heuristics, novelty signals, and transaction structure all contribute to the final verdict."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
