"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  FileSearch,
  Fingerprint,
  Lock,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";

import {
  Reveal,
  StaggerContainer,
  StaggerItem,
  Parallax,
  MagneticButton,
  TextScramble,
  AnimatedCounter,
  GlowCard,
} from "@/components/motion/effects";
import { DashboardPreview } from "@/components/dashboard-preview";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/src/lib/utils";

const AmbientBackground = dynamic(
  () => import("@/components/ambient-bg").then((m) => m.AmbientBackground),
  { ssr: false }
);

const pillars = [
  {
    icon: FileSearch,
    title: "Intent Extraction",
    description:
      "Decodes nested multicalls, approvals, and permits into clear, auditable language humans can actually read.",
    gradient: "from-cyan-500/10 to-transparent",
  },
  {
    icon: ShieldAlert,
    title: "Drainer Detection",
    description:
      "Identifies unlimited approvals, novelty address spikes, and known drainer patterns before they can execute.",
    gradient: "from-red-500/10 to-transparent",
  },
  {
    icon: BrainCircuit,
    title: "AI Risk Engine",
    description:
      "Deterministic rule engine combined with AI explanations. Strict, auditable policy outcomes every time.",
    gradient: "from-violet-500/10 to-transparent",
  },
  {
    icon: Fingerprint,
    title: "Quantum-Resistant",
    description:
      "Every verdict is cryptographically anchored with ML-DSA-65 Post-Quantum signatures. Future-proof integrity.",
    gradient: "from-emerald-500/10 to-transparent",
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden noise-overlay">
      <AmbientBackground />
      <SiteHeader />

      {/* ═══════════════════════════════════════════════
          HERO — Typography-first, let the message breathe
          ═══════════════════════════════════════════════ */}
      <section className="relative z-10 pt-24 pb-8 md:pt-36 md:pb-16">
        <div className="container-shell">
          <div className="max-w-[820px]">
            <Reveal delay={0.05}>
              <div className="flex gap-3 mb-8">
                <Badge className="border-danger/25 bg-danger/8 text-danger text-[11px] px-3.5 py-1.5 font-medium">
                  <span className="relative flex h-1.5 w-1.5 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger" />
                  </span>
                  Blind Signing is a Security Vulnerability
                </Badge>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <h1 className="text-[clamp(2.5rem,6vw,5.2rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
                <TextScramble text="Users sign transactions" delay={0.2} />
                <br />
                <TextScramble text="they can't " delay={0.5} />
                <span className="text-stream">
                  <TextScramble text="understand." delay={0.7} />
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.4}>
              <p className="mt-7 max-w-[560px] text-[17px] leading-[1.75] text-white/40">
                Wallets show raw hex. Users click approve. Attackers drain everything.
                Sentinel intercepts transactions, explains what they actually do,
                and blocks the dangerous ones — with quantum-resistant proof.
              </p>
            </Reveal>

            <Reveal delay={0.55}>
              <div className="flex flex-wrap items-center gap-4 mt-10">
                <MagneticButton>
                  <Link
                    href="/dashboard"
                    className={cn(
                      "group inline-flex h-[52px] items-center gap-2.5 rounded-xl bg-white px-7 text-[14px] font-semibold text-[#0a0a0a]",
                      "transition-all duration-300 hover:shadow-[0_0_50px_rgba(255,255,255,0.15)]"
                    )}
                  >
                    Open Console
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <Link
                    href="#how-it-works"
                    className={cn(
                      "inline-flex h-[52px] items-center gap-2 rounded-xl border border-white/10 px-7 text-[14px] font-medium text-white/60",
                      "transition-all duration-300 hover:text-white/90 hover:border-white/20 hover:bg-white/[0.03]"
                    )}
                  >
                    How it works
                  </Link>
                </MagneticButton>
              </div>
            </Reveal>

            <Reveal delay={0.7}>
              <div className="flex items-center gap-6 mt-12 text-[12px] text-white/25">
                <div className="flex items-center gap-2 font-mono tracking-wider">
                  <Fingerprint className="h-3.5 w-3.5 text-primary/40" />
                  ML-DSA-65
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-2 font-mono tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary/40" />
                  Post-Quantum Signed
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="font-mono tracking-wider">
                  ZK Nullifiers
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRODUCT DEMO — The actual dashboard preview
          ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-12 md:py-20">
        <div className="container-shell">
          <DashboardPreview />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          METRICS — Quiet confidence
          ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 border-y border-white/[0.04]">
        <div className="container-shell">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-8" stagger={0.08}>
            {[
              { value: 15, suffix: "+", label: "Threat signals analyzed", sub: "Per transaction" },
              { value: 4, suffix: "", label: "Intelligence sources", sub: "Cross-referenced" },
              { value: 100, suffix: "%", label: "Deterministic verdicts", sub: "Rules-based, auditable" },
              { value: 3309, suffix: "B", label: "PQC signature size", sub: "ML-DSA-65 Dilithium" },
            ].map((m) => (
              <StaggerItem key={m.label}>
                <div>
                  <div className="text-3xl md:text-4xl font-semibold text-white font-mono tracking-tight">
                    <AnimatedCounter value={m.value} suffix={m.suffix} />
                  </div>
                  <div className="text-sm text-white/50 mt-2">{m.label}</div>
                  <div className="text-xs text-white/20 mt-1">{m.sub}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          THE PROBLEM — Side by side contrast
          ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 md:py-20">
        <div className="container-shell">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <Reveal direction="left">
              <div className="space-y-6">
                <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-danger/70">The problem</p>
                <h2 className="text-3xl md:text-[2.75rem] font-semibold leading-[1.15] tracking-tight">
                  Wallets ask you to sign.
                  <span className="text-white/25"> They never explain what.</span>
                </h2>
                <p className="text-[16px] text-white/40 leading-[1.8] max-w-lg">
                  The entire Web3 signing UX is broken. Users see raw hex,
                  unreadable function selectors, and zero context. This isn&apos;t
                  a design problem — it&apos;s a security hole that costs billions.
                </p>
                <div className="flex gap-5 pt-4">
                  {[
                    ["$1.7B+", "Drained in 2024"],
                    ["89%", "Can\u2019t read calldata"],
                  ].map(([val, label]) => (
                    <div key={label}>
                      <div className="text-2xl font-semibold text-danger font-mono">{val}</div>
                      <div className="text-xs text-white/30 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal direction="right" delay={0.15}>
              <div className="rounded-2xl border border-primary/15 bg-white/[0.02] p-6 font-mono text-[13px] leading-7 shadow-[0_0_40px_rgba(0,240,255,0.06)] ring-1 ring-primary/[0.08]">
                <div className="text-white/20 mb-4 text-xs">// What your wallet shows</div>
                <div className="space-y-1.5 text-white/40">
                  <div><span className="text-danger/60">to:</span> 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D</div>
                  <div><span className="text-danger/60">data:</span> 0x095ea7b3000000000000000000000000...</div>
                  <div><span className="text-danger/60">value:</span> 0</div>
                </div>
                <div className="my-5 border-t border-white/[0.04]" />
                <div className="text-primary/40 mb-4 text-xs">// What Sentinel reveals</div>
                <div className="space-y-2">
                  <div className="text-warning/80">⚠ UNLIMITED approval to unknown contract</div>
                  <div className="text-danger/80">⛔ Contract deployed 2 hours ago</div>
                  <div className="text-danger/80">⛔ No verified source code on Etherscan</div>
                  <div className="text-primary/70">→ Intent mismatch detected</div>
                  <div className="text-white/50 mt-3">Verdict: <span className="text-danger font-semibold">BLOCK</span> · Score: <span className="text-danger">0.95</span></div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          DEFENSE PILLARS
          ═══════════════════════════════════════════════ */}
      <section className="relative z-10 pb-16 md:pb-20">
        <div className="container-shell">
          <Reveal className="mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-primary/60 mb-4">Architecture</p>
            <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-tight max-w-lg">
              Four layers between the user and a bad signature.
            </h2>
          </Reveal>

          <StaggerContainer className="grid md:grid-cols-2 gap-4" stagger={0.1}>
            {pillars.map((pillar, i) => (
              <StaggerItem key={pillar.title}>
                <GlowCard>
                  <div className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient}`} />
                  <div className="relative p-7 md:p-8">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] mb-5">
                      <pillar.icon className="h-5 w-5 text-white/60" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{pillar.title}</h3>
                    <p className="text-sm leading-[1.8] text-white/35">{pillar.description}</p>
                  </div>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          HOW IT WORKS — Clean timeline
          ═══════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-16 md:py-20 border-t border-white/[0.04]">
        <div className="container-shell">
          <Reveal className="mb-16">
            <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-primary/60 mb-4">Pipeline</p>
            <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-tight">
              From raw payload to safety verdict.
            </h2>
          </Reveal>

          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.1}>
            {[
              {
                icon: Radar,
                step: "01",
                title: "Intercept",
                text: "Transaction payloads are captured at the wallet layer. Calldata is parsed, selectors matched, multicall structures unpacked.",
              },
              {
                icon: Zap,
                step: "02",
                title: "Simulate",
                text: "Decoded transactions are dry-run against RPC state. Token deltas, approval changes, and ETH flows are extracted.",
              },
              {
                icon: ShieldAlert,
                step: "03",
                title: "Score",
                text: "15+ signals are evaluated: address novelty, deny-lists, domain reputation, chain context. A severity verdict is produced.",
              },
              {
                icon: Lock,
                step: "04",
                title: "Attest",
                text: "The verdict is sealed with ML-DSA-65 Post-Quantum signatures and anchored with Poseidon nullifiers for replay protection.",
              },
            ].map((item, i) => (
              <StaggerItem key={item.step}>
                <GlowCard className="h-full">
                  <div className="p-7 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <item.icon className="h-4.5 w-4.5 text-white/50" />
                      </div>
                      <span className="text-xs font-mono text-white/15 tracking-widest">{item.step}</span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm leading-[1.8] text-white/30 flex-1">{item.text}</p>
                  </div>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          CTA — Simple, confident
          ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 md:py-20 border-t border-white/[0.04]">
        <div className="container-shell">
          <Parallax speed={0.1}>
            <Reveal>
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-tight leading-[1.15] mb-6">
                  Stop signing what you
                  <br />
                  <span className="text-stream">can&apos;t read.</span>
                </h2>
                <p className="text-[16px] text-white/35 leading-[1.8] mb-10 max-w-md mx-auto">
                  Every transaction should be understood before it&apos;s signed.
                  Sentinel makes that possible.
                </p>
                <MagneticButton className="inline-block">
                  <Link
                    href="/dashboard"
                    className={cn(
                      "group inline-flex h-[52px] items-center gap-2.5 rounded-xl bg-white px-8 text-[14px] font-semibold text-[#0a0a0a]",
                      "transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.12)]"
                    )}
                  >
                    Launch Security Console
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </Link>
                </MagneticButton>
              </div>
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="container-shell py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {/* Left — Branding */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
              </div>
              <div>
                <div className="text-[12px] font-semibold tracking-[0.2em] text-white/50">SENTINEL AI</div>
                <div className="text-[10px] text-white/20">Intent-aware transaction security</div>
              </div>
            </div>

            {/* Center — Links */}
            <div className="flex items-center gap-6 text-[12px] text-white/30">
              <Link href="/dashboard" className="hover:text-white/60 transition-colors">Dashboard</Link>
              <Link href="#how-it-works" className="hover:text-white/60 transition-colors">How it Works</Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">GitHub</a>
              <a href="#" className="hover:text-white/60 transition-colors">Docs</a>
            </div>

            {/* Right — Tech badges */}
            <div className="flex items-center gap-3 text-[10px] font-mono tracking-wider text-white/15">
              <span className="px-2 py-1 rounded border border-white/[0.04] bg-white/[0.02]">ML-DSA-65</span>
              <span className="px-2 py-1 rounded border border-white/[0.04] bg-white/[0.02]">PQC Verified</span>
              <span className="px-2 py-1 rounded border border-white/[0.04] bg-white/[0.02]">ZK Nullifiers</span>
            </div>
          </div>

          {/* Bottom line */}
          <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-4 text-[10px] text-white/15">
            <span>© {new Date().getFullYear()} Sentinel AI. All rights reserved.</span>
            <span>Built with Post-Quantum Cryptography</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
