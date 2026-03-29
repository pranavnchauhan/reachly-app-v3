import { NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverSignals } from "@/lib/pipeline/discover-signals";
import { enrichContacts } from "@/lib/pipeline/enrich-contacts";
import { deepResearch } from "@/lib/pipeline/deep-research";
import { sendEmail } from "@/lib/email";
import type { Signal } from "@/types/database";
import type { SignalResult } from "@/lib/pipeline/find-signals";

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@reachly.com.au";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

export const maxDuration = 300;

interface TemplateResult {
  templateName: string;
  clientCount: number;
  hot: number;
  enriched: number;
  researched: number;
  totalLeads: number;
  error?: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get active templates that have at least one active client niche
  const { data: templates } = await supabase
    .from("niche_templates")
    .select("*")
    .eq("is_active", true);

  if (!templates?.length) {
    return NextResponse.json({ message: "No active templates", results: [] });
  }

  // Check which templates have active client niches
  const { data: activeNiches } = await supabase
    .from("client_niches")
    .select("template_id, geography")
    .eq("is_active", true)
    .not("client_id", "is", null);

  const activeTemplateIds = new Set((activeNiches || []).map((n) => n.template_id));
  const templatesWithClients = templates.filter((t) => activeTemplateIds.has(t.id));

  if (!templatesWithClients.length) {
    return NextResponse.json({ message: "No templates with active clients", results: [] });
  }

  after(async () => {
    const results: TemplateResult[] = [];
    const batchId = `weekly_${Date.now()}`;

    for (const template of templatesWithClients) {
      // Get geography from first active client niche
      const niche = (activeNiches || []).find((n) => n.template_id === template.id);
      const geography = niche?.geography || [];

      // Count clients on this template
      const clientCount = (activeNiches || []).filter((n) => n.template_id === template.id).length;

      try {
        const allSignals = (template.signals as Signal[]) || [];
        const signalsToSearch = allSignals.slice(0, 5);

        // Cross-run dedup by template (last 90 days)
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("company_name")
          .eq("niche_template_id", template.id)
          .gte("created_at", ninetyDaysAgo);
        const excludeCompanyNames = new Set(
          (existingLeads || []).map((l: { company_name: string }) => l.company_name.toLowerCase().trim())
        );

        // Step 1: Signal discovery — HOT LEADS ONLY
        const discovered = await discoverSignals(signalsToSearch, geography, {
          excludeCompanyNames,
        });
        const hotCount = discovered.length;

        if (discovered.length === 0) {
          results.push({ templateName: template.name, clientCount, hot: 0, enriched: 0, researched: 0, totalLeads: 0, error: "No verified signal-matched companies found" });
          continue;
        }

        // Step 2: Enrich contacts (title-matched)
        const signalResults: SignalResult[] = discovered.map((d) => ({
          company: { name: d.name, domain: d.domain, industry: d.industry || "Unknown", employee_count: null, location: d.location, description: null, apollo_id: "" },
          matched_signals: [{ signal_id: d.signal_id, signal_name: d.signal_name, evidence: d.evidence, confidence: d.confidence, source_url: d.source_url }],
          total_score: d.confidence * 10,
        }));

        const enrichedLeads = await enrichContacts(signalResults, template.target_titles || []);

        if (enrichedLeads.length === 0) {
          results.push({ templateName: template.name, clientCount, hot: hotCount, enriched: 0, researched: 0, totalLeads: 0, error: "No contacts found" });
          continue;
        }

        // Step 3: Deep research (top 5)
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

        // Step 4: Store leads as UNASSIGNED (template-level, no client)
        const leadsToInsert = researchedLeads.map((lead) => {
          const original = discovered.find((d) => d.name.toLowerCase() === lead.company.name.toLowerCase());
          return {
            niche_template_id: template.id,
            client_niche_id: null,
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
          templateName: template.name,
          clientCount,
          hot: hotCount,
          enriched: enrichedLeads.length,
          researched: Math.min(enrichedLeads.length, 5),
          totalLeads: researchedLeads.length,
        });
      } catch (err) {
        results.push({ templateName: template.name, clientCount, hot: 0, enriched: 0, researched: 0, totalLeads: 0, error: String(err) });
      }
    }

    await sendAdminReport(results, batchId);
  });

  return NextResponse.json({ message: `Processing ${templatesWithClients.length} templates in background`, templateCount: templatesWithClients.length });
}

async function sendAdminReport(results: TemplateResult[], batchId: string) {
  const totalLeads = results.reduce((s, r) => s + r.totalLeads, 0);
  const totalHot = results.reduce((s, r) => s + r.hot, 0);
  const errors = results.filter((r) => r.error);

  const rows = results.map((r) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;font-weight:600;">${r.templateName}</td>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">${r.clientCount} clients</td>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;"><span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">${r.hot}</span></td>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;font-size:16px;">${r.totalLeads}</td>
      <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;color:#666;">${r.error || "OK"}</td>
    </tr>
  `).join("");

  const errorSection = errors.length > 0 ? `
    <div style="background:#fef2f2;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#dc2626;font-size:14px;">Errors (${errors.length})</p>
      ${errors.map((e) => `<p style="margin:0;font-size:13px;color:#666;">${e.templateName}: ${e.error}</p>`).join("")}
    </div>
  ` : "";

  await sendEmail({
    to: ADMIN_EMAIL,
    toName: "Reachly Admin",
    subject: `Weekly Pipeline: ${totalLeads} verified leads ready for validation (${totalHot} hot signals)`,
    body: `
      <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Weekly Pipeline Report</h2>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        Leads are now in the validation queue — review, verify contacts, and assign to clients.
      </p>

      <div style="display:flex;gap:16px;margin:20px 0;">
        <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;">${totalLeads}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666;">Leads to Validate</p>
        </div>
        <div style="flex:1;background:#fef3c7;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#d97706;">${totalHot}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666;">Hot Signals Found</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Niche</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Clients</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Signals</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Leads</th>
            <th style="padding:10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${errorSection}

      <div style="margin:24px 0;">
        <a href="${APP_URL}/admin/leads"
           style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
          Review & Assign Leads
        </a>
      </div>

      <p style="color:#999;font-size:13px;">Batch ID: ${batchId}</p>
    `,
  });
}
