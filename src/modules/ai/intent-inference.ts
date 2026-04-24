import type { DecodedAction, TransactionPayload, UserIntent } from "@/src/modules/transaction/types";

const INTENT_VALUES: UserIntent[] = [
  "send",
  "claim",
  "swap",
  "approve",
  "grant-permissions",
  "contract-call",
  "other",
];

type IntentInferenceResult = {
  intent?: UserIntent;
  confidence: number;
  explanation: string;
  usedGoogleAI: boolean;
};

function buildPrompt(payload: TransactionPayload, decoded: DecodedAction) {
  return {
    url: payload.metadata?.url ?? "",
    dappName: payload.metadata?.dappName ?? "",
    source: payload.metadata?.source ?? "",
    trusted: payload.trusted ?? false,
    decodedAction: decoded.kind,
    decodedMethod: decoded.kind === "contract-call" ? decoded.method ?? null : decoded.kind,
    destination: payload.to,
  };
}

function heuristicIntent(payload: TransactionPayload, decoded: DecodedAction): IntentInferenceResult {
  const hintText = `${payload.metadata?.source ?? ""} ${payload.metadata?.dappName ?? ""} ${payload.metadata?.url ?? ""}`.toLowerCase();

  if (/claim|reward|airdrop|bonus|free/.test(hintText)) {
    return {
      intent: "claim",
      confidence: 0.76,
      explanation: "The dApp language looks like a claim or reward flow.",
      usedGoogleAI: false,
    };
  }

  if (/swap|exchange|trade|router|uniswap|dex/.test(hintText)) {
    return {
      intent: "swap",
      confidence: 0.72,
      explanation: "The dApp context looks like a swap or exchange flow.",
      usedGoogleAI: false,
    };
  }

  if (decoded.kind === "transfer" || decoded.kind === "native-transfer") {
    return {
      intent: "send",
      confidence: 0.62,
      explanation: "The request most closely resembles sending assets.",
      usedGoogleAI: false,
    };
  }

  return {
    intent: undefined,
    confidence: 0,
    explanation: "No strong intent signal was inferred from local heuristics.",
    usedGoogleAI: false,
  };
}

function parseIntentResponse(raw: unknown): { intent?: UserIntent; confidence?: number; explanation?: string } {
  if (!raw || typeof raw !== "object") return {};

  const candidates = (raw as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ").trim();
  if (!text) return {};

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      inferredIntent?: string;
      confidence?: number;
      explanation?: string;
    };

    return {
      intent: INTENT_VALUES.includes(parsed.inferredIntent as UserIntent)
        ? (parsed.inferredIntent as UserIntent)
        : undefined,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : undefined,
    };
  } catch {
    return {};
  }
}

export async function inferUserIntent(
  payload: TransactionPayload,
  decoded: DecodedAction
): Promise<IntentInferenceResult> {
  if (!process.env.GEMINI_API_KEY) {
    return heuristicIntent(payload, decoded);
  }

  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  'Infer the likely user intent in a Web3 signing flow from page context. Return JSON only with keys inferredIntent, confidence, explanation. inferredIntent must be one of: send, claim, swap, approve, grant-permissions, contract-call, other. Do not decide whether the transaction is safe.',
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify(buildPrompt(payload, decoded)),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 180,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini intent inference failed with status ${response.status}`);
    }

    const parsed = parseIntentResponse((await response.json()) as unknown);
    return {
      intent: parsed.intent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      explanation: parsed.explanation ?? "Gemini inferred likely user intent from the dApp context.",
      usedGoogleAI: true,
    };
  } catch {
    return heuristicIntent(payload, decoded);
  }
}
