// Step 1: Source companies from Apollo matching niche criteria

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

  // Build Apollo organization search query
  const searchParams: Record<string, unknown> = {
    per_page: Math.min(limit, 100),
    page: 1,
    organization_num_employees_ranges: [
      `${criteria.employee_min},${criteria.employee_max}`,
    ],
  };

  // Add industry filter
  if (criteria.industries.length > 0) {
    searchParams.organization_industry_tag_ids = criteria.industries;
  }

  // Add keyword filter
  if (criteria.keywords.length > 0) {
    searchParams.q_organization_keyword_tags = criteria.keywords;
  }

  // Add geography filter
  if (criteria.geography.length > 0) {
    searchParams.organization_locations = criteria.geography;
  }

  const response = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(searchParams),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apollo API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const organizations = data.organizations || [];

  // Filter out excluded companies
  const excludedSet = new Set(
    criteria.excluded_companies.map((c) => c.toLowerCase())
  );

  return organizations
    .filter(
      (org: Record<string, unknown>) =>
        !excludedSet.has((org.name as string || "").toLowerCase())
    )
    .map(
      (org: Record<string, unknown>): SourcedCompany => ({
        name: (org.name as string) || "Unknown",
        domain: (org.primary_domain as string) || null,
        industry: (org.industry as string) || "Unknown",
        employee_count: (org.estimated_num_employees as number) || null,
        location:
          [org.city, org.state, org.country]
            .filter(Boolean)
            .join(", ") || null,
        description: (org.short_description as string) || null,
        apollo_id: org.id as string,
      })
    );
}
