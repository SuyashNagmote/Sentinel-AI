# Sentinel AI

> "Understand before you sign. Stop wallet drains before they happen."

Sentinel AI is a Web3 security layer that prevents "blind signing."

It intercepts transactions before they are signed, explains what they actually do in plain English, and blocks drainers, phishing attempts, and malicious approvals in real time.

Every analysis result is protected using **Post-Quantum Cryptography (ML-DSA-65)** and anchored with **ZK-inspired Merkle commitments (Poseidon hashing)** to ensure tamper-resistant integrity.

## 💥 Why It Matters

Most Web3 losses don’t come from protocol hacks — they come from users signing malicious transactions they don’t understand.

Sentinel AI prevents this by acting as a real-time security layer between the user and the blockchain, stopping harmful actions before they are executed. By bridging the gap between complex calldata and user comprehension, we turn a vulnerable signing process into an informed, protected action.

## ⚙️ How It Works

1. **Intercepts** transaction before signing.
2. **Decodes** calldata into human-readable actions.
3. **Simulates** expected effects (heuristic preview of outcomes).
4. **Evaluates** risk using deterministic rules + live threat intelligence.
5. **Compares** with the user's declared intent.
6. **Generates** an explanation + confidence score.
7. **Applies** the policy: Allow / Warn / Block.

## 🧠 What Makes Sentinel AI Different

- **Intent Mismatch Detection**: Identifies when a transaction does not match what the user believes they are doing — the root cause of most wallet drains.
- **Deterministic Safety Decisions**: Final verdicts come from auditable rules, not AI guesswork.
- **Pre-Sign Interception**: Stops attacks before execution, not after damage.
- **Future-Proof Integrity**: Uses post-quantum cryptography to secure results against emerging threats.

## 🛡️ Core Defense Pillars

1. **Intent Extraction**: Decodes opaque calldata (nested multicalls, approvals, permits) into human-readable actions and checks them against the user's declared intent.
2. **Real-Time Threat Intel**: Integrated with the GoPlus Security API to instantly flag known drainers, honeypot tokens, phishing activities, and malicious proxy contracts.
3. **Risk Engine**: Deterministic policy engine with optional AI-generated explanations.
4. **Quantum-Resistant Integrity**: Every verdict is cryptographically anchored using ML-DSA-65 (Dilithium) Post-Quantum signatures and ZK-inspired data structures.

## 🎬 Example

**User intent:** "Claim Airdrop"

**Actual transaction:**
- Grants unlimited USDC approval to an unknown contract.

**Sentinel AI:**
- ❌ **Blocks** the transaction.
- ⚠️ **Explains:** “This allows the contract to drain your funds later.”
- 🧠 **Flags:** Intent mismatch (Claim vs. Unlimited Approval).

## 🚀 Features

- **Security Operations Dashboard**: SOC-style interface with real-time transaction decoding, risk scoring, and policy decisions.
- **Persistent Data Storage**: Robust, high-concurrency `better-sqlite3` database with Write-Ahead Logging (WAL) for analysis logs, feedback, and attestations.
- **3-Tier Caching**: High-performance caching hierarchy (Redis → SQLite → In-Memory) to ensure lightning-fast threat intel lookups.
- **Transaction Interceptor Layer**: Hooks into wallet requests and analyzes transactions before user approval.
- **Docker-Ready**: Multi-stage Dockerfile optimized for Next.js standalone builds with non-root execution and persistent volumes.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Styling**: Tailwind CSS + Framer Motion
- **Web3**: `ethers.js` (Decoding & Parsing)
- **Cryptography**: `@noble/post-quantum` (ML-DSA-65 Dilithium)
- **Zero-Knowledge**: `circomlibjs` (Poseidon Hash) + Merkle Trees
- **Database**: SQLite (`better-sqlite3`)
- **Testing**: Vitest

## 💻 Getting Started

### Prerequisites

- Node.js v20+
- npm or pnpm

### Local Development

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Copy the example config and fill in any required values (like your PQC seed or OpenAI key).
   ```bash
   cp .env.example .env.local
   ```
   *Note: If `SENTINEL_PQC_SEED` is not provided, the app will fall back to a deterministic development seed.*

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Run the test suite:**
   Sentinel AI includes comprehensive unit tests for the Risk Engine, PQC algorithm, and Calldata Decoder.
   ```bash
   npm run test
   ```

## 🐳 Docker Deployment

Sentinel AI is optimized for containerized environments using Next.js standalone mode.

```bash
# Build the Docker image
docker build -t sentinel-ai .

# Run the container (maps the SQLite database to a local volume)
docker run -p 3000:3000 \
  -e SENTINEL_PQC_SEED="your_64_character_hex_seed_here" \
  -v sentinel_data:/app/data \
  sentinel-ai
```

## 🔐 Architecture Notes

- **Simulation**: Currently operates heuristically based on decoded action types. For full EVM state transitions, integration with a node provider like Tenderly or Alchemy Simulation API is required.
- **Keys**: Production deployments MUST inject a 32-byte hex string into the `SENTINEL_PQC_SEED` environment variable via an HSM or secret manager.

## ⚠️ Limitations & Future Work

- Full EVM state simulation (planned via Tenderly / Alchemy)
- Advanced behavioral anomaly detection per wallet
- Expanded threat intelligence integrations
- Hardware-backed key management (HSM)

## 📄 License

MIT License
