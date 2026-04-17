import { NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverSignals } from "@/lib/pipeline/discover-signals";
import { enrichContacts } from "@/lib/pipeline/enrich-contacts";
import { deepResearch } from "@/lib/pipeline/deep-research";
import { lookupABN } from "@/lib/pipeline/lookup-abn";
import type { Signal } from "@/types/database";
import type { SignalResult } from "@/lib/pipeline/types";

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

  // Use after() to keep the serverless function alive after response is sent
  after(async () => {
    try {
      await executePipeline(run.id, nicheId || null);
    } catch (err) {
      console.error("Background pipeline crashed:", err);
      const sb = createAdminClient();
      await sb.from("pipeline_runs").update({
        status: "failed",
        error: String(err),
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
    }
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
    // Load niche templates (run once per master template, not per client niche)
    await updateRun("loading_niches", {});
    let query = supabase.from("niche_templates").select("*").eq("is_active", true);
    if (nicheId) {
      // If a specific client_niche was selected, get its template
      const { data: cn } = await supabase.from("client_niches").select("template_id").eq("id", nicheId).single();
      if (cn) query = query.eq("id", cn.template_id);
      else query = query.eq("id", nicheId); // Maybe they passed a template ID directly
    }
    const { data: templates, error: templateError } = await query;

    if (templateError || !templates?.length) {
      await failRun(templateError?.message || "No active niche templates to process");
      return;
    }

    const results = [];
    const batchId = `batch_${Date.now()}`;

    for (const template of templates) {
      const allSignals = (template.signals as Signal[]) || [];
      const signalsToSearch = allSignals.slice(0, 5);

      // Get geography from any active client niche using this template
      const { data: clientNiches } = await supabase
        .from("client_niches")
        .select("geography")
        .eq("template_id", template.id)
        .eq("is_active", true)
        .limit(1);
      const geography = clientNiches?.[0]?.geography || [];

      // ─── Pre-step: Get existing company names for dedup (last 90 days) ──
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("company_name")
        .eq("niche_template_id", template.id)
        .gte("created_at", ninetyDaysAgo);
      const excludeCompanyNames = new Set(
        (existingLeads || []).map((l: { company_name: string }) => l.company_name.toLowerCase().trim())
      );

      // ─── Step 1: Signal discovery — HOT LEADS ONLY ──────────────
      await updateRun("discovering", { niche: template.name, step: "Searching news for buying signals..." });

      const discovered = await discoverSignals(signalsToSearch, geography, {
        excludeCompanyNames,
      });
      const hotCount = discovered.length;

      await updateRun("discovering", { niche: template.name, step: `Found ${hotCount} verified hot leads from news`, hot: hotCount });

      if (discovered.length === 0) {
        results.push({ niche: template.name, step: "discovery", hot: 0, cold: 0, leads: 0, detail: "No verified signal-matched companies found" });
        continue;
      }

      // ─── Step 2: Enrich contacts ────────────────────────────────
      await updateRun("enriching", { niche: template.name, step: "Finding decision-maker contacts..." });

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
        niche: template.name,
        step: `${enrichedLeads.length} leads with contacts`,
        enriched: enrichedLeads.length,
      });

      if (enrichedLeads.length === 0) {
        results.push({
          niche: template.name,
          step: "enrichment",
          hot: hotCount,
          cold: discovered.length - hotCount,
          leads: 0,
          detail: "No contacts found",
        });
        continue;
      }

      // ─── Step 3: ABN Verification ────────────────────────────────
      await updateRun("verifying_abn", { niche: template.name, step: "Verifying ABNs via ABR..." });

      const abnResults = new Map<string, { abn: string | null; abn_status: string | null; gst_registered: boolean }>();
      for (const lead of enrichedLeads) {
        const result = await lookupABN(lead.company.name);
        abnResults.set(lead.company.name.toLowerCase(), {
          abn: result?.abn || null,
          abn_status: result?.is_active ? "Active" : (result?.abn_status || null),
          gst_registered: result?.gst_registered || false,
        });
      }

      const abnVerified = [...abnResults.values()].filter((r) => r.abn !== null).length;

      // Filter out dissolved/cancelled entities (hard reject)
      const beforeCount = enrichedLeads.length;
      const activeLeads = enrichedLeads.filter((lead) => {
        const abnData = abnResults.get(lead.company.name.toLowerCase());
        // Hard reject: ABN found but entity is not active (dissolved, cancelled)
        if (abnData?.abn && abnData.abn_status && abnData.abn_status !== "Active") {
          return false;
        }
        // Soft pass (null lookup) and active ABNs go through
        return true;
      });
      const rejectedCount = beforeCount - activeLeads.length;

      await updateRun("verifying_abn", {
        niche: template.name,
        step: `${abnVerified}/${beforeCount} ABNs verified` + (rejectedCount > 0 ? `, ${rejectedCount} rejected: dissolved ABN` : ""),
        verified: abnVerified,
        rejected: rejectedCount,
      });

      if (activeLeads.length === 0) {
        results.push({
          niche: template.name, step: "abn_filter", hot: hotCount,
          cold: 0, leads: 0, detail: `All ${beforeCount} leads rejected: dissolved ABNs`,
        });
        continue;
      }

      // ─── Step 4: Deep research (top 5) ──────────────────────────
      await updateRun("researching", { niche: template.name, step: "AI-researching top leads..." });

      let researchedLeads = await deepResearch(
        activeLeads.slice(0, 5),
        template.description || template.name
      );

      if (activeLeads.length > 5) {
        const remaining = activeLeads.slice(5).map((lead) => ({
          ...lead,
          justification: "Signal-matched lead (research pending)",
          contact_summary: "",
          approach_strategies: [],
          email_templates: [],
        }));
        researchedLeads = [...researchedLeads, ...remaining];
      }

      await updateRun("researching", {
        niche: template.name,
        step: `${researchedLeads.length} leads fully processed`,
        researched: Math.min(activeLeads.length, 5),
      });

      // ─── Step 5: Store leads ────────────────────────────────────
      await updateRun("saving", { niche: template.name, step: "Saving leads to database..." });

      const leadsToInsert = researchedLeads.map((lead) => {
        const original = discovered.find(
          (d) => d.name.toLowerCase() === lead.company.name.toLowerCase()
        );
        const abnData = abnResults.get(lead.company.name.toLowerCase());
        return {
          niche_template_id: template.id,
          client_niche_id: null,
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
          abn: abnData?.abn || null,
          abn_status: abnData?.abn ? (abnData.abn_status || "Unknown") : "unverified",
          gst_registered: abnData?.gst_registered || false,
          status: "discovered" as const,
          batch_id: batchId,
        };
      });

      const { error: insertError } = await supabase.from("leads").insert(leadsToInsert);
      if (insertError) console.error("Insert error:", insertError);

      results.push({
        niche: template.name,
        hot: hotCount,
        cold: 0,
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
