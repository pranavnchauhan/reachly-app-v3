import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@reachly.com.au";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

interface ChannelEvidence {
  channel: string;
  issue: string;
  detail: string;
  screenshot_url: string | null;
}

export async function POST(request: Request) {
  const { leadId, clientId, channelEvidence, summary } = await request.json();

  if (!leadId || !clientId || !channelEvidence?.length) {
    return NextResponse.json({ error: "leadId, clientId, and channelEvidence required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get lead details
  const { data: lead } = await supabase
    .from("leads")
    .select("company_name, contact_name, contact_email, contact_phone, contact_linkedin, client_niches!inner(client_id)")
    .eq("id", leadId)
    .single();

  if (!lead || (lead.client_niches as unknown as { client_id: string }).client_id !== clientId) {
    return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
  }

  // Determine which channels were provided
  const channelsProvided: string[] = [];
  if (lead.contact_email) channelsProvided.push("email");
  if (lead.contact_phone) channelsProvided.push("phone");
  if (lead.contact_linkedin) channelsProvided.push("linkedin");

  // Validate: evidence must be provided for ALL provided channels
  const evidenceChannels = (channelEvidence as ChannelEvidence[]).map((e) => e.channel);
  const missingChannels = channelsProvided.filter((c) => !evidenceChannels.includes(c));

  if (missingChannels.length > 0) {
    return NextResponse.json({
      error: `Evidence required for all provided channels. Missing: ${missingChannels.join(", ")}`,
    }, { status: 400 });
  }

  // Build reason from structured evidence
  const reason = (channelEvidence as ChannelEvidence[])
    .map((e) => `${e.channel.toUpperCase()}: ${e.issue} — ${e.detail}`)
    .join("\n");

  // Insert dispute
  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({
      client_id: clientId,
      lead_id: leadId,
      reason: summary || reason,
      evidence: (channelEvidence as ChannelEvidence[])
        .filter((e) => e.screenshot_url)
        .map((e) => e.screenshot_url)
        .join("\n") || null,
      channels_provided: channelsProvided,
      channel_evidence: channelEvidence,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get client profile for the notification
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", clientId)
    .single();

  // Notify admin
  const evidenceRows = (channelEvidence as ChannelEvidence[])
    .map((e) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-weight:600;text-transform:uppercase;font-size:13px;">${e.channel}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;">${e.issue.replace(/_/g, " ")}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;">${e.detail}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;">${e.screenshot_url ? `<a href="${e.screenshot_url}" style="color:#16a34a;">View</a>` : "—"}</td>
      </tr>
    `).join("");

  await sendEmail({
    to: ADMIN_EMAIL,
    toName: "Reachly Admin",
    subject: `Dispute filed: ${lead.company_name} by ${clientProfile?.full_name || "Unknown"}`,
    body: `
      <h2 style="color:#111;font-size:20px;margin:0 0 8px;">New Dispute Filed</h2>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        <strong>${clientProfile?.full_name}</strong> (${clientProfile?.email}) has disputed a lead.
      </p>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:16px 0;">
        <p style="margin:0 0 4px;font-weight:700;font-size:16px;color:#111;">${lead.company_name}</p>
        <p style="margin:0;font-size:14px;color:#555;">${lead.contact_name}</p>
      </div>

      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding:8px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Channel</th>
            <th style="padding:8px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Issue</th>
            <th style="padding:8px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Detail</th>
            <th style="padding:8px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#888;">Screenshot</th>
          </tr>
        </thead>
        <tbody>${evidenceRows}</tbody>
      </table>

      ${summary ? `<p style="color:#555;font-size:14px;margin:16px 0;"><strong>Client summary:</strong> ${summary}</p>` : ""}

      <div style="margin:24px 0;">
        <a href="${APP_URL}/admin/leads"
           style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
          Review in Admin Panel
        </a>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ dispute });
}
