// Step 2: Enrich verified hot leads with decision-maker contacts via Apollo
// Uses api_search (free) to find people, then people/match (paid credits) to get email/phone
// Title-matching: loops through candidates until finding one matching target_titles

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

  // Normalize target titles for matching
  const normalizedTitles = targetTitles.map((t) => t.toLowerCase().trim());

  const enriched: EnrichedLead[] = [];

  // Process in batches of 5
  for (let i = 0; i < signalResults.length; i += 5) {
    const batch = signalResults.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((result) => findAndEnrichContact(result, apiKey, normalizedTitles))
    );
    enriched.push(...(batchResults.filter(Boolean) as EnrichedLead[]));

    if (i + 5 < signalResults.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return enriched;
}

async function findAndEnrichContact(
  result: SignalResult,
  apiKey: string,
  targetTitles: string[]
): Promise<EnrichedLead | null> {
  // Step A: Search for people (free, no credits) — get up to 10 candidates
  const candidates = await searchForPeople(result, apiKey);
  if (!candidates.length) return null;

  // Step B: Find best title match from candidates
  const bestCandidate = findBestTitleMatch(candidates, targetTitles);
  if (!bestCandidate) return null;

  // Step C: Enrich with email/phone (costs credits)
  return enrichPerson(bestCandidate, result, apiKey);
}

function findBestTitleMatch(
  candidates: Record<string, unknown>[],
  targetTitles: string[]
): Record<string, unknown> | null {
  // Score each candidate by how well their title matches target titles
  const scored = candidates.map((person) => {
    const title = ((person.title as string) || "").toLowerCase();
    let score = 0;

    // Exact title match
    if (targetTitles.some((t) => title === t)) {
      score = 100;
    }
    // Title contains a target title
    else if (targetTitles.some((t) => title.includes(t))) {
      score = 80;
    }
    // Target title contains this title
    else if (targetTitles.some((t) => t.includes(title) && title.length > 3)) {
      score = 70;
    }
    // Common decision-maker keywords even if not in target_titles
    else if (/\b(ceo|coo|cfo|founder|owner|managing director|general manager|head of|director|vp|vice president)\b/i.test(title)) {
      score = 50;
    }
    // Manager-level
    else if (/\b(manager|lead|principal|partner)\b/i.test(title)) {
      score = 30;
    }

    // Penalize clearly wrong titles (artist, technician, intern, etc.)
    if (/\b(artist|intern|student|assistant|receptionist|technician|coordinator|clerk)\b/i.test(title)) {
      score = Math.max(0, score - 40);
    }

    return { person, score };
  });

  // Sort by score descending, take highest
  scored.sort((a, b) => b.score - a.score);

  // Must have at least score 30 (manager-level or above)
  if (scored[0]?.score >= 30) return scored[0].person;

  // If no good title match, still return the first c_suite/director person
  return scored[0]?.score > 0 ? scored[0].person : null;
}

async function searchForPeople(
  result: SignalResult,
  apiKey: string
): Promise<Record<string, unknown>[]> {
  const seniorities = ["owner", "founder", "c_suite", "vp", "director", "manager"];
  const searches = [
    // Try domain-based AU contacts first
    result.company.domain
      ? { q_organization_domains: result.company.domain, person_seniorities: seniorities, person_locations: ["Australia"] }
      : null,
    // Name-based AU contacts
    { q_organization_name: result.company.name, person_seniorities: seniorities, person_locations: ["Australia"] },
    // Domain-based any location
    result.company.domain
      ? { q_organization_domains: result.company.domain, person_seniorities: seniorities }
      : null,
    // Name-based any location
    { q_organization_name: result.company.name, person_seniorities: seniorities },
  ].filter(Boolean);

  for (const params of searches) {
    const { ok, data } = await safeFetchJson(
      "https://api.apollo.io/api/v1/mixed_people/api_search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ ...params, per_page: 10, page: 1 }),
      }
    );

    if (!ok) continue;
    const people = (data.people as Record<string, unknown>[]) || [];
    if (people.length > 0) return people; // Return all candidates for title matching
  }

  return [];
}

async function enrichPerson(
  person: Record<string, unknown>,
  result: SignalResult,
  apiKey: string
): Promise<EnrichedLead | null> {
  const firstName = (person.first_name as string) || "";
  const lastName = (person.last_name as string) || "";
  const personId = person.id as string;

  const matchParams: Record<string, unknown> = {};

  if (personId) {
    matchParams.id = personId;
  } else if (firstName && lastName && result.company.domain) {
    matchParams.first_name = firstName;
    matchParams.last_name = lastName;
    matchParams.domain = result.company.domain;
  } else if (person.linkedin_url) {
    matchParams.linkedin_url = person.linkedin_url;
  } else {
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
    return buildLeadFromSearch(person, result);
  }

  const enrichedPerson = data.person as Record<string, unknown>;
  const org = enrichedPerson.organization as Record<string, unknown> | undefined;
  const phones = enrichedPerson.phone_numbers as Record<string, string>[] | undefined;

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
