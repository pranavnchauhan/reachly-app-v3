import { NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverSignals } from "@/lib/pipeline/discover-signals";
import { apolloFallback } from "@/lib/pipeline/apollo-fallback";
import { enrichContacts } from "@/lib/pipeline/enrich-contacts";
import { deepResearch } from "@/lib/pipeline/deep-research";
import { sendEmail } from "@/lib/email";
import type { Signal } from "@/types/database";
import type { SignalResult } from "@/lib/pipeline/find-signals";

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@reachly.com.au";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

export const maxDuration = 300;

interface NicheResult {
  nicheName: string;
  clientName: string;
  companyName: string;
  hot: number;
  cold: number;
  enriched: number;
  researched: number;
  totalLeads: number;
  error?: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all active niches with client/company info
  const { data: niches } = await supabase
    .from("client_niches")
    .select("*, niche_templates(*), profiles(full_name), companies(company_name)")
    .eq("is_active", true)
    .not("client_id", "is", null);

  if (!niches?.length) {
    return NextResponse.json({ message: "No active niches to process", results: [] });
  }

  // Run pipeline in background via after()
  after(async () => {
    const results: NicheResult[] = [];
    const batchId = `weekly_${Date.now()}`;

    for (const niche of niches) {
      const template = niche.niche_templates;
      if (!template) continue;

      const clientName = (niche.profiles as unknown as { full_name: string })?.full_name || "Unknown";
      const companyName = (niche.companies as unknown as { company_name: string })?.company_name || "Unknown";

      try {
        const allSignals = (template.signals as Signal[]) || [];
        const enabledSignals = niche.enabled_signals?.length
          ? allSignals.filter((s: Signal) => niche.enabled_signals.includes(s.id))
          : allSignals;
        const signalsToSearch = enabledSignals.slice(0, 5);

        // Pre-step: Get existing company names for cross-run dedup
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("company_name")
          .eq("client_niche_id", niche.id);
        const excludeCompanyNames = new Set(
          (existingLeads || []).map((l: { company_name: string }) => l.company_name.toLowerCase().trim())
        );

        // Step 1: Signal discovery
        let discovered = await discoverSignals(signalsToSearch, niche.geography || [], {
          employeeMin: template.employee_min || undefined,
          employeeMax: template.employee_max || undefined,
          excludeCompanyNames,
        });
        const hotCount = discovered.length;

        // Step 2: Database fallback
        if (discovered.length < 20) {
          discovered = await apolloFallback(
            discovered,
            template.keywords || [],
            template.industries || [],
            niche.geography || [],
            20,
            {
              employeeMin: template.employee_min || undefined,
              employeeMax: template.employee_max || undefined,
              excludeCompanyNames,
            }
          );
        }

        if (discovered.length === 0) {
          results.push({ nicheName: niche.name, clientName, companyName, hot: 0, cold: 0, enriched: 0, researched: 0, totalLeads: 0, error: "No companies found" });
          continue;
        }

        // Step 3: Enrich contacts
        const signalResults: SignalResult[] = discovered.map((d) => ({
          company: { name: d.name, domain: d.domain, industry: d.industry || "Unknown", employee_count: null, location: d.location, description: null, apollo_id: "" },
          matched_signals: [{ signal_id: d.signal_id, signal_name: d.signal_name, evidence: d.evidence, confidence: d.confidence, source_url: d.source_url }],
          total_score: d.confidence * 10,
        }));

        const enrichedLeads = await enrichContacts(signalResults, template.target_titles || []);

        if (enrichedLeads.length === 0) {
          results.push({ nicheName: niche.name, clientName, companyName, hot: hotCount, cold: discovered.length - hotCount, enriched: 0, researched: 0, totalLeads: 0, error: "No contacts found" });
          continue;
        }

        // Step 4: Deep research (top 5)
        let researchedLeads = await deepResearch(enrichedLeads.slice(0, 5), template.description || template.name);

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

        // Step 5: Store leads
        const leadsToInsert = researchedLeads.map((lead) => {
          const original = discovered.find((d) => d.name.toLowerCase() === lead.company.name.toLowerCase());
          return {
            client_niche_id: niche.id,
            company_name: lead.company.name,
            company_website: lead.company.domain ? `https://${lead.company.domain}` : null,
            company_industry: lead.company.industry || "Unknown",
            company_size: lead.company.employee_count?.toString() || null,
            company_location: lead.company.location,
            signals_matched: lead.matched_signals.map((s) => ({ ...s, source_url: original?.source_url || s.source_url || null })),
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

        await supabase.from("leads").insert(leadsToInsert);

        results.push({
          nicheName: niche.name,
          clientName,
          companyName,
          hot: hotCount,
          cold: discovered.length - hotCount,
          enriched: enrichedLeads.length,
          researched: Math.min(enrichedLeads.length, 5),
          totalLeads: researchedLeads.length,
        });
      } catch (err) {
        results.push({ nicheName: niche.name, clientName, companyName, hot: 0, cold: 0, enriched: 0, researched: 0, totalLeads: 0, error: String(err) });
      }
    }

    // Send admin report email
    await sendAdminReport(results, batchId);
  });

  return NextResponse.json({ message: `Processing ${niches.length} niches in background`, nicheCount: niches.length });
}

async function sendAdminReport(results: NicheResult[], batchId: string) {
  const totalLeads = results.reduce((s, r) => s + r.totalLeads, 0);
  const totalHot = results.reduce((s, r) => s + r.hot, 0);
  const totalCold = results.reduce((s, r) => s + r.cold, 0);
  const errors = results.filter((r) => r.error);

  // Group by company
  const byCompany = new Map<string, NicheResult[]>();
  for (const r of results) {
    const key = r.companyName;
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(r);
  }

  const companyRows = Array.from(byCompany.entries()).map(([company, niches]) => {
    const hot = niches.reduce((s, n) => s + n.hot, 0);
    const cold = niches.reduce((s, n) => s + n.cold, 0);
    const leads = niches.reduce((s, n) => s + n.totalLeads, 0);
    const nicheNames = niches.map((n) => n.nicheName).join(", ");

    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #f0f0f0;font-weight:600;">${company}</td>
        <td style="padding:10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">${nicheNames}</td>
        <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;"><span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">${hot}</span></td>
        <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;"><span style="background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">${cold}</span></td>
        <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;font-size:16px;">${leads}</td>
      </tr>
    `;
  }).join("");

  const errorSection = errors.length > 0 ? `
    <div style="background:#fef2f2;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#dc2626;font-size:14px;">Errors (${errors.length})</p>
      ${errors.map((e) => `<p style="margin:0;font-size:13px;color:#666;">${e.nicheName}: ${e.error}</p>`).join("")}
    </div>
  ` : "";

  await sendEmail({
    to: ADMIN_EMAIL,
    toName: "Reachly Admin",
    subject: `Weekly Pipeline: ${totalLeads} leads discovered (${totalHot} hot, ${totalCold} cold)`,
    body: `
      <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Weekly Pipeline Report</h2>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        The weekly pipeline has completed. Here's what was discovered:
      </p>

      <div style="display:flex;gap:16px;margin:20px 0;">
        <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;">${totalLeads}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666;">Total Leads</p>
        </div>
        <div style="flex:1;background:#fef3c7;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#d97706;">${totalHot}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666;">Hot (News Signal)</p>
        </div>
        <div style="flex:1;background:#dbeafe;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#2563eb;">${totalCold}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666;">Cold (Database)</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Client</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Niche</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Hot</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Cold</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Total</th>
          </tr>
        </thead>
        <tbody>${companyRows}</tbody>
      </table>

      ${errorSection}

      <div style="margin:24px 0;">
        <a href="${APP_URL}/admin/leads"
           style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
          Review & Validate Leads
        </a>
      </div>

      <p style="color:#999;font-size:13px;">Batch ID: ${batchId}</p>
    `,
  });
}
