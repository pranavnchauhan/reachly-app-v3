// Apollo fallback — fills remaining company slots when Perplexity finds < 20
// These leads are tagged as "apollo" source (COLD)

import type { DiscoveredCompany } from "./discover-signals";
import { safeFetchJson } from "./safe-fetch";

import { isExcludedEntity } from "./discover-signals";

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
  // Also exclude companies from previous pipeline runs
  const allExcluded = options.excludeCompanyNames
    ? new Set([...existingNames, ...options.excludeCompanyNames])
    : existingNames;

  const allKeywords = [...keywords, ...industries];
  const searchParams: Record<string, unknown> = {
    per_page: Math.min(remaining + 10, 50), // extra buffer for dedup
    page: 1,
  };

  if (allKeywords.length > 0) {
    searchParams.q_keywords = allKeywords.slice(0, 10).join(" OR ");
  }
  if (geography.length > 0) {
    searchParams.organization_locations = geography;
  }
  // Employee size filter from niche template
  if (options.employeeMin || options.employeeMax) {
    searchParams.organization_num_employees_ranges = [
      `${options.employeeMin || 1},${options.employeeMax || 10000}`,
    ];
  }

  const { ok, data } = await safeFetchJson(
    "https://api.apollo.io/api/v1/mixed_companies/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(searchParams),
    }
  );

  if (!ok || !Array.isArray(data.organizations)) return existingCompanies;

  const apolloCompanies: DiscoveredCompany[] = (data.organizations as Record<string, unknown>[])
    .filter((org) => {
      const name = ((org.name as string) || "").toLowerCase().trim();
      return !allExcluded.has(name) && !isExcludedEntity((org.name as string) || "");
    })
    .slice(0, remaining)
    .map((org): DiscoveredCompany => ({
      name: (org.name as string) || "Unknown",
      domain: (org.primary_domain as string) || null,
      industry: (org.industry as string) || null,
      location: [org.city, org.state, org.country].filter(Boolean).join(", ") || null,
      signal_id: "",
      signal_name: "Database Match",
      evidence: `Matched from Apollo database — ${(org.short_description as string) || "no description"}`,
      source_url: null,
      confidence: 0.3, // Low confidence for cold leads
      source: "apollo" as const,
    }));

  return [...existingCompanies, ...apolloCompanies];
}
