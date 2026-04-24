# Sentinel AI

Sentinel AI is a pre-sign transaction firewall for Web3 that prevents users from signing malicious transactions they do not understand.

Instead of relying on raw calldata or confusing wallet prompts, Sentinel analyzes each transaction before approval, infers what the user intends to do using Google Gemini, and verifies whether the transaction actually matches that intent. If it does not, the system blocks the transaction before any assets are at risk.

**In one line:**  
Sentinel compares what the user thinks they are doing with what the transaction actually does.

**Example:**  
“Claim rewards” -> actually “grant unlimited token approval” -> **blocked**

**Result:**  
Users no longer have to sign blind transactions.

## Live Deployment

Production prototype:

https://sentinel-ai-111885796030.asia-south1.run.app

This prototype is deployed on Google Cloud Run.

## Example Detection

**User intent:** Claim rewards  
**Actual transaction:** Unlimited token approval

Sentinel AI:

- Detects the mismatch
- Explains the risk clearly
- Blocks the transaction before signing

**Outcome:** Funds are protected before signing.

## What Problem It Solves

One of the biggest problems in Web3 is that users are often asked to sign transactions they do not fully understand. Wallets typically expose raw calldata or low-context prompts, while attackers disguise malicious approvals and drain patterns as harmless actions such as claims, rewards, wallet checks, or routine interactions.

Sentinel AI closes that gap by:

- decoding the raw transaction into understandable actions
- simulating likely effects before signing
- checking for approval abuse, hidden permissions, reputation issues, and suspicious context
- inferring likely user intent from dApp context
- explaining why the transaction is risky in plain English
- blocking high-confidence malicious flows before the final signature

## How It Works

Every transaction passes through a layered analysis pipeline:

1. Intercept  
   Sentinel captures the transaction request before it reaches the final signing step.

2. Decode  
   The calldata is decoded into meaningful actions such as transfers, approvals, permits, multicalls, or opaque contract calls.

3. Simulate  
   The system uses Tenderly and RPC tracing when available, with heuristic fallbacks when necessary.

4. Evaluate Risk  
   Sentinel applies deterministic rules for risk scoring, phishing signals, novelty risk, destination reputation, and suspicious transaction structure.

5. Infer Intent  
   Google Gemini is used to infer likely user intent from dApp context such as page source, naming, URL, and transaction framing.

6. Explain  
   Google Gemini is also used to generate a user-facing explanation in plain language, while the final decision remains rule-based.

7. Enforce  
   Sentinel returns a clear allow, warn, or block decision before signing.

## Why Google Gemini Is Used

Sentinel uses Google Gemini for two meaningful parts of the product:

- Intent inference: understanding what the user likely believes they are doing
- Natural-language explanation: turning raw transaction analysis into a clear warning or explanation

This is intentional. Gemini supports the interpretive layer of the system, while the final security decision remains deterministic and auditable.

That means:

- Gemini helps understand context
- Gemini helps explain the result
- Gemini does not control the final block or allow verdict

## Key Features

- Pre-sign transaction analysis
- Unlimited approval detection
- Permit and Permit2 risk detection
- Hidden approval detection inside multicalls
- First-time destination and novelty analysis
- Threat intelligence integration with GoPlus
- Reputation-aware destination checks
- Intent mismatch detection
- Browser extension interception flow
- Security operations dashboard
- Replay-resistant compliance attestation flow

## Product Experience

Sentinel is designed to feel understandable, not just technically correct.

In the dashboard, users and judges can see:

- risk score and policy mode
- decoded transaction type
- human-readable explanation
- findings and reasons
- intent source
- inferred intent
- confidence
- actual decoded action
- whether there is an intent mismatch

This makes the system visibly intelligent and easy to trust.

## Tech Stack

- Frontend: Next.js 15, React 19, Tailwind CSS, Framer Motion
- Backend: Node.js, Next.js API routes
- Blockchain: ethers.js v6
- Simulation: Tenderly, RPC tracing, heuristic fallback
- Database: PostgreSQL
- Cache: Redis or PostgreSQL fallback
- Threat Intel: GoPlus Security API
- AI: Google Gemini API
- Crypto: ML-DSA-65 via `@noble/post-quantum`
- ZK / Integrity: snarkjs, circomlibjs, Poseidon, Merkle commitments
- Deployment: Docker + Google Cloud Run

## Architecture Summary

Sentinel uses a hybrid architecture:

- deterministic transaction analysis for safety-critical decisions
- AI assistance for contextual understanding and explanation

This balance is important. It gives the product a strong safety story while still making it readable and useful for real users.

## Local Setup

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd sentinel-ai
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

## Required Environment Variables

Minimum recommended configuration:

- `DATABASE_URL`
- `RPC_URL`
- `GEMINI_API_KEY`

Optional but useful:

- `GEMINI_MODEL`
- `TENDERLY_ACCESS_KEY`
- `TENDERLY_ACCOUNT`
- `TENDERLY_PROJECT`
- `AUTH_SECRET`
- `SENTINEL_PQC_SEED`
- `METRICS_READ_TOKEN`
- `REDIS_URL`

## Demo Flow

A simple demo flow for reviewers:

1. Open the dashboard
2. Load a transaction scenario
3. Run analysis
4. Observe the decoded action, risk score, and policy mode
5. Review the intent intelligence section
6. Show how a fake claim flow can actually decode into a dangerous approval
7. Show the system blocking the transaction before signing

## Deployment

The project includes:

- a Dockerfile for containerized deployment
- Cloud Build configuration
- Google Cloud Run deployment support

Live prototype:

https://sentinel-ai-111885796030.asia-south1.run.app

## Security Positioning

Sentinel is designed as a practical security product, not a generic AI wrapper.

Its core value is:

- preventing harmful transactions before signing
- making hidden risk understandable
- using deterministic controls for the final decision
- using Google Gemini where contextual reasoning is genuinely useful

## License

MIT
