// Step 1: Signal-first discovery — find companies in the news matching buying signals
// Uses Perplexity to search verified news sources (last 60 days)
// HOT-ONLY pipeline: only companies with verified news signals make it through

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
  source: "perplexity";
}

export interface DiscoveryOptions {
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

  // Process all signals in parallel
  const results = await Promise.all(
    signals.map((signal) => searchNewsForSignal(signal, geoStr, apiKey))
  );
  for (const companies of results) {
    allDiscovered.push(...companies);
  }

  // Deduplicate by company name (keep highest confidence)
  const deduped = new Map<string, DiscoveredCompany>();
  for (const company of allDiscovered) {
    const key = company.name.toLowerCase().trim();
    if (options.excludeCompanyNames?.has(key)) continue;
    if (isExcludedEntity(company.name)) continue;
    const existing = deduped.get(key);
    if (!existing || company.confidence > existing.confidence) {
      deduped.set(key, company);
    }
  }

  // Only keep companies with verified source URLs (hot leads)
  const hotLeads = Array.from(deduped.values())
    .filter((c) => c.source_url !== null)
    .sort((a, b) => b.confidence - a.confidence);

  return hotLeads;
}

// Map internal signal names to news-searchable descriptions
const NEWS_SEARCH_HINTS: Record<string, string> = {
  "Long Lead Times": "company facing supply chain delays, shipping disruptions, production backlogs, or delivery delays",
  "Rapid Growth": "company announcing rapid revenue growth, new funding round, expanding headcount, or opening new offices",
  "Business Acquisition / Merger": "company completing acquisition, merger, or being acquired by another company",
  "Hiring Operations Roles": "company hiring COO, operations manager, head of operations, or process improvement roles",
  "Multiple Handoffs": "company restructuring operations, consolidating teams, or streamlining workflows",
  "Process Complaints": "company receiving customer complaints about service quality, delays, or operational failures",
  "Systems Integration Issues": "company migrating systems, replacing legacy software, or integrating after acquisition",
  "Customer Experience Failures": "company facing public customer complaints, service outages, or negative reviews in news",
  "Scaling Beyond Systems": "fast-growing company struggling with operational capacity or systems not keeping up with growth",
  "Negative Employee Reviews": "company facing employee complaints, workplace issues, or culture problems reported in media",
  "CRM/System Issues": "company implementing new CRM, ERP, or business systems, or reporting technology challenges",
  "Multi-Location Expansion": "company opening new branches, offices, stores, or expanding to new cities or regions",
  "Leadership Gaps": "company appointing new CEO, COO, or GM, or reporting leadership changes or vacancies",
  "Compliance & Regulatory Pressure": "company facing regulatory changes, compliance requirements, or industry regulation updates",
  "Founder/Team Burnout": "founder-led company discussing growth challenges, work-life balance, or operational overwhelm",
  "New Product/Market Launches": "company launching new product, entering new market, or expanding service offerings",
  "No COO/Ops Leader": "growing company without a COO or operations leader, founder still running day-to-day operations",
  "Founder Still in Operations": "founder-led company where founder is still involved in daily operations instead of strategy",
  "Manual/Paper-Based Processes": "company digitizing operations, moving from manual to digital processes, or adopting new technology",
  "High Staff Turnover": "company experiencing high employee turnover, retention issues, or hiring difficulties",
  "Failed Tech Implementation": "company reporting failed software rollout, IT project delays, or technology migration issues",
  "Revenue Growth + Flat Margins": "company growing revenue but reporting flat or declining profit margins",
};

async function searchNewsForSignal(
  signal: Signal,
  geography: string,
  apiKey: string
): Promise<DiscoveredCompany[]> {
  const searchDescription = NEWS_SEARCH_HINTS[signal.name] || signal.description;

  const prompt = `Find Australian companies that have recently been in the news for: ${searchDescription}

Search verified news articles, press releases, and business publications from the last 60 days (e.g. AFR, SMH, The Australian, ABC News, SmartCompany, Business News Australia, industry publications).

Prefer mid-market companies and founder-led businesses, but include any company with a genuine, recent event.

For each company found, provide:
- Company name
- Their website domain (if known)
- The specific event or evidence from the news
- The source URL where you found this
- How confident you are (0.0 to 1.0)

RULES:
- Companies must be headquartered in ${geography} or have major operations there
- Only cite real, verifiable news — no blogs or generic articles
- Only include companies where something SPECIFIC and RECENT happened
- Do NOT include universities, TAFEs, schools, or government agencies

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

  // Verify source URLs — check company name AND evidence match the page content
  const verified = await Promise.all(
    companies.map(async (company: DiscoveredCompany) => {
      if (!company.source_url) return { ...company, confidence: 0.2 }; // No URL = very low confidence
      const verification = await verifySourceUrl(company.source_url, company.name, company.evidence);
      if (!verification.companyFound) {
        console.warn(`Source URL rejected for ${company.name}: ${company.source_url} — company not mentioned`);
        return { ...company, source_url: null, confidence: 0.2 };
      }
      // Bonus confidence if evidence is also confirmed on page
      const conf = verification.evidenceFound
        ? Math.min(1, company.confidence + 0.05)
        : company.confidence;
      return { ...company, confidence: conf };
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

interface VerificationResult {
  companyFound: boolean;
  evidenceFound: boolean;
}

async function verifySourceUrl(url: string, companyName: string, evidence: string): Promise<VerificationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReachlyBot/1.0)" },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return { companyFound: false, evidenceFound: false };

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { companyFound: false, evidenceFound: false };

    // Read first 50KB
    const reader = res.body?.getReader();
    if (!reader) return { companyFound: false, evidenceFound: false };

    let text = "";
    const decoder = new TextDecoder();
    while (text.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const pageText = text.toLowerCase();

    // Check company name
    const nameWords = companyName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const companyFound =
      pageText.includes(companyName.toLowerCase()) ||
      (nameWords[0]?.length > 3 && pageText.includes(nameWords[0]));

    // Check evidence keywords (pick 2-3 significant words from evidence)
    const evidenceWords = evidence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);
    const evidenceMatches = evidenceWords.filter((w) => pageText.includes(w)).length;
    const evidenceFound = evidenceMatches >= Math.min(2, evidenceWords.length);

    return { companyFound, evidenceFound };
  } catch {
    // Network error — give benefit of the doubt
    return { companyFound: true, evidenceFound: false };
  }
}
