"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/src/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Analysis" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-3xl backdrop-saturate-200 shadow-[0_1px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 text-white group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 transition-all duration-300 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]">
            <ShieldCheck className="h-4.5 w-4.5 text-primary" />
            {/* Pulse dot */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[0.25em] text-white/80 group-hover:text-white transition-colors">
              SENTINEL AI
            </div>
            <div className="text-[10px] text-white/35 tracking-wider">
              Intent-aware security
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg",
                    isActive
                      ? "text-white"
                      : "text-white/45 hover:text-white/75"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/[0.08]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="h-5 w-px bg-white/8" />

          <Link
            href="/dashboard"
            className={cn(
              "group inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-5 text-sm font-semibold text-primary",
              "transition-all duration-300 hover:bg-primary/10 hover:border-primary/30 hover:shadow-[0_0_25px_rgba(0,240,255,0.12)]"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Launch Console
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="md:hidden border-t border-white/5 bg-background/90 backdrop-blur-2xl px-6 pb-6"
        >
          <nav className="flex flex-col gap-2 pt-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "text-white bg-white/5"
                    : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              <Sparkles className="h-4 w-4" />
              Launch Console
            </Link>
          </nav>
        </motion.div>
      )}
    </motion.header>
  );
}
