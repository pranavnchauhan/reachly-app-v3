// Step 1: Source companies from Apollo matching niche criteria

import { safeFetchJson } from "./safe-fetch";

interface NicheCriteria {
  industries: string[];
  keywords: string[];
  employee_min: number;
  employee_max: number;
  geography: string[];
  excluded_companies: string[];
}

export interface SourcedCompany {
  name: string;
  domain: string | null;
  industry: string;
  employee_count: number | null;
  location: string | null;
  description: string | null;
  apollo_id: string;
}

export async function sourceCompanies(
  criteria: NicheCriteria,
  limit: number = 50
): Promise<SourcedCompany[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY not set");

  const searchParams: Record<string, unknown> = {
    per_page: Math.min(limit, 100),
    page: 1,
    organization_num_employees_ranges: [
      `${criteria.employee_min},${criteria.employee_max}`,
    ],
  };

  const allKeywords = [...criteria.keywords, ...criteria.industries];
  if (allKeywords.length > 0) {
    searchParams.q_keywords = allKeywords.slice(0, 10).join(" OR ");
  }

  if (criteria.geography.length > 0) {
    searchParams.organization_locations = criteria.geography;
  }

  const { ok, data } = await safeFetchJson(
    "https://api.apollo.io/api/v1/mixed_companies/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(searchParams),
    }
  );

  if (ok && Array.isArray(data.organizations)) {
    return processResults(data.organizations, criteria.excluded_companies);
  }

  // Fallback: simpler search
  const fallbackParams: Record<string, unknown> = {
    per_page: Math.min(limit, 100),
    page: 1,
    organization_num_employees_ranges: [
      `${criteria.employee_min},${criteria.employee_max}`,
    ],
  };
  if (criteria.geography.length > 0) {
    fallbackParams.organization_locations = criteria.geography;
  }
  if (criteria.keywords.length > 0) {
    fallbackParams.q_keywords = criteria.keywords.slice(0, 5).join(" ");
  }

  const fallback = await safeFetchJson(
    "https://api.apollo.io/api/v1/mixed_companies/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(fallbackParams),
    }
  );

  return processResults(
    (fallback.data.organizations as Record<string, unknown>[]) || [],
    criteria.excluded_companies
  );
}

function processResults(
  organizations: Record<string, unknown>[],
  excludedCompanies: string[]
): SourcedCompany[] {
  const excludedSet = new Set(excludedCompanies.map((c) => c.toLowerCase()));

  return organizations
    .filter((org) => !excludedSet.has(((org.name as string) || "").toLowerCase()))
    .map((org): SourcedCompany => ({
      name: (org.name as string) || "Unknown",
      domain: (org.primary_domain as string) || null,
      industry: (org.industry as string) || "Unknown",
      employee_count: (org.estimated_num_employees as number) || null,
      location: [org.city, org.state, org.country].filter(Boolean).join(", ") || null,
      description: (org.short_description as string) || null,
      apollo_id: org.id as string,
    }));
}
