import { NextResponse } from "next/server";
import { safeFetchJson } from "@/lib/pipeline/safe-fetch";

// POST: Search Apollo for alternative contacts at a company
// Returns top candidates for admin to choose from
export async function POST(request: Request) {
  const { companyName, companyDomain } = await request.json();

  if (!companyName && !companyDomain) {
    return NextResponse.json({ error: "companyName or companyDomain required" }, { status: 400 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  const seniorities = ["owner", "founder", "c_suite", "vp", "director", "manager"];

  // Try domain-based search first, then name-based
  const searches = [
    companyDomain ? { q_organization_domains: companyDomain, person_seniorities: seniorities, person_locations: ["Australia"] } : null,
    { q_organization_name: companyName, person_seniorities: seniorities, person_locations: ["Australia"] },
    companyDomain ? { q_organization_domains: companyDomain, person_seniorities: seniorities } : null,
    { q_organization_name: companyName, person_seniorities: seniorities },
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
    if (people.length === 0) continue;

    // Return candidates (without spending enrich credits yet)
    const candidates = people.map((p) => ({
      id: p.id as string,
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      title: (p.title as string) || "Unknown",
      linkedin_url: (p.linkedin_url as string) || null,
      city: (p.city as string) || null,
      state: (p.state as string) || null,
    }));

    return NextResponse.json({ candidates });
  }

  return NextResponse.json({ candidates: [] });
}

// PATCH: Enrich a specific candidate (costs 1 Apollo credit)
export async function PATCH(request: Request) {
  const { candidateId } = await request.json();

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  const { ok, data } = await safeFetchJson(
    "https://api.apollo.io/api/v1/people/match",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ id: candidateId }),
    }
  );

  if (!ok || !data.person) {
    return NextResponse.json({ error: "Could not enrich contact" }, { status: 404 });
  }

  const p = data.person as Record<string, unknown>;
  const phones = p.phone_numbers as Record<string, string>[] | undefined;

  return NextResponse.json({
    contact: {
      contact_name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      contact_title: (p.title as string) || "Unknown",
      contact_email: (p.email as string) || null,
      contact_phone: phones?.[0]?.sanitized_number || null,
      contact_linkedin: (p.linkedin_url as string) || null,
      contact_summary: null, // Admin can review
    },
  });
}
