// Step 1: Signal-first discovery — find companies in the news matching buying signals
// Uses Perplexity to search verified news sources (last 30 days)
// HOT-ONLY pipeline: only companies with corroborated news signals make it through

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

  // Per-source-URL dedup: max 2 companies per unique URL (keep highest confidence)
  const bySourceUrl = new Map<string, DiscoveredCompany[]>();
  for (const company of deduped.values()) {
    if (!company.source_url) continue;
    const urlKey = company.source_url.toLowerCase().split("?")[0];
    const bucket = bySourceUrl.get(urlKey) || [];
    bucket.push(company);
    bySourceUrl.set(urlKey, bucket);
  }
  const urlCapped: DiscoveredCompany[] = [];
  for (const bucket of bySourceUrl.values()) {
    bucket.sort((a, b) => b.confidence - a.confidence);
    urlCapped.push(...bucket.slice(0, 2));
  }

  // Only keep companies with verified source URLs (hot leads)
  const hotLeads = urlCapped
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

  const prompt = `List Australian companies that have been in business news in the last 30 days for: ${searchDescription}

Include companies from news articles, press releases, financial publications, and industry reports.

For each company, provide:
- Company name
- Website domain
- What happened (the specific event)
- A URL where this was reported
- Your confidence (0.0 to 1.0)

Companies must be based in ${geography} or have major operations there.
Do NOT include universities, schools, or government agencies.

Return JSON only:
{"companies": [{"name": "Company", "domain": "company.com", "industry": "X", "location": "City, State, Australia", "evidence": "What happened", "source_url": "https://...", "confidence": 0.8}]}`;

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
            content: "You are a B2B market intelligence analyst. Respond only with valid JSON. No markdown, no explanation.",
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

  // Corroborate each company — requires 2+ diverse, fresh, specific source URLs
  const corroborated = await Promise.all(
    companies.map(async (company: DiscoveredCompany) => {
      const { passed, bestUrl } = await corroborateCompany(company, apiKey);
      if (!passed) return null;
      return { ...company, source_url: bestUrl };
    })
  );

  return corroborated.filter((c): c is DiscoveredCompany => c !== null);
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
  // Additional large enterprises and government bodies
  /\baustralia post\b/i, /\bauspost\b/i,
  /\bvirgin australia\b/i,
  /\bnews corp\b/i, /\bnewscorp\b/i,
  /\baustralian broadcasting\b/i, /\bABC\b/, /\bSBS\b/,
  /\bairservices\b/i,
  /\bnbn co\b/i, /\bnbn\b/i,
  /\bsynergy\b/i, /\bwater corporation\b/i,
  /\bvicroads\b/i, /\btransport for nsw\b/i,
];

export function isExcludedEntity(name: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(name));
}

// ─── Listing page detection ──────────────────────────────────────────

function isListingPage(url: string): boolean {
  const listingPatterns = [
    /\/category\//i,
    /\/categories\//i,
    /\/tag\//i,
    /\/tags\//i,
    /\/topic\//i,
    /\/topics\//i,
    /\/industry\//i,
    /\/industries\//i,
    /\/search\//i,
    /\/news\/industry\//i,
    /\/news\/sector\//i,
    /\/author\//i,
    /\/page\/\d+/i,
    /[?&](category|tag|topic|industry|sector|q)=/i,
  ];
  try {
    const path = new URL(url).pathname + new URL(url).search;
    return listingPatterns.some((p) => p.test(path));
  } catch {
    return false;
  }
}

// ─── Corroboration — require 2+ diverse fresh sources ────────────────

async function corroborateCompany(
  company: DiscoveredCompany,
  apiKey: string
): Promise<{ passed: boolean; bestUrl: string | null }> {
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Helper: validate a single URL against all gates
  async function validateUrl(url: string): Promise<{ valid: boolean; keywordMatchCount: number }> {
    if (isListingPage(url)) {
      console.warn(`[corroborate] Listing page rejected: ${url}`);
      return { valid: false, keywordMatchCount: 0 };
    }
    const result = await verifySourceUrl(url, company.name, company.evidence);
    if (!result.companyFound) {
      console.warn(`[corroborate] Verification failed for ${company.name}: ${url} — company not found on page`);
      return { valid: false, keywordMatchCount: 0 };
    }
    // evidenceFound is a quality signal but not a hard gate — captured via keywordMatchCount
    if (result.publishedDate && result.publishedDate < THIRTY_DAYS_AGO) {
      console.warn(`[corroborate] Stale source rejected for ${company.name}: ${url} (published: ${result.publishedDate.toISOString()})`);
      return { valid: false, keywordMatchCount: 0 };
    }
    // Note: if publishedDate is null (JS-rendered or paywalled), we soft-pass — other gates still apply
    return { valid: true, keywordMatchCount: result.keywordMatchCount };
  }

  // Step A: validate the original URL first
  const originalResult = company.source_url
    ? await validateUrl(company.source_url)
    : { valid: false, keywordMatchCount: 0 };

  const validUrls: Array<{ url: string; domain: string; keywordMatchCount: number }> = [];

  if (originalResult.valid && company.source_url) {
    try {
      validUrls.push({
        url: company.source_url,
        domain: new URL(company.source_url).hostname,
        keywordMatchCount: originalResult.keywordMatchCount,
      });
    } catch { /* invalid URL */ }
  }

  // Step B: secondary Perplexity search for corroborating sources
  const signalKeyword = company.signal_name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const corrobPrompt = `Find recent news articles (published in the last 30 days) specifically about "${company.name}" in Australia related to: ${signalKeyword}.

Return only articles that are specifically about this company and this event - no category pages, no listing pages.

Return JSON only:
{"articles": [{"url": "https://...", "title": "Article title", "published_date": "YYYY-MM-DD"}]}`;

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
            content: "You are a research assistant. Return only valid JSON. No markdown.",
          },
          { role: "user", content: corrobPrompt },
        ],
        temperature: 0.1,
      }),
    }
  );

  if (ok) {
    const choices = data.choices as Record<string, Record<string, string>>[] | undefined;
    const text = choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const articles: Array<{ url: string }> = parsed.articles || [];

        // Validate each corroborating URL in parallel
        const corrobResults = await Promise.all(
          articles.slice(0, 5).map(async (a) => {
            if (!a.url) return null;
            const res = await validateUrl(a.url);
            if (!res.valid) return null;
            try {
              return { url: a.url, domain: new URL(a.url).hostname, keywordMatchCount: res.keywordMatchCount };
            } catch { return null; }
          })
        );

        for (const r of corrobResults) {
          if (!r) continue;
          // Only add if domain is different from all already-valid URLs
          const domainAlreadySeen = validUrls.some((v) => v.domain === r.domain);
          if (!domainAlreadySeen) {
            validUrls.push(r);
          }
        }
      } catch { /* parse error */ }
    }
  }

  // Require minimum 2 valid URLs from 2 different domains
  if (validUrls.length < 2) {
    console.warn(`[corroborate] REJECTED ${company.name} - only ${validUrls.length} valid source(s) found (need 2 from different domains)`);
    return { passed: false, bestUrl: null };
  }

  // Pick the best URL: highest keywordMatchCount
  const best = validUrls.sort((a, b) => b.keywordMatchCount - a.keywordMatchCount)[0];
  console.log(`[corroborate] PASSED ${company.name} - ${validUrls.length} valid sources. Best: ${best.url}`);
  return { passed: true, bestUrl: best.url };
}

// ─── Source URL verification ─────────────────────────────────────────

interface VerificationResult {
  companyFound: boolean;
  evidenceFound: boolean;
  publishedDate: Date | null;
  keywordMatchCount: number;
}

async function verifySourceUrl(url: string, companyName: string, evidence: string): Promise<VerificationResult> {
  const fail: VerificationResult = { companyFound: false, evidenceFound: false, publishedDate: null, keywordMatchCount: 0 };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReachlyBot/1.0)" },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return fail;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return fail;

    // Read first 50KB
    const reader = res.body?.getReader();
    if (!reader) return fail;

    let text = "";
    const decoder = new TextDecoder();
    while (text.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const pageText = text.toLowerCase();

    // ── Extract publication date ──
    let publishedDate: Date | null = null;

    // Priority 1: <meta property="article:published_time">
    const ogDateMatch = text.match(/<meta\s+(?:property|name)="article:published_time"\s+content="([^"]+)"/i);
    if (ogDateMatch) {
      const d = new Date(ogDateMatch[1]);
      if (!isNaN(d.getTime())) publishedDate = d;
    }

    // Priority 2: <meta name="pubdate">
    if (!publishedDate) {
      const pubdateMatch = text.match(/<meta\s+name="pubdate"\s+content="([^"]+)"/i);
      if (pubdateMatch) {
        const d = new Date(pubdateMatch[1]);
        if (!isNaN(d.getTime())) publishedDate = d;
      }
    }

    // Priority 3: <time datetime="...">
    if (!publishedDate) {
      const timeMatch = text.match(/<time[^>]+datetime="([^"]+)"/i);
      if (timeMatch) {
        const d = new Date(timeMatch[1]);
        if (!isNaN(d.getTime())) publishedDate = d;
      }
    }

    // Priority 4: JSON-LD datePublished
    if (!publishedDate) {
      const ldMatches = text.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of ldMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const dp = ld.datePublished || (Array.isArray(ld["@graph"]) ? ld["@graph"].find((g: Record<string, unknown>) => g.datePublished)?.datePublished : null);
          if (dp) {
            const d = new Date(dp as string);
            if (!isNaN(d.getTime())) { publishedDate = d; break; }
          }
        } catch { /* invalid JSON-LD */ }
      }
    }

    // ── Check company name ──
    const nameWords = companyName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const companyFound =
      pageText.includes(companyName.toLowerCase()) ||
      (nameWords[0]?.length > 3 && pageText.includes(nameWords[0]));

    // ── Check evidence keywords ──
    const evidenceWords = evidence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);
    const keywordMatchCount = evidenceWords.filter((w) => pageText.includes(w)).length;
    const evidenceFound = keywordMatchCount >= Math.min(2, evidenceWords.length);

    return { companyFound, evidenceFound, publishedDate, keywordMatchCount };
  } catch {
    // Network error — fail closed, don't trust unverifiable sources
    return fail;
  }
}
