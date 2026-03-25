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

// ─── Auth helper ────────────────────────────────────────────────────
async function authenticateRequest(request: Request): Promise<{ authorized: boolean; userId?: string }> {
  const authHeader = request.headers.get("authorization");
  const body = await request.clone().json().catch(() => ({}));
  const { secret } = body as { secret?: string };

  // Cron secret auth
  if (CRON_SECRET && (secret === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`)) {
    return { authorized: true };
  }

  // User token auth
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return { authorized: false };

  const adminClient = createAdminClient();
  const { data: { user } } = await adminClient.auth.getUser(token);
  if (!user) return { authorized: false };

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) return { authorized: false };

  return { authorized: true, userId: user.id };
}

// ─── POST: Kick off pipeline (returns immediately) ──────────────────
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { nicheId } = body as { nicheId?: string };

  const supabase = createAdminClient();

  // Create a pipeline run record
  const { data: run, error: runError } = await supabase
    .from("pipeline_runs")
    .insert({
      niche_id: nicheId || null,
      status: "running",
      current_step: "starting",
      progress: {},
      started_by: auth.userId || null,
    })
    .select("id")
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: "Failed to create pipeline run", details: runError?.message }, { status: 500 });
  }

  // Fire and forget — run pipeline in background
  executePipeline(run.id, nicheId || null).catch((err) => {
    console.error("Background pipeline crashed:", err);
  });

  return NextResponse.json({ run_id: run.id, status: "running" });
}

// ─── Background pipeline execution ─────────────────────────────────
async function executePipeline(runId: string, nicheId: string | null) {
  const supabase = createAdminClient();

  async function updateRun(current_step: string, progress: Record<string, unknown>) {
    await supabase
      .from("pipeline_runs")
      .update({ current_step, progress })
      .eq("id", runId);
  }

  async function failRun(error: string) {
    await supabase
      .from("pipeline_runs")
      .update({ status: "failed", error, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  async function completeRun(result: unknown) {
    await supabase
      .from("pipeline_runs")
      .update({ status: "completed", current_step: "done", result, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  try {
    // Load niches
    await updateRun("loading_niches", {});
    let query = supabase.from("client_niches").select("*, niche_templates(*)").eq("is_active", true);
    if (nicheId) query = query.eq("id", nicheId);
    const { data: niches, error: nicheError } = await query;

    if (nicheError || !niches?.length) {
      await failRun(nicheError?.message || "No active niches to process");
      return;
    }

    const results = [];
    const batchId = `batch_${Date.now()}`;

    for (const niche of niches) {
      const template = niche.niche_templates;
      if (!template) continue;

      const allSignals = (template.signals as Signal[]) || [];
      const enabledSignals = niche.enabled_signals?.length
        ? allSignals.filter((s: Signal) => niche.enabled_signals.includes(s.id))
        : allSignals;
      const signalsToSearch = enabledSignals.slice(0, 5);

      // ─── Step 1: Signal discovery (Perplexity) ──────────────────
      await updateRun("discovering", { niche: niche.name, step: "Searching news for buying signals..." });

      let discovered = await discoverSignals(signalsToSearch, niche.geography || []);
      const hotCount = discovered.length;

      await updateRun("discovering", { niche: niche.name, step: `Found ${hotCount} companies from news`, hot: hotCount });

      // ─── Step 2: Apollo fallback ────────────────────────────────
      if (discovered.length < 20) {
        await updateRun("apollo_fallback", { niche: niche.name, step: "Filling remaining slots from Apollo..." });

        discovered = await apolloFallback(
          discovered,
          template.keywords || [],
          template.industries || [],
          niche.geography || []
        );

        await updateRun("apollo_fallback", {
          niche: niche.name,
          step: `${discovered.length} total companies (${hotCount} hot, ${discovered.length - hotCount} cold)`,
          hot: hotCount,
          cold: discovered.length - hotCount,
        });
      }

      if (discovered.length === 0) {
        results.push({ niche: niche.name, step: "discovery", hot: 0, cold: 0, leads: 0, detail: "No companies found" });
        continue;
      }

      // ─── Step 3: Enrich contacts ────────────────────────────────
      await updateRun("enriching", { niche: niche.name, step: "Finding decision-maker contacts..." });

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

      const enrichedLeads = await enrichContacts(signalResults, template.target_titles || []);

      await updateRun("enriching", {
        niche: niche.name,
        step: `${enrichedLeads.length} leads with contacts`,
        enriched: enrichedLeads.length,
      });

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

      // ─── Step 4: Deep research (top 5) ──────────────────────────
      await updateRun("researching", { niche: niche.name, step: "AI-researching top leads..." });

      let researchedLeads = await deepResearch(
        enrichedLeads.slice(0, 5),
        template.description || template.name
      );

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

      await updateRun("researching", {
        niche: niche.name,
        step: `${researchedLeads.length} leads fully processed`,
        researched: Math.min(enrichedLeads.length, 5),
      });

      // ─── Step 5: Store leads ────────────────────────────────────
      await updateRun("saving", { niche: niche.name, step: "Saving leads to database..." });

      const leadsToInsert = researchedLeads.map((lead) => {
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
        };
      });

      const { error: insertError } = await supabase.from("leads").insert(leadsToInsert);
      if (insertError) console.error("Insert error:", insertError);

      results.push({
        niche: niche.name,
        hot: hotCount,
        cold: discovered.length - hotCount,
        enriched: enrichedLeads.length,
        researched: Math.min(enrichedLeads.length, 5),
        leads: researchedLeads.length,
      });
    }

    await completeRun({ batch_id: batchId, results });
  } catch (error) {
    console.error("Pipeline error:", error);
    await failRun(String(error));
  }
}

// ─── GET: Cron handler ──────────────────────────────────────────────
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
