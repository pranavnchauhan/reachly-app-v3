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

export interface DiscoveryOptions {
  employeeMin?: number;
  employeeMax?: number;
  excludeCompanyNames?: Set<string>;
}

export async function discoverSignals(
  signals: Signal[],
  geography: string[],
  options: DiscoveryOptions = {}
): Promise<DiscoveredCompany[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const allDiscovered: DiscoveredCompany[] = [];
  const geoStr = geography.length > 0 ? geography.join(", ") : "Australia";

  const sizeHint = options.employeeMin || options.employeeMax
    ? `Target company size: ${options.employeeMin || 1}–${options.employeeMax || 10000} employees.`
    : "";

  // Process all signals in parallel — much faster than sequential
  const results = await Promise.all(
    signals.map((signal) => searchNewsForSignal(signal, geoStr, apiKey, sizeHint))
  );
  for (const companies of results) {
    allDiscovered.push(...companies);
  }

  // Deduplicate by company name (keep highest confidence)
  const deduped = new Map<string, DiscoveredCompany>();
  for (const company of allDiscovered) {
    const key = company.name.toLowerCase().trim();
    // Skip companies already in DB from previous runs
    if (options.excludeCompanyNames?.has(key)) continue;
    // Filter out universities, government, and mega-corps
    if (isExcludedEntity(company.name)) continue;
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
  apiKey: string,
  sizeHint: string = ""
): Promise<DiscoveredCompany[]> {
  const sizeRule = sizeHint
    ? `\n- ${sizeHint} Do NOT include large enterprises (ASX200, Fortune 500), government departments, or universities. Focus on small-to-mid-market and founder-led businesses.`
    : "";

  const prompt = `Search for companies with significant presence in ${geography} that are currently showing this buying signal:

"${signal.name}" — ${signal.description}

Find REAL companies from the last 60 days based on verified news articles, press releases, business publications (e.g. AFR, SMH, The Australian, ABC News, industry publications).

For each company found, provide:
- Company name
- Their website domain (if known)
- The specific event or evidence from the news
- The source URL where you found this
- How confident you are this signal applies (0.0 to 1.0)

CRITICAL RULES:
- Only include companies that are HEADQUARTERED in ${geography} OR have a major office/operations in ${geography}
- Do NOT include overseas companies that merely do business with ${geography} — they must have a physical presence (office, team, operations) there
- Only cite real, verifiable news sources — no blogs, recruitment sites, or generic articles
- Only include companies where something SPECIFIC and RECENT happened
- Include the company's Australian office location if they are a global company${sizeRule}
- Do NOT include universities, TAFEs, schools, government agencies, councils, or departments
- Do NOT include ASX200 companies (e.g. BHP, CBA, NAB, ANZ, Westpac, Telstra, Woolworths, Wesfarmers, CSL, Macquarie)

Respond in this exact JSON format:
{
  "companies": [
    {
      "name": "Company Name",
      "domain": "company.com",
      "industry": "Industry",
      "location": "City, State, Australia",
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

  const companies = (parsed.companies || []).map(
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

  // Verify source URLs — check if company name actually appears on the page
  const verified = await Promise.all(
    companies.map(async (company: DiscoveredCompany) => {
      if (!company.source_url) return company;
      const isValid = await verifySourceUrl(company.source_url, company.name);
      if (!isValid) {
        console.warn(`Source URL rejected for ${company.name}: ${company.source_url} — company not mentioned`);
        return { ...company, source_url: null, confidence: Math.max(0.3, company.confidence - 0.2) };
      }
      return company;
    })
  );

  return verified;
}

// ─── Entity filter — block universities, government, mega-corps ──────
const EXCLUDED_PATTERNS = [
  // Universities & education
  /\buniversity\b/i, /\buniversities\b/i, /\btafe\b/i, /\bcollege\b/i,
  /\bUNSW\b/, /\bRMIT\b/, /\bUTS\b/, /\bACU\b/, /\bUSYD\b/, /\bANU\b/,
  /\bmonash\b/i, /\bdeakin\b/i, /\bcurtin\b/i, /\bswinburne\b/i, /\bgriffith university\b/i,
  // Government
  /\bgovernment\b/i, /\bdepartment of\b/i, /\bcouncil\b/i, /\bminister\b/i,
  /\bdefence\b/i, /\bATO\b/, /\bservices australia\b/i,
  // ASX200 mega-corps
  /\bBHP\b/, /\bRio Tinto\b/i, /\bCommonwealth Bank\b/i, /\bCBA\b/, /\bNAB\b/,
  /\bANZ\b/, /\bWestpac\b/i, /\bTelstra\b/i, /\bWoolworths\b/i, /\bColes\b/i,
  /\bWesfarmers\b/i, /\bCSL\b/, /\bMacquarie Group\b/i, /\bWoodside\b/i,
  /\bFortescue\b/i, /\bQantas\b/i, /\bTransurban\b/i, /\bSuncorp\b/i,
  /\bOrigin Energy\b/i, /\bSantos\b/i, /\bInsurance Australia\b/i,
  /\bAtlassian\b/i, /\bCanva\b/i, /\bAfterpay\b/i, /\bBlock\b/i,
];

export function isExcludedEntity(name: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(name));
}

async function verifySourceUrl(url: string, companyName: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReachlyBot/1.0)" },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return false;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return false;

    // Read first 50KB — enough to check if company is mentioned
    const reader = res.body?.getReader();
    if (!reader) return false;

    let text = "";
    const decoder = new TextDecoder();
    while (text.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // Check if company name (or significant part of it) appears in the page
    const nameWords = companyName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const pageText = text.toLowerCase();

    // Full name match
    if (pageText.includes(companyName.toLowerCase())) return true;

    // At least the first significant word of the company name
    const primaryWord = nameWords[0];
    if (primaryWord && primaryWord.length > 3 && pageText.includes(primaryWord)) return true;

    return false;
  } catch {
    // If we can't verify, keep the URL but mark lower confidence
    return true; // Give benefit of the doubt on network errors
  }
}
