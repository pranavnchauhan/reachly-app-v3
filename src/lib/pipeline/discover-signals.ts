// Step 1: Signal-first discovery — find companies in the news matching buying signals
// Uses Perplexity to search verified news sources (last 60 days)

import type { Signal } from "@/types/database";
import { safeFetchJson } from "./safe-fetch";

export interface DiscoveredCompany {
  name: string;
  domain: string | null;
  industry: string | null;
  location: string | null;
  signal_id: string;
  signal_name: string;
  evidence: string;
  source_url: string | null;
  confidence: number;
  source: "perplexity" | "apollo";
}

export async function discoverSignals(
  signals: Signal[],
  geography: string[]
): Promise<DiscoveredCompany[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const allDiscovered: DiscoveredCompany[] = [];
  const geoStr = geography.length > 0 ? geography.join(", ") : "Australia";

  // Process each signal — 1 Perplexity call per signal
  for (const signal of signals) {
    const companies = await searchNewsForSignal(signal, geoStr, apiKey);
    allDiscovered.push(...companies);

    // Brief pause between calls
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Deduplicate by company name (keep highest confidence)
  const deduped = new Map<string, DiscoveredCompany>();
  for (const company of allDiscovered) {
    const key = company.name.toLowerCase().trim();
    const existing = deduped.get(key);
    if (!existing || company.confidence > existing.confidence) {
      deduped.set(key, company);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Cap at 20 companies
}

async function searchNewsForSignal(
  signal: Signal,
  geography: string,
  apiKey: string
): Promise<DiscoveredCompany[]> {
  const prompt = `Search for companies in ${geography} that are currently showing this buying signal:

"${signal.name}" — ${signal.description}

Find REAL companies from the last 60 days based on verified news articles, press releases, business publications (e.g. AFR, SMH, The Australian, ABC News, industry publications).

For each company found, provide:
- Company name
- Their website domain (if known)
- The specific event or evidence from the news
- The source URL where you found this
- How confident you are this signal applies (0.0 to 1.0)

IMPORTANT:
- Only cite real, verifiable news sources — no blogs, recruitment sites, or generic articles
- Only include companies where something SPECIFIC and RECENT happened
- Include the company's industry and location if mentioned

Respond in this exact JSON format:
{
  "companies": [
    {
      "name": "Company Name",
      "domain": "company.com",
      "industry": "Industry",
      "location": "City, State",
      "evidence": "Specific event from the news",
      "source_url": "https://source-url.com/article",
      "confidence": 0.85
    }
  ]
}

If no companies match, respond with: {"companies": []}`;

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
            content: "You are a B2B market intelligence analyst. Only cite verified news sources. Respond only with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    }
  );

  if (!ok) return [];

  const choices = data.choices as Record<string, Record<string, string>>[] | undefined;
  const text = choices?.[0]?.message?.content || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  return (parsed.companies || []).map(
    (c: Record<string, unknown>): DiscoveredCompany => ({
      name: (c.name as string) || "Unknown",
      domain: (c.domain as string) || null,
      industry: (c.industry as string) || null,
      location: (c.location as string) || null,
      signal_id: signal.id,
      signal_name: signal.name,
      evidence: ((c.evidence as string) || "").replace(/\*\*/g, "").replace(/\[[\d,\s]+\]/g, "").trim(),
      source_url: (c.source_url as string) || null,
      confidence: Math.min(1, Math.max(0, (c.confidence as number) || 0.5)),
      source: "perplexity" as const,
    })
  );
}
