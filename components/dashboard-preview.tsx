"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";

/**
 * A polished, styled preview of the analysis dashboard —
 * shows what the product actually does without running it.
 */
export function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative"
    >
      {/* Glow behind the preview */}
      <div className="absolute -inset-8 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent rounded-[40px] blur-2xl" />

      {/* Browser chrome */}
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#060e18]/90 backdrop-blur-xl overflow-hidden shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)]">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3.5">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-white/10" />
            <div className="h-3 w-3 rounded-full bg-white/10" />
            <div className="h-3 w-3 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-4 py-1.5 text-[11px] text-white/30 font-mono">
              <ShieldCheck className="h-3 w-3 text-primary/50" />
              sentinel-ai.io/dashboard
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/15 px-2.5 py-1 text-[9px] font-mono text-primary tracking-wider">
              <Fingerprint className="h-2.5 w-2.5" />
              PQC
            </div>
          </div>
        </div>

        {/* Dashboard content mockup */}
        <div className="grid md:grid-cols-[1fr_1fr] gap-px bg-white/[0.03]">
          {/* Left panel — Input */}
          <div className="p-6 space-y-4 bg-[#060e18]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/25 font-mono">Threat Intake</div>

            {/* Fake input fields */}
            <div className="space-y-3">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] text-white/25 mb-1.5">Recipient</div>
                <div className="text-xs font-mono text-white/50">0x7a25...c3f2</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] text-white/25 mb-1.5">Calldata</div>
                <div className="text-xs font-mono text-danger/60 leading-5">
                  0x095ea7b3000000000000<br />
                  00000000000000000000ff<br />
                  ffffffffffffffffffffff...
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] text-white/25 mb-1.5">User Intent</div>
                <div className="text-xs text-white/50">&quot;Swap 100 USDC to ETH&quot;</div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                Analyze Transaction
              </div>
            </div>
          </div>

          {/* Right panel — Results */}
          <div className="p-6 space-y-4 bg-[#060e18]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/25 font-mono">Analysis Result</div>

            {/* Verdict */}
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-danger" />
                  <span className="text-sm font-semibold text-danger">Drain Risk Detected</span>
                </div>
                <div className="text-2xl font-bold font-mono text-danger">0.95</div>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-danger to-danger/60"
                  initial={{ width: 0 }}
                  whileInView={{ width: "95%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Findings */}
            <div className="space-y-2">
              {[
                { icon: AlertTriangle, text: "Unlimited token approval to unverified contract", color: "text-danger" },
                { icon: AlertTriangle, text: "Intent mismatch: user said 'swap' but tx is 'approve'", color: "text-warning" },
                { icon: CheckCircle2, text: "Nullifier recorded — replay protected", color: "text-primary" },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 + i * 0.15 }}
                  className="flex items-start gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
                >
                  <f.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${f.color}`} />
                  <span className="text-xs text-white/50 leading-5">{f.text}</span>
                </motion.div>
              ))}
            </div>

            {/* PQC Badge */}
            <div className="flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 p-3">
              <Fingerprint className="h-3.5 w-3.5 text-primary" />
              <div className="text-[10px] font-mono text-primary/60 tracking-wider">
                ML-DSA-65 SIGNED · verify_a3f8c1d02b
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
