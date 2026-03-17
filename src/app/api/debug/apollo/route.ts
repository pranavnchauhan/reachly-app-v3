import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" });

  const tests = [];

  // Step 1: Find a person via api_search (free)
  const searchRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      q_organization_name: "NEXTDC",
      person_seniorities: ["c_suite", "vp", "director"],
      per_page: 3,
    }),
  });
  const searchText = await searchRes.text();
  let searchData;
  try { searchData = JSON.parse(searchText); } catch { searchData = { error: searchText.slice(0, 200) }; }

  const people = searchData.people || [];
  tests.push({
    test: "api_search",
    status: searchRes.ok ? "ok" : `error_${searchRes.status}`,
    count: people.length,
    sample: people.slice(0, 2).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      title: p.title,
      email: p.email || "MISSING",
      phone: p.phone_number || "MISSING",
      linkedin: p.linkedin_url || "MISSING",
    })),
  });

  // Step 2: Enrich first person via /people/match (costs credits)
  if (people.length > 0) {
    const person = people[0] as Record<string, unknown>;

    const matchRes = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        id: person.id,
      }),
    });
    const matchText = await matchRes.text();
    let matchData;
    try { matchData = JSON.parse(matchText); } catch { matchData = { error: matchText.slice(0, 200) }; }

    const enriched = matchData.person || {};
    const phones = enriched.phone_numbers || [];

    tests.push({
      test: "people_match_enrichment",
      status: matchRes.ok ? "ok" : `error_${matchRes.status}`,
      person_id: person.id,
      enriched: {
        name: `${enriched.first_name || ""} ${enriched.last_name || ""}`.trim(),
        title: enriched.title || "MISSING",
        email: enriched.email || "MISSING",
        phone_number: enriched.phone_number || "MISSING",
        phone_numbers: phones.map((p: Record<string, string>) => p.sanitized_number || p.raw_number),
        linkedin_url: enriched.linkedin_url || "MISSING",
      },
      org: enriched.organization ? {
        name: (enriched.organization as Record<string, unknown>).name,
        industry: (enriched.organization as Record<string, unknown>).industry,
        employees: (enriched.organization as Record<string, unknown>).estimated_num_employees,
      } : "MISSING",
      raw_error: matchData.error || null,
    });
  }

  return NextResponse.json({ tests });
}
