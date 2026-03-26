const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  body: string; // HTML content that goes inside the branded wrapper
}

function brandedWrapper(body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #f9fafb;">
      <div style="background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="padding: 28px 28px 20px; border-bottom: 1px solid #f0f0f0;">
          <img src="${APP_URL}/logo-reachly.png" alt="Reachly" width="130" />
        </div>
        <div style="padding: 28px;">
          ${body}
        </div>
      </div>
      <div style="text-align: center; padding: 20px;">
        <p style="color: #bbb; font-size: 12px; margin: 0;">
          Reachly AI · Triple-Verified Lead Intelligence<br />
          <a href="${APP_URL}" style="color: #bbb;">app.reachly.com.au</a>
        </p>
      </div>
    </div>
  `;
}

function ctaButton(text: string, href: string): string {
  return `
    <div style="margin: 24px 0;">
      <a href="${href}"
         style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${text}
      </a>
    </div>
  `;
}

export async function sendEmail({ to, toName, subject, body }: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("[EMAIL] SENDGRID_API_KEY not set, skipping email to", to);
    return false;
  }

  const html = brandedWrapper(body);

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to, name: toName || to }] }],
        from: { email: "noreply@reachly.com.au", name: "Reachly AI" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!res.ok) {
      console.error("[EMAIL] SendGrid error:", res.status, await res.text().catch(() => ""));
    }
    return res.ok;
  } catch (err) {
    console.error("[EMAIL] Failed to send to", to, err);
    return false;
  }
}

// ─── Pre-built email templates ──────────────────────────────────────

export function newLeadsEmail(firstName: string, leadCount: number): { subject: string; body: string } {
  return {
    subject: `${leadCount} new lead${leadCount > 1 ? "s" : ""} ready to reveal`,
    body: `
      <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">New leads are waiting</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Hi ${firstName},
      </p>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        <strong>${leadCount} new verified lead${leadCount > 1 ? "s" : ""}</strong> ${leadCount > 1 ? "have" : "has"} been
        added to your dashboard. Each one has cleared our 3-stage Verification Waterfall and is ready to reveal.
      </p>
      ${ctaButton("View Your Leads", `${APP_URL}/dashboard/leads`)}
      <p style="color: #999; font-size: 13px;">Each reveal costs 1 credit.</p>
    `,
  };
}

export function leadRevealedEmail(
  firstName: string,
  companyName: string,
  contactName: string,
  contactTitle: string,
  contactEmail: string | null,
  contactPhone: string | null,
  contactLinkedin: string | null,
): { subject: string; body: string } {
  const contactRows = [
    contactEmail ? `<tr><td style="color:#888;padding:4px 12px 4px 0;">Email</td><td><a href="mailto:${contactEmail}" style="color:#16a34a;">${contactEmail}</a></td></tr>` : "",
    contactPhone ? `<tr><td style="color:#888;padding:4px 12px 4px 0;">Phone</td><td><a href="tel:${contactPhone}" style="color:#16a34a;">${contactPhone}</a></td></tr>` : "",
    contactLinkedin ? `<tr><td style="color:#888;padding:4px 12px 4px 0;">LinkedIn</td><td><a href="${contactLinkedin}" style="color:#16a34a;">View Profile</a></td></tr>` : "",
  ].filter(Boolean).join("");

  return {
    subject: `Lead revealed: ${contactName} at ${companyName}`,
    body: `
      <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">Lead revealed</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Hi ${firstName}, here are the contact details for your newly revealed lead:
      </p>
      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 16px 0;">
        <p style="margin: 0 0 4px; font-weight: 700; font-size: 16px; color: #111;">${companyName}</p>
        <p style="margin: 0 0 12px; font-size: 14px; color: #555;">${contactName} — ${contactTitle}</p>
        <table style="font-size: 14px;">${contactRows}</table>
      </div>
      ${ctaButton("View Full Lead Details", `${APP_URL}/dashboard/leads`)}
      <p style="color: #999; font-size: 13px;">You'll find approach strategies and email templates inside the lead detail.</p>
    `,
  };
}

export function creditLowEmail(firstName: string, remaining: number): { subject: string; body: string } {
  return {
    subject: `Only ${remaining} credit${remaining !== 1 ? "s" : ""} remaining`,
    body: `
      <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">Running low on credits</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Hi ${firstName},
      </p>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        You have <strong>${remaining} credit${remaining !== 1 ? "s" : ""}</strong> remaining.
        Top up now to keep revealing verified leads without interruption.
      </p>
      ${ctaButton("Buy More Credits", `${APP_URL}/dashboard/buy-credits`)}
      <p style="color: #999; font-size: 13px;">If you top up before your current credits expire, your remaining balance rolls over automatically.</p>
    `,
  };
}

export function disputeResolvedEmail(
  firstName: string,
  companyName: string,
  status: "approved" | "rejected",
  adminNotes: string | null,
): { subject: string; body: string } {
  const isApproved = status === "approved";
  return {
    subject: `Dispute ${isApproved ? "approved" : "reviewed"}: ${companyName}`,
    body: `
      <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">Dispute ${isApproved ? "approved" : "reviewed"}</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Hi ${firstName},
      </p>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Your dispute for <strong>${companyName}</strong> has been
        <strong style="color: ${isApproved ? "#16a34a" : "#ef4444"};">${isApproved ? "approved" : "rejected"}</strong>.
        ${isApproved ? "1 credit has been refunded to your account." : ""}
      </p>
      ${adminNotes ? `
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px; color: #555;"><strong>Admin note:</strong> ${adminNotes}</p>
        </div>
      ` : ""}
      ${ctaButton("View Your Credits", `${APP_URL}/dashboard/credits`)}
    `,
  };
}

export function weeklyDigestEmail(
  firstName: string,
  stats: {
    newLeads: number;
    revealedThisWeek: number;
    creditsRemaining: number;
    expiryDate: string | null;
    daysToExpiry: number | null;
  },
): { subject: string; body: string } {
  const expiryRow = stats.expiryDate && stats.daysToExpiry !== null
    ? `<tr><td style="color:#888;padding:8px 16px 8px 0;">Credits expire</td><td style="font-weight:600;${stats.daysToExpiry <= 14 ? "color:#ef4444;" : ""}">${stats.expiryDate}${stats.daysToExpiry <= 14 ? ` (${stats.daysToExpiry} days)` : ""}</td></tr>`
    : "";

  return {
    subject: `Your weekly Reachly summary`,
    body: `
      <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">Weekly Summary</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Hi ${firstName}, here's your lead generation update:
      </p>
      <table style="font-size: 15px; width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="color:#888;padding:8px 16px 8px 0;">New leads available</td>
          <td style="font-weight:600;">${stats.newLeads}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="color:#888;padding:8px 16px 8px 0;">Leads revealed this week</td>
          <td style="font-weight:600;">${stats.revealedThisWeek}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="color:#888;padding:8px 16px 8px 0;">Credits remaining</td>
          <td style="font-weight:600;">${stats.creditsRemaining}</td>
        </tr>
        ${expiryRow}
      </table>
      ${stats.newLeads > 0
        ? ctaButton("View Your Leads", `${APP_URL}/dashboard/leads`)
        : stats.creditsRemaining === 0
          ? ctaButton("Buy Credits", `${APP_URL}/dashboard/buy-credits`)
          : ctaButton("Go to Dashboard", `${APP_URL}/dashboard`)}
    `,
  };
}
