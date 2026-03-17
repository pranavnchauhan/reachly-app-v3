// Step 3: Enrich companies with decision-maker contacts via Apollo

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
      batch.map((result) => findContactForCompany(result, targetTitles, apiKey))
    );
    enriched.push(...(batchResults.filter(Boolean) as EnrichedLead[]));

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
  const strategies = [
    () => searchPeople({ q_organization_domains: result.company.domain }, result, apiKey),
    () => searchPeople({ organization_ids: [result.company.apollo_id] }, result, apiKey),
    () => searchPeople({ q_organization_name: result.company.name }, result, apiKey),
  ];

  // Skip domain search if no domain
  const start = result.company.domain ? 0 : 1;

  for (let i = start; i < strategies.length; i++) {
    const lead = await strategies[i]();
    if (lead) return lead;
  }

  return null;
}

async function searchPeople(
  filter: Record<string, unknown>,
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  const { ok, data } = await safeFetchJson(
    "https://api.apollo.io/api/v1/mixed_people/api_search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        ...filter,
        person_seniorities: ["owner", "founder", "c_suite", "vp", "director", "manager"],
        per_page: 5,
        page: 1,
      }),
    }
  );

  if (!ok) return null;

  const people = (data.people as Record<string, unknown>[]) || [];
  if (people.length === 0) return null;

  const withEmail = people.filter((p) => p.email);
  const best = withEmail.length > 0 ? withEmail[0] : people[0];

  return {
    company: result.company,
    matched_signals: result.matched_signals,
    total_score: result.total_score,
    contact: {
      name: `${best.first_name || ""} ${best.last_name || ""}`.trim() || "Unknown",
      title: (best.title as string) || "Unknown",
      email: (best.email as string) || null,
      phone: (best.phone_number as string) || null,
      linkedin_url: (best.linkedin_url as string) || null,
      apollo_id: (best.id as string) || "",
    },
  };
}
