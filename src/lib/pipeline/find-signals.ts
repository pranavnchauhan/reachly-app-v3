// Step 2: Use Perplexity to detect buying signals for each company

import type { Signal } from "@/types/database";
import type { SourcedCompany } from "./source-companies";
import { safeFetchJson } from "./safe-fetch";

export interface SignalResult {
  company: SourcedCompany;
  matched_signals: {
    signal_id: string;
    signal_name: string;
    evidence: string;
    confidence: number;
  }[];
  total_score: number;
}

export async function findSignals(
  companies: SourcedCompany[],
  signals: Signal[]
): Promise<SignalResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const results: SignalResult[] = [];

  // Process companies in batches of 5
  for (let i = 0; i < companies.length; i += 5) {
    const batch = companies.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((company) => detectSignalsForCompany(company, signals, apiKey))
    );
    results.push(...batchResults);

    if (i + 5 < companies.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results
    .filter((r) => r.matched_signals.length > 0)
    .sort((a, b) => b.total_score - a.total_score);
}

async function detectSignalsForCompany(
  company: SourcedCompany,
  signals: Signal[],
  apiKey: string
): Promise<SignalResult> {
  const empty: SignalResult = { company, matched_signals: [], total_score: 0 };

  const signalList = signals
    .map((s, i) => `${i + 1}. "${s.name}" - ${s.description}`)
    .join("\n");

  const prompt = `Research the company "${company.name}"${company.domain ? ` (${company.domain})` : ""} in the ${company.industry} industry${company.location ? `, located in ${company.location}` : ""}.

Determine which of these buying signals apply to this company right now:

${signalList}

For each signal that applies, provide:
- The signal number
- Specific evidence (recent news, job postings, announcements, etc.)
- A confidence score from 0.0 to 1.0

Respond ONLY in this JSON format, no other text:
{
  "signals": [
    {"number": 1, "evidence": "specific evidence here", "confidence": 0.85}
  ]
}

If no signals apply, respond with: {"signals": []}`;

  const { ok, data } = await safeFetchJson(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a B2B research analyst. Respond only with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    }
  );

  if (!ok) return empty;

  const content = (data as Record<string, unknown[]>).choices?.[0] as Record<string, Record<string, string>> | undefined;
  const text = content?.message?.content || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return empty;

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return empty;
  }

  const matchedSignals = (parsed.signals || [])
    .filter((s: { number: number }) => s.number >= 1 && s.number <= signals.length)
    .map((s: { number: number; evidence: string; confidence: number }) => ({
      signal_id: signals[s.number - 1].id,
      signal_name: signals[s.number - 1].name,
      evidence: s.evidence || "",
      confidence: Math.min(1, Math.max(0, s.confidence || 0.5)),
    }));

  const totalScore = matchedSignals.reduce(
    (sum: number, s: { confidence: number; signal_id: string }) => {
      const signal = signals.find((sig) => sig.id === s.signal_id);
      return sum + s.confidence * (signal?.weight || 5);
    },
    0
  );

  return { company, matched_signals: matchedSignals, total_score: totalScore };
}
