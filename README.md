# Sentinel AI - Web3 Transaction Firewall

🔗 Live Demo: https://sentinel-ai-111885796030.asia-south1.run.app

> “Don’t sign what you don’t understand.”

Sentinel AI prevents wallet drains by analyzing transactions before they are signed.

## The Problem

Billions in Web3 losses do not come from protocol hacks — they come from users signing malicious transactions.

Wallets expose raw calldata. Users guess. Attackers exploit that gap.

## The Solution

Sentinel AI is a real-time transaction firewall for Web3.

It sits between the user and the blockchain, intercepts transactions before signing, simulates their effects, and blocks malicious activity with clear, human-readable explanations powered by Google Gemini.

## How It Works

Every transaction passes through a deterministic analysis pipeline:

* **Intercept** — Captures `eth_sendTransaction`
* **Simulate** — RPC-based estimation (with fallback heuristics)
* **Decode** — Extracts intent (transfers, approvals, multicalls, permits)
* **Evaluate** — Risk engine + threat intelligence
* **Explain** — Plain English via Google Gemini
* **Enforce** — Allow / Warn / Block

## What It Detects

* Unlimited token approvals (drainers)
* Hidden actions inside multicalls
* Phishing contracts and malicious proxies
* First-time interactions (novelty risk)
* Suspicious retry patterns

## Real-World Integration

### Browser Extension

* Intercepts transactions before signing
* Displays secure overlay
* Blocks or allows with one click

### Intelligence Layer

* Threat Intel: GoPlus Security
* Reputation Engine: PostgreSQL
* Recursive Decoding for nested calls

## Security & Integrity

* **Post-Quantum Signatures** (ML-DSA-65)
* **ZK-Inspired Merkle Commitments** (Poseidon hashing)

## Tech Stack

* Frontend: Next.js 15, React 19
* Backend: Node.js, PostgreSQL
* Web3: ethers.js
* AI: Google Gemini
* Crypto: @noble/post-quantum
* ZK: circomlibjs

## Getting Started

```bash
git clone <repo-url>
cd sentinel-ai
npm install
cp .env.example .env.local
npm run dev
```

## Required Config

* DATABASE_URL
* RPC_URL
* GEMINI_API_KEY

## Demo Flow

1. Open a Web3 dApp
2. Initiate transaction
3. Sentinel analyzes
4. Shows explanation
5. Blocks or allows

## Why It Matters

* Prevents real-world wallet drain attacks
* Explains transactions clearly
* Stops malicious actions before signing

## License

MIT License
