import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find credit packs expiring within 14 days that still have remaining credits
  const now = new Date();
  const fourteenDaysFromNow = new Date(now);
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

  const { data: expiringPacks, error } = await supabase
    .from("credit_packs")
    .select("id, client_id, company_id, total_credits, used_credits, expires_at, profiles!credit_packs_client_id_fkey(email, full_name)")
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", fourteenDaysFromNow.toISOString());

  if (error) {
    console.error("Expiry reminder query failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter to packs with remaining credits and group by user
  const userReminders = new Map<string, {
    email: string;
    name: string;
    totalExpiring: number;
    earliestExpiry: string;
  }>();

  for (const pack of expiringPacks || []) {
    const remaining = pack.total_credits - pack.used_credits;
    if (remaining <= 0) continue;

    const profile = pack.profiles as unknown as { email: string; full_name: string } | null;
    if (!profile?.email) continue;

    const existing = userReminders.get(profile.email);
    if (existing) {
      existing.totalExpiring += remaining;
      if (new Date(pack.expires_at!) < new Date(existing.earliestExpiry)) {
        existing.earliestExpiry = pack.expires_at!;
      }
    } else {
      userReminders.set(profile.email, {
        email: profile.email,
        name: profile.full_name,
        totalExpiring: remaining,
        earliestExpiry: pack.expires_at!,
      });
    }
  }

  if (userReminders.size === 0) {
    return NextResponse.json({ message: "No expiring credits to notify about", sent: 0 });
  }

  // Send reminder emails
  let sent = 0;
  const errors: string[] = [];

  for (const [, user] of userReminders) {
    const daysLeft = Math.ceil(
      (new Date(user.earliestExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const expiryDate = new Date(user.earliestExpiry).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const emailSent = await sendReminderEmail({
      to: user.email,
      name: user.name,
      credits: user.totalExpiring,
      daysLeft,
      expiryDate,
    });

    if (emailSent) {
      sent++;
    } else {
      errors.push(user.email);
    }
  }

  console.log(`[EXPIRY CRON] Sent ${sent} reminders, ${errors.length} failures`);
  return NextResponse.json({ sent, total: userReminders.size, errors });
}

async function sendReminderEmail({
  to,
  name,
  credits,
  daysLeft,
  expiryDate,
}: {
  to: string;
  name: string;
  credits: number;
  daysLeft: number;
  expiryDate: string;
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("[EXPIRY CRON] SENDGRID_API_KEY not set, skipping email to", to);
    return false;
  }

  const firstName = name.split(" ")[0];
  const subject = `${credits} Reachly credits expiring in ${daysLeft} days`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <img src="https://app.reachly.com.au/logo-reachly.png" alt="Reachly" width="140" style="margin-bottom: 32px;" />

      <h2 style="color: #111; font-size: 20px; margin-bottom: 8px;">
        Your credits are expiring soon
      </h2>

      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Hi ${firstName},
      </p>

      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        You have <strong>${credits} verified lead credits</strong> expiring on
        <strong>${expiryDate}</strong> (${daysLeft} days from now).
      </p>

      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        <strong>Good news:</strong> Purchase any new pack before they expire and your
        remaining ${credits} credits will automatically roll over into your new pack
        with a fresh validity period.
      </p>

      <div style="margin: 32px 0;">
        <a href="${APP_URL}/dashboard/buy-credits"
           style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Top Up &amp; Roll Over
        </a>
      </div>

      <p style="color: #999; font-size: 13px; line-height: 1.5;">
        If you don't top up before ${expiryDate}, your remaining credits will expire.
        You can always purchase a new pack later, but expired credits cannot be recovered.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />

      <p style="color: #bbb; font-size: 12px;">
        Reachly AI · Triple-Verified Lead Intelligence<br />
        <a href="${APP_URL}" style="color: #bbb;">app.reachly.com.au</a>
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to, name }] }],
        from: { email: "noreply@reachly.com.au", name: "Reachly AI" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    return res.ok;
  } catch (err) {
    console.error(`[EXPIRY CRON] Failed to send to ${to}:`, err);
    return false;
  }
}
