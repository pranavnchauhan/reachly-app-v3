// Apollo fallback — fills remaining company slots when Perplexity finds < 20
// These leads are tagged as "apollo" source (COLD)
// Strategy: run multiple focused searches by industry, not one giant keyword dump

import type { DiscoveredCompany } from "./discover-signals";
import { isExcludedEntity } from "./discover-signals";
import { safeFetchJson } from "./safe-fetch";

export async function apolloFallback(
  existingCompanies: DiscoveredCompany[],
  keywords: string[],
  industries: string[],
  geography: string[],
  targetCount: number = 20,
  options: { employeeMin?: number; employeeMax?: number; excludeCompanyNames?: Set<string> } = {}
): Promise<DiscoveredCompany[]> {
  const remaining = targetCount - existingCompanies.length;
  if (remaining <= 0) return existingCompanies;

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return existingCompanies;

  const existingNames = new Set(
    existingCompanies.map((c) => c.name.toLowerCase().trim())
  );
  const allExcluded = options.excludeCompanyNames
    ? new Set([...existingNames, ...options.excludeCompanyNames])
    : existingNames;

  // Base params shared across all searches
  const baseParams: Record<string, unknown> = {
    per_page: Math.min(remaining + 15, 50),
    page: 1,
  };
  if (geography.length > 0) {
    baseParams.organization_locations = geography;
  }
  if (options.employeeMin || options.employeeMax) {
    baseParams.organization_num_employees_ranges = [
      `${options.employeeMin || 1},${options.employeeMax || 10000}`,
    ];
  }

  // Strategy: run 2-3 focused searches using top keywords, not all 56 ORed together
  // Pick the most specific keywords (shorter lists = more relevant results)
  const topKeywords = keywords.slice(0, 5);
  const topIndustries = industries.slice(0, 5);

  const searches: Record<string, unknown>[] = [];

  // Search 1: Keywords only (most specific)
  if (topKeywords.length > 0) {
    searches.push({
      ...baseParams,
      q_keywords: topKeywords.join(" OR "),
    });
  }

  // Search 2: Industries only (broader)
  if (topIndustries.length > 0) {
    searches.push({
      ...baseParams,
      q_keywords: topIndustries.join(" OR "),
    });
  }

  // Search 3: Mix top keyword + top industry for tighter targeting
  if (topKeywords.length > 0 && topIndustries.length > 0) {
    searches.push({
      ...baseParams,
      q_keywords: `${topKeywords[0]} ${topIndustries[0]}`,
    });
  }

  // Collect all unique companies across searches
  const allCompanies = new Map<string, DiscoveredCompany>();

  for (const params of searches) {
    if (allCompanies.size >= remaining) break;

    const { ok, data } = await safeFetchJson(
      "https://api.apollo.io/api/v1/mixed_companies/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify(params),
      }
    );

    if (!ok || !Array.isArray(data.organizations)) continue;

    for (const org of data.organizations as Record<string, unknown>[]) {
      const name = ((org.name as string) || "").toLowerCase().trim();
      if (!name || name === "unknown") continue;
      if (allExcluded.has(name)) continue;
      if (allCompanies.has(name)) continue;
      if (isExcludedEntity((org.name as string) || "")) continue;

      allCompanies.set(name, {
        name: (org.name as string) || "Unknown",
        domain: (org.primary_domain as string) || null,
        industry: (org.industry as string) || null,
        location: [org.city, org.state, org.country].filter(Boolean).join(", ") || null,
        signal_id: "",
        signal_name: "Database Match",
        evidence: `Matched from Apollo database — ${(org.short_description as string) || (org.industry as string) || "no description"}`,
        source_url: null,
        confidence: 0.3,
        source: "apollo" as const,
      });

      if (allCompanies.size >= remaining) break;
    }
  }

  return [...existingCompanies, ...Array.from(allCompanies.values())];
}
