// Step 3: Enrich companies with decision-maker contacts via Apollo
// Uses api_search (free, no credits) to find people, then people/match (credits) to get email/phone

import type { SignalResult } from "./find-signals";
import { safeFetchJson } from "./safe-fetch";

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

  for (let i = 0; i < signalResults.length; i += 3) {
    const batch = signalResults.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((result) => findAndEnrichContact(result, apiKey))
    );
    enriched.push(...(batchResults.filter(Boolean) as EnrichedLead[]));

    if (i + 3 < signalResults.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return enriched;
}

async function findAndEnrichContact(
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  // Step A: Search for people (free, no credits)
  const person = await searchForPerson(result, apiKey);
  if (!person) return null;

  // Step B: Enrich with email/phone (costs credits)
  const enriched = await enrichPerson(person, result, apiKey);
  return enriched;
}

async function searchForPerson(
  result: SignalResult,
  apiKey: string
): Promise<Record<string, unknown> | null> {
  const searches = [
    result.company.domain
      ? { q_organization_domains: result.company.domain, person_seniorities: ["owner", "founder", "c_suite", "vp", "director"] }
      : null,
    { organization_ids: [result.company.apollo_id], person_seniorities: ["owner", "founder", "c_suite", "vp", "director"] },
    { q_organization_name: result.company.name, person_seniorities: ["owner", "founder", "c_suite", "vp", "director"] },
  ].filter(Boolean);

  for (const params of searches) {
    const { ok, data } = await safeFetchJson(
      "https://api.apollo.io/api/v1/mixed_people/api_search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ ...params, per_page: 5, page: 1 }),
      }
    );

    if (!ok) continue;
    const people = (data.people as Record<string, unknown>[]) || [];
    if (people.length > 0) return people[0];
  }

  return null;
}

async function enrichPerson(
  person: Record<string, unknown>,
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  const firstName = (person.first_name as string) || "";
  const lastName = (person.last_name as string) || "";
  const personId = person.id as string;

  // Use people/match to get email (costs Apollo credits)
  // Note: phone numbers require webhook — not supported yet
  const matchParams: Record<string, unknown> = {};

  // Prefer matching by Apollo ID
  if (personId) {
    matchParams.id = personId;
  } else if (firstName && lastName && result.company.domain) {
    matchParams.first_name = firstName;
    matchParams.last_name = lastName;
    matchParams.domain = result.company.domain;
  } else if (person.linkedin_url) {
    matchParams.linkedin_url = person.linkedin_url;
  } else {
    // Can't enrich without identifiers — use search data as-is
    return buildLeadFromSearch(person, result);
  }

  const { ok, data } = await safeFetchJson(
    "https://api.apollo.io/api/v1/people/match",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(matchParams),
    }
  );

  if (!ok || !data.person) {
    // Fallback to search data without enrichment
    return buildLeadFromSearch(person, result);
  }

  const enrichedPerson = data.person as Record<string, unknown>;
  const org = enrichedPerson.organization as Record<string, unknown> | undefined;
  const phones = enrichedPerson.phone_numbers as Record<string, string>[] | undefined;

  // Update company data from enriched org info
  if (org) {
    if (org.industry) result.company.industry = org.industry as string;
    if (org.estimated_num_employees) result.company.employee_count = org.estimated_num_employees as number;
    if (org.city || org.state || org.country) {
      result.company.location = [org.city, org.state, org.country].filter(Boolean).join(", ");
    }
  }

  return {
    company: result.company,
    matched_signals: result.matched_signals,
    total_score: result.total_score,
    contact: {
      name: `${enrichedPerson.first_name || firstName} ${enrichedPerson.last_name || lastName}`.trim() || "Unknown",
      title: (enrichedPerson.title as string) || (person.title as string) || "Unknown",
      email: (enrichedPerson.email as string) || null,
      phone: phones?.[0]?.sanitized_number || (enrichedPerson.phone_number as string) || null,
      linkedin_url: (enrichedPerson.linkedin_url as string) || (person.linkedin_url as string) || null,
      apollo_id: (enrichedPerson.id as string) || personId || "",
    },
  };
}

function buildLeadFromSearch(
  person: Record<string, unknown>,
  result: SignalResult
): EnrichedLead {
  return {
    company: result.company,
    matched_signals: result.matched_signals,
    total_score: result.total_score,
    contact: {
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Unknown",
      title: (person.title as string) || "Unknown",
      email: null,
      phone: null,
      linkedin_url: (person.linkedin_url as string) || null,
      apollo_id: (person.id as string) || "",
    },
  };
}
