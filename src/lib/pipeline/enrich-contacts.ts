// Step 3: Enrich companies with decision-maker contacts via Apollo

import type { SignalResult } from "./find-signals";

export interface EnrichedLead {
  company: SignalResult["company"];
  matched_signals: SignalResult["matched_signals"];
  total_score: number;
  contact: {
    name: string;
    title: string;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    apollo_id: string;
  };
}

export async function enrichContacts(
  signalResults: SignalResult[],
  targetTitles: string[]
): Promise<EnrichedLead[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY not set");

  const enriched: EnrichedLead[] = [];

  // Process in batches of 3 to avoid rate limits
  for (let i = 0; i < signalResults.length; i += 3) {
    const batch = signalResults.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((result) =>
        findContactForCompany(result, targetTitles, apiKey)
      )
    );
    enriched.push(...batchResults.filter(Boolean) as EnrichedLead[]);

    if (i + 3 < signalResults.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return enriched;
}

async function findContactForCompany(
  result: SignalResult,
  targetTitles: string[],
  apiKey: string
): Promise<EnrichedLead | null> {
  // Try multiple search strategies using the NEW api_search endpoint
  const strategies = [
    () => searchByDomain(result, apiKey),
    () => searchByOrgId(result, apiKey),
    () => searchByCompanyName(result, apiKey),
  ];

  for (const strategy of strategies) {
    try {
      const lead = await strategy();
      if (lead) return lead;
    } catch (error) {
      console.error(`Contact search failed for ${result.company.name}:`, error);
    }
  }

  return null;
}

async function apolloPeopleSearch(
  params: Record<string, unknown>,
  apiKey: string
): Promise<Record<string, unknown>[]> {
  const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      ...params,
      per_page: 5,
      page: 1,
    }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.people || [];
}

async function searchByDomain(
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  if (!result.company.domain) return null;

  const people = await apolloPeopleSearch({
    q_organization_domains: result.company.domain,
    person_seniorities: ["owner", "founder", "c_suite", "vp", "director", "manager"],
  }, apiKey);

  return pickBestContact(people, result);
}

async function searchByOrgId(
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  const people = await apolloPeopleSearch({
    organization_ids: [result.company.apollo_id],
    person_seniorities: ["owner", "founder", "c_suite", "vp", "director"],
  }, apiKey);

  return pickBestContact(people, result);
}

async function searchByCompanyName(
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  const people = await apolloPeopleSearch({
    q_organization_name: result.company.name,
    person_seniorities: ["owner", "founder", "c_suite", "vp", "director"],
  }, apiKey);

  return pickBestContact(people, result);
}

function pickBestContact(
  people: Record<string, unknown>[],
  result: SignalResult
): EnrichedLead | null {
  if (people.length === 0) return null;

  // Prefer people with email, then by seniority
  const withEmail = people.filter((p) => p.email);
  const bestMatch = withEmail.length > 0 ? withEmail[0] : people[0];

  return {
    company: result.company,
    matched_signals: result.matched_signals,
    total_score: result.total_score,
    contact: {
      name: `${bestMatch.first_name || ""} ${bestMatch.last_name || ""}`.trim() || "Unknown",
      title: (bestMatch.title as string) || "Unknown",
      email: (bestMatch.email as string) || null,
      phone: (bestMatch.phone_number as string) ||
             ((bestMatch.phone_numbers as Record<string, string>[])?.[0]?.sanitized_number) || null,
      linkedin_url: (bestMatch.linkedin_url as string) || null,
      apollo_id: bestMatch.id as string,
    },
  };
}
