import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sourceCompanies } from "@/lib/pipeline/source-companies";
import { findSignals } from "@/lib/pipeline/find-signals";
import { enrichContacts } from "@/lib/pipeline/enrich-contacts";
import { deepResearch } from "@/lib/pipeline/deep-research";
import type { Signal } from "@/types/database";

// Protect cron endpoint with a secret
const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes max (requires Vercel Pro)

export async function POST(request: Request) {
  // Auth: either cron secret or admin user
  const authHeader = request.headers.get("authorization");
  const { nicheId, secret } = await request.json().catch(() => ({ nicheId: null, secret: null }));

  if (CRON_SECRET && secret !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    // Check if it's an admin making a manual request
    const adminClient = createAdminClient();
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { data: profile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  try {
    // Get active client niches to process
    let query = supabase
      .from("client_niches")
      .select("*, niche_templates(*)")
      .eq("is_active", true);

    if (nicheId) {
      query = query.eq("id", nicheId);
    }

    const { data: niches, error: nicheError } = await query;

    if (nicheError || !niches?.length) {
      return NextResponse.json({
        message: "No active niches to process",
        error: nicheError?.message,
      });
    }

    const results = [];
    const batchId = `batch_${Date.now()}`;

    for (const niche of niches) {
      const template = niche.niche_templates;
      if (!template) continue;

      console.log(`Processing niche: ${niche.name} (${niche.id})`);

      // Step 1: Source companies (limit to 15 to stay within timeout)
      const companies = await sourceCompanies({
        industries: template.industries || [],
        keywords: template.keywords || [],
        employee_min: niche.employee_min ?? template.employee_min,
        employee_max: niche.employee_max ?? template.employee_max,
        geography: niche.geography || [],
        excluded_companies: niche.excluded_companies || [],
      }, 15);

      console.log(`  Sourced ${companies.length} companies`);

      if (companies.length === 0) {
        results.push({ niche: niche.name, step: "sourcing", companies: 0, leads: 0, detail: "Apollo returned no companies" });
        continue;
      }

      // Step 2: Detect signals
      const allSignals = (template.signals as Signal[]) || [];
      const enabledSignals = niche.enabled_signals?.length
        ? allSignals.filter((s) => niche.enabled_signals.includes(s.id))
        : allSignals;

      // Only check top 10 companies for signals to stay within timeout
      const signalResults = await findSignals(companies.slice(0, 10), enabledSignals);
      console.log(`  ${signalResults.length} companies with matching signals`);

      if (signalResults.length === 0) {
        results.push({ niche: niche.name, step: "signals", companies: companies.length, signals: 0, leads: 0, detail: "No buying signals detected" });
        continue;
      }

      // Step 3: Enrich contacts (top 20 by signal score)
      let enrichedLeads: Awaited<ReturnType<typeof enrichContacts>> = [];
      try {
        const topResults = signalResults.slice(0, 5);
        enrichedLeads = await enrichContacts(
          topResults,
          template.target_titles || []
        );
        console.log(`  ${enrichedLeads.length} leads with contacts`);
      } catch (err) {
        console.error("  Enrichment error:", err);
        results.push({
          niche: niche.name,
          step: "enrichment",
          companies: companies.length,
          signals: signalResults.length,
          leads: 0,
          detail: `Enrichment error: ${String(err).slice(0, 100)}`,
        });
        continue;
      }

      if (enrichedLeads.length === 0) {
        results.push({
          niche: niche.name,
          step: "enrichment",
          companies: companies.length,
          signals: signalResults.length,
          leads: 0,
          detail: "No contacts found for matched companies",
        });
        continue;
      }

      // Step 4: Deep research (top 10)
      let researchedLeads: Awaited<ReturnType<typeof deepResearch>> = [];
      try {
        const topLeads = enrichedLeads.slice(0, 3);
        researchedLeads = await deepResearch(
          topLeads,
          template.description || template.name
        );
        console.log(`  ${researchedLeads.length} leads fully researched`);
      } catch (err) {
        console.error("  Deep research error:", err);
        // Still save leads without deep research
        researchedLeads = enrichedLeads.slice(0, 10).map((lead) => ({
          ...lead,
          justification: "Signal-matched lead (research pending)",
          contact_summary: "",
          approach_strategies: [],
          email_templates: [],
        }));
      }

      // Step 5: Store as "discovered" leads
      const leadsToInsert = researchedLeads.map((lead) => ({
        client_niche_id: niche.id,
        company_name: lead.company.name,
        company_website: lead.company.domain
          ? `https://${lead.company.domain}`
          : null,
        company_industry: lead.company.industry,
        company_size: lead.company.employee_count?.toString() || null,
        company_location: lead.company.location,
        signals_matched: lead.matched_signals,
        justification: lead.justification,
        approach_strategies: lead.approach_strategies,
        contact_name: lead.contact.name,
        contact_title: lead.contact.title,
        contact_email: lead.contact.email,
        contact_phone: lead.contact.phone,
        contact_linkedin: lead.contact.linkedin_url,
        contact_summary: lead.contact_summary,
        email_templates: lead.email_templates,
        status: "discovered" as const,
        batch_id: batchId,
      }));

      const { error: insertError } = await supabase
        .from("leads")
        .insert(leadsToInsert);

      if (insertError) {
        console.error(`  Failed to insert leads:`, insertError);
      }

      results.push({
        niche: niche.name,
        companies: companies.length,
        signals: signalResults.length,
        enriched: enrichedLeads.length,
        leads: researchedLeads.length,
      });
    }

    return NextResponse.json({
      message: "Pipeline completed",
      batch_id: batchId,
      results,
    });
  } catch (error) {
    console.error("Pipeline error:", error);
    return NextResponse.json(
      { error: "Pipeline failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run for all active niches
  const response = await POST(
    new Request(request.url, {
      method: "POST",
      headers: { authorization: authHeader || "" },
      body: JSON.stringify({ secret: CRON_SECRET }),
    })
  );

  return response;
}
