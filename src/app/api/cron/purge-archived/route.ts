import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET;

// Weekly cron: hard-delete accounts archived > 90 days ago
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find profiles where archive_expires_at has passed
  const { data: expired } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("account_status", "archived")
    .lt("archive_expires_at", new Date().toISOString());

  if (!expired?.length) {
    return NextResponse.json({ message: "No expired archives", purged: 0 });
  }

  let purged = 0;

  for (const profile of expired) {
    try {
      // Get niches
      const { data: niches } = await supabase
        .from("client_niches")
        .select("id")
        .eq("client_id", profile.id);
      const nicheIds = niches?.map((n) => n.id) ?? [];

      // Delete all data
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

      console.log(`[PURGE] Auto-deleted expired archive: ${profile.full_name} (${profile.email})`);
      purged++;
    } catch (err) {
      console.error(`[PURGE] Failed to purge ${profile.email}:`, err);
    }
  }

  return NextResponse.json({
    message: `Purged ${purged} expired archives`,
    purged,
    details: expired.map((p) => p.email),
  });
}
