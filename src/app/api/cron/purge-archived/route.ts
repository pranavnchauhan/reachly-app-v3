import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET;

// Weekly cron: purge expired archived accounts + orphaned niches
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let purgedAccounts = 0;
  let purgedNiches = 0;

  // ─── 1. Purge expired archived accounts ─────────────────────────
  const { data: expiredProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, company_id")
    .eq("account_status", "archived")
    .lt("archive_expires_at", now);

  for (const profile of expiredProfiles || []) {
    try {
      const { data: niches } = await supabase.from("client_niches").select("id").eq("client_id", profile.id);
      const nicheIds = niches?.map((n) => n.id) ?? [];

      if (nicheIds.length > 0) {
        await supabase.from("leads").delete().in("client_niche_id", nicheIds);
        await supabase.from("signal_requests").delete().in("client_niche_id", nicheIds);
      }
      await supabase.from("disputes").delete().eq("client_id", profile.id);
      await supabase.from("credit_transactions").delete().eq("client_id", profile.id);
      await supabase.from("credit_packs").delete().eq("client_id", profile.id);
      await supabase.from("client_niches").delete().eq("client_id", profile.id);
      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(profile.id);

      // Delete company if no other users
      if (profile.company_id) {
        const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("company_id", profile.company_id);
        if ((count ?? 0) === 0) {
          await supabase.from("companies").delete().eq("id", profile.company_id);
        }
      }

      console.log(`[PURGE] Account: ${profile.full_name} (${profile.email})`);
      purgedAccounts++;
    } catch (err) {
      console.error(`[PURGE] Failed account ${profile.email}:`, err);
    }
  }

  // ─── 2. Purge expired orphaned niches ───────────────────────────
  const { data: expiredNiches } = await supabase
    .from("client_niches")
    .select("id, name")
    .is("client_id", null)
    .lt("archive_expires_at", now);

  for (const niche of expiredNiches || []) {
    try {
      await supabase.from("leads").delete().eq("client_niche_id", niche.id);
      await supabase.from("signal_requests").delete().eq("client_niche_id", niche.id);
      await supabase.from("client_niches").delete().eq("id", niche.id);

      console.log(`[PURGE] Orphaned niche: ${niche.name}`);
      purgedNiches++;
    } catch (err) {
      console.error(`[PURGE] Failed niche ${niche.name}:`, err);
    }
  }

  return NextResponse.json({
    message: `Purged ${purgedAccounts} accounts + ${purgedNiches} orphaned niches`,
    purged_accounts: purgedAccounts,
    purged_niches: purgedNiches,
  });
}
