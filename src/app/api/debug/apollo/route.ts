import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" });

  const tests = [];

  // Test 1: Company search
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        q_keywords: "construction builder",
        organization_locations: ["Australia"],
        organization_num_employees_ranges: ["10,500"],
        per_page: 3,
      }),
    });
    const data = await res.json();
    const orgs = data.organizations || [];
    tests.push({
      test: "company_search",
      status: res.ok ? "ok" : "error",
      count: orgs.length,
      sample: orgs.slice(0, 2).map((o: Record<string, unknown>) => ({
        name: o.name,
        domain: o.primary_domain,
        id: o.id,
        employees: o.estimated_num_employees,
      })),
    });

    // Test 2: People search by company name
    if (orgs.length > 0) {
      const companyName = orgs[0].name as string;
      const companyDomain = orgs[0].primary_domain as string;
      const companyId = orgs[0].id as string;

      // Strategy A: by domain
      const resA = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          q_organization_domains: companyDomain,
          person_seniorities: ["owner", "founder", "c_suite", "vp", "director"],
          per_page: 3,
        }),
      });
      const dataA = await resA.json();
      tests.push({
        test: "people_by_domain",
        company: companyName,
        domain: companyDomain,
        status: resA.ok ? "ok" : `error_${resA.status}`,
        count: (dataA.people || []).length,
        sample: (dataA.people || []).slice(0, 2).map((p: Record<string, unknown>) => ({
          name: `${p.first_name} ${p.last_name}`,
          title: p.title,
          email: p.email || "none",
        })),
        raw_error: dataA.error || null,
      });

      // Strategy B: by org ID
      const resB = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          organization_ids: [companyId],
          person_seniorities: ["owner", "founder", "c_suite", "vp", "director"],
          per_page: 3,
        }),
      });
      const dataB = await resB.json();
      tests.push({
        test: "people_by_org_id",
        company: companyName,
        org_id: companyId,
        status: resB.ok ? "ok" : `error_${resB.status}`,
        count: (dataB.people || []).length,
        sample: (dataB.people || []).slice(0, 2).map((p: Record<string, unknown>) => ({
          name: `${p.first_name} ${p.last_name}`,
          title: p.title,
          email: p.email || "none",
        })),
        raw_error: dataB.error || null,
      });

      // Strategy C: by company name
      const resC = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          q_organization_name: companyName,
          person_seniorities: ["owner", "founder", "c_suite", "vp", "director"],
          per_page: 3,
        }),
      });
      const dataC = await resC.json();
      tests.push({
        test: "people_by_name",
        company: companyName,
        status: resC.ok ? "ok" : `error_${resC.status}`,
        count: (dataC.people || []).length,
        sample: (dataC.people || []).slice(0, 2).map((p: Record<string, unknown>) => ({
          name: `${p.first_name} ${p.last_name}`,
          title: p.title,
          email: p.email || "none",
        })),
        raw_error: dataC.error || null,
      });
    }
  } catch (err) {
    tests.push({ test: "error", message: String(err) });
  }

  return NextResponse.json({ tests });
}
