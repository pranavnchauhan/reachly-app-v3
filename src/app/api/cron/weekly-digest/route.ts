import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, weeklyDigestEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all active client profiles
  const { data: clients } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_id")
    .eq("role", "client")
    .eq("account_status", "active");

  if (!clients?.length) {
    return NextResponse.json({ message: "No active clients", sent: 0 });
  }

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let sent = 0;

  for (const client of clients) {
    // Get client's niches
    const { data: niches } = await supabase
      .from("client_niches")
      .select("id")
      .eq("client_id", client.id)
      .eq("is_active", true);

    const nicheIds = niches?.map((n) => n.id) ?? [];

    // Count new leads (published)
    const { count: newLeads } = nicheIds.length
      ? await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "published")
          .in("client_niche_id", nicheIds)
      : { count: 0 };

    // Count leads revealed this week
    const { count: revealedThisWeek } = nicheIds.length
      ? await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "revealed")
          .in("client_niche_id", nicheIds)
          .gte("revealed_at", oneWeekAgo.toISOString())
      : { count: 0 };

    // Get credit balance (non-expired)
    const { data: userPacks } = await supabase
      .from("credit_packs")
      .select("total_credits, used_credits, expires_at")
      .eq("client_id", client.id);

    let companyPacks: typeof userPacks = [];
    if (client.company_id) {
      const { data: cp } = await supabase
        .from("credit_packs")
        .select("total_credits, used_credits, expires_at")
        .eq("company_id", client.company_id);
      companyPacks = cp || [];
    }

    const allPacks = [...(userPacks || []), ...(companyPacks || [])];
    const activePacks = allPacks.filter((p) => !p.expires_at || new Date(p.expires_at) > now);
    const creditsRemaining = activePacks.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);

    // Find earliest expiry
    const packsWithExpiry = activePacks.filter((p) => p.total_credits - p.used_credits > 0 && p.expires_at);
    let expiryDate: string | null = null;
    let daysToExpiry: number | null = null;

    if (packsWithExpiry.length > 0) {
      const earliest = packsWithExpiry.reduce((e, p) =>
        !e || new Date(p.expires_at!) < new Date(e) ? p.expires_at! : e, "" as string);
      expiryDate = new Date(earliest).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
      daysToExpiry = Math.ceil((new Date(earliest).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Skip if nothing to report
    if ((newLeads ?? 0) === 0 && (revealedThisWeek ?? 0) === 0 && creditsRemaining === 0) continue;

    const firstName = client.full_name.split(" ")[0];
    const email = weeklyDigestEmail(firstName, {
      newLeads: newLeads ?? 0,
      revealedThisWeek: revealedThisWeek ?? 0,
      creditsRemaining,
      expiryDate,
      daysToExpiry,
    });

    const ok = await sendEmail({ to: client.email, toName: client.full_name, ...email });
    if (ok) sent++;
  }

  console.log(`[WEEKLY DIGEST] Sent ${sent}/${clients.length} digests`);
  return NextResponse.json({ sent, total: clients.length });
}
