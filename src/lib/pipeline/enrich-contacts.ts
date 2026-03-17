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

  // Process in batches of 5
  for (let i = 0; i < signalResults.length; i += 5) {
    const batch = signalResults.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((result) =>
        findContactForCompany(result, targetTitles, apiKey)
      )
    );
    enriched.push(...batchResults.filter(Boolean) as EnrichedLead[]);

    if (i + 5 < signalResults.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return enriched;
}

async function findContactForCompany(
  result: SignalResult,
  targetTitles: string[],
  apiKey: string
): Promise<EnrichedLead | null> {
  try {
    // Search for people at this company matching target titles
    const response = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        organization_ids: [result.company.apollo_id],
        person_titles: targetTitles,
        per_page: 5,
        page: 1,
      }),
    });

    if (!response.ok) {
      console.error(
        `Apollo people search error for ${result.company.name}: ${response.status}`
      );
      return null;
    }

    const data = await response.json();
    const people = data.people || [];

    if (people.length === 0) return null;

    // Pick the best match — prefer those with email
    const bestMatch =
      people.find((p: Record<string, unknown>) => p.email) || people[0];

    return {
      company: result.company,
      matched_signals: result.matched_signals,
      total_score: result.total_score,
      contact: {
        name: `${bestMatch.first_name || ""} ${bestMatch.last_name || ""}`.trim() || "Unknown",
        title: (bestMatch.title as string) || "Unknown",
        email: (bestMatch.email as string) || null,
        phone:
          (bestMatch.phone_numbers?.[0]?.sanitized_number as string) || null,
        linkedin_url: (bestMatch.linkedin_url as string) || null,
        apollo_id: bestMatch.id as string,
      },
    };
  } catch (error) {
    console.error(`Contact enrichment failed for ${result.company.name}:`, error);
    return null;
  }
}
