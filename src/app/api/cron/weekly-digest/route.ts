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

  // Batch query 1: All active clients with their niches
  const { data: clients } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_id, client_niches!client_niches_client_id_fkey(id, is_active)")
    .eq("role", "client")
    .eq("account_status", "active");

  if (!clients?.length) {
    return NextResponse.json({ message: "No active clients", sent: 0 });
  }

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Collect all active niche IDs and client IDs
  const allNicheIds: string[] = [];
  const allClientIds: string[] = [];
  const allCompanyIds: string[] = [];
  const clientNicheMap = new Map<string, string[]>();

  for (const client of clients) {
    allClientIds.push(client.id);
    if (client.company_id) allCompanyIds.push(client.company_id);
    const niches = (client.client_niches as unknown as { id: string; is_active: boolean }[]) || [];
    const activeNicheIds = niches.filter((n) => n.is_active).map((n) => n.id);
    clientNicheMap.set(client.id, activeNicheIds);
    allNicheIds.push(...activeNicheIds);
  }

  // Batch query 2: Published leads count per niche
  const { data: publishedLeads } = allNicheIds.length
    ? await supabase
        .from("leads")
        .select("client_niche_id")
        .eq("status", "published")
        .in("client_niche_id", allNicheIds)
    : { data: [] };

  // Batch query 3: Revealed leads this week per niche
  const { data: revealedLeads } = allNicheIds.length
    ? await supabase
        .from("leads")
        .select("client_niche_id")
        .eq("status", "revealed")
        .in("client_niche_id", allNicheIds)
        .gte("revealed_at", oneWeekAgo.toISOString())
    : { data: [] };

  // Batch query 4: All credit packs for these clients/companies
  const { data: allPacks } = await supabase
    .from("credit_packs")
    .select("client_id, company_id, total_credits, used_credits, expires_at")
    .or(
      [
        ...allClientIds.map((id) => `client_id.eq.${id}`),
        ...allCompanyIds.map((id) => `company_id.eq.${id}`),
      ].join(",")
    );

  // Build count maps
  const publishedCountByNiche = new Map<string, number>();
  for (const l of publishedLeads || []) {
    const key = l.client_niche_id as string;
    publishedCountByNiche.set(key, (publishedCountByNiche.get(key) || 0) + 1);
  }

  const revealedCountByNiche = new Map<string, number>();
  for (const l of revealedLeads || []) {
    const key = l.client_niche_id as string;
    revealedCountByNiche.set(key, (revealedCountByNiche.get(key) || 0) + 1);
  }

  let sent = 0;

  for (const client of clients) {
    const nicheIds = clientNicheMap.get(client.id) || [];
    const newLeads = nicheIds.reduce((sum, id) => sum + (publishedCountByNiche.get(id) || 0), 0);
    const revealedThisWeek = nicheIds.reduce((sum, id) => sum + (revealedCountByNiche.get(id) || 0), 0);

    // Get credit balance from batch data
    const clientPacks = (allPacks || []).filter(
      (p) => p.client_id === client.id || (client.company_id && p.company_id === client.company_id)
    );
    const activePacks = clientPacks.filter((p) => !p.expires_at || new Date(p.expires_at) > now);
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

    if (newLeads === 0 && revealedThisWeek === 0 && creditsRemaining === 0) continue;

    const firstName = client.full_name.split(" ")[0];
    const email = weeklyDigestEmail(firstName, {
      newLeads,
      revealedThisWeek,
      creditsRemaining,
      expiryDate,
      daysToExpiry,
    });

    const ok = await sendEmail({ to: client.email, toName: client.full_name, ...email });
    if (ok) sent++;
  }

  return NextResponse.json({ sent, total: clients.length });
}
