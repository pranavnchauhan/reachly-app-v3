import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverSignals } from "@/lib/pipeline/discover-signals";
import { apolloFallback } from "@/lib/pipeline/apollo-fallback";
import { enrichContacts } from "@/lib/pipeline/enrich-contacts";
import { deepResearch } from "@/lib/pipeline/deep-research";
import type { Signal } from "@/types/database";
import type { SignalResult } from "@/lib/pipeline/find-signals";

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes (Vercel Pro)

export async function POST(request: Request) {
  // Auth: either cron secret or admin user
  const authHeader = request.headers.get("authorization");
  const { nicheId, secret } = await request.json().catch(() => ({ nicheId: null, secret: null }));

  if (CRON_SECRET && secret !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    const adminClient = createAdminClient();
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  try {
    let query = supabase.from("client_niches").select("*, niche_templates(*)").eq("is_active", true);
    if (nicheId) query = query.eq("id", nicheId);
    const { data: niches, error: nicheError } = await query;

    if (nicheError || !niches?.length) {
      return NextResponse.json({ message: "No active niches to process", error: nicheError?.message });
    }

    const results = [];
    const batchId = `batch_${Date.now()}`;

    for (const niche of niches) {
      const template = niche.niche_templates;
      if (!template) continue;

      console.log(`Processing niche: ${niche.name} (${niche.id})`);

      // Get enabled signals (max 5 for API efficiency)
      const allSignals = (template.signals as Signal[]) || [];
      const enabledSignals = niche.enabled_signals?.length
        ? allSignals.filter((s) => niche.enabled_signals.includes(s.id))
        : allSignals;
      const signalsToSearch = enabledSignals.slice(0, 5);

      // ─── Step 1: Signal-first discovery (Perplexity) ───────────────
      let discovered = await discoverSignals(
        signalsToSearch,
        niche.geography || []
      );
      console.log(`  Perplexity found ${discovered.length} companies from news`);

      const hotCount = discovered.length;

      // ─── Step 2: Apollo fallback if < 20 ───────────────────────────
      if (discovered.length < 20) {
        discovered = await apolloFallback(
          discovered,
          template.keywords || [],
          template.industries || [],
          niche.geography || []
        );
        console.log(`  After Apollo fallback: ${discovered.length} total (${discovered.length - hotCount} cold)`);
      }

      if (discovered.length === 0) {
        results.push({ niche: niche.name, step: "discovery", hot: 0, cold: 0, leads: 0, detail: "No companies found" });
        continue;
      }

      // ─── Step 3: Enrich contacts (Apollo people/match) ─────────────
      // Convert discovered companies to SignalResult format for enrichment
      const signalResults: SignalResult[] = discovered.map((d) => ({
        company: {
          name: d.name,
          domain: d.domain,
          industry: d.industry || "Unknown",
          employee_count: null,
          location: d.location,
          description: null,
          apollo_id: "",
        },
        matched_signals: [{
          signal_id: d.signal_id,
          signal_name: d.signal_name,
          evidence: d.evidence,
          confidence: d.confidence,
          source_url: d.source_url,
        }],
        total_score: d.confidence * 10,
      }));

      let enrichedLeads = await enrichContacts(signalResults, template.target_titles || []);
      console.log(`  ${enrichedLeads.length} leads with contacts`);

      if (enrichedLeads.length === 0) {
        results.push({
          niche: niche.name,
          step: "enrichment",
          hot: hotCount,
          cold: discovered.length - hotCount,
          leads: 0,
          detail: "No contacts found",
        });
        continue;
      }

      // ─── Step 4: Deep research (Claude) — top 5 ───────────────────
      let researchedLeads = await deepResearch(
        enrichedLeads.slice(0, 5),
        template.description || template.name
      );
      console.log(`  ${researchedLeads.length} leads fully researched`);

      // Add remaining enriched leads without deep research
      if (enrichedLeads.length > 5) {
        const remaining = enrichedLeads.slice(5).map((lead) => ({
          ...lead,
          justification: "Signal-matched lead (research pending)",
          contact_summary: "",
          approach_strategies: [],
          email_templates: [],
        }));
        researchedLeads = [...researchedLeads, ...remaining];
      }

      // ─── Step 5: Store leads ──────────────────────────────────────
      const leadsToInsert = researchedLeads.map((lead, idx) => {
        // Find the original discovered company to get source
        const original = discovered.find(
          (d) => d.name.toLowerCase() === lead.company.name.toLowerCase()
        );

        return {
          client_niche_id: niche.id,
          company_name: lead.company.name,
          company_website: lead.company.domain ? `https://${lead.company.domain}` : null,
          company_industry: lead.company.industry || "Unknown",
          company_size: lead.company.employee_count?.toString() || null,
          company_location: lead.company.location,
          signals_matched: lead.matched_signals.map((s) => ({
            ...s,
            source_url: original?.source_url || s.source_url || null,
          })),
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
          // Store source in signals_matched for now (lead_source field can be added to schema later)
        };
      });

      const { error: insertError } = await supabase.from("leads").insert(leadsToInsert);
      if (insertError) console.error("  Insert error:", insertError);

      results.push({
        niche: niche.name,
        hot: hotCount,
        cold: discovered.length - hotCount,
        enriched: enrichedLeads.length,
        researched: Math.min(enrichedLeads.length, 5),
        leads: researchedLeads.length,
      });
    }

    return NextResponse.json({ message: "Pipeline completed", batch_id: batchId, results });
  } catch (error) {
    console.error("Pipeline error:", error);
    return NextResponse.json({ error: "Pipeline failed", details: String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return POST(new Request(request.url, {
    method: "POST",
    headers: { authorization: authHeader || "" },
    body: JSON.stringify({ secret: CRON_SECRET }),
  }));
}
