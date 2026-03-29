import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const { action, userId } = await request.json();
  const callerRole = auth.role; // Use verified role from session, not request body
  const supabase = createAdminClient();

  switch (action) {
    // ─── PAUSE ─────────────────────────────────────────────────────
    case "pause": {
      // Deactivate niches, update status — data stays, client can't use
      await supabase.from("client_niches").update({ is_active: false }).eq("client_id", userId);
      await supabase.from("profiles").update({ account_status: "paused" }).eq("id", userId);
      return NextResponse.json({ success: true, status: "paused" });
    }

    // ─── REACTIVATE ────────────────────────────────────────────────
    case "reactivate": {
      await supabase.from("client_niches").update({ is_active: true }).eq("client_id", userId);
      await supabase
        .from("profiles")
        .update({ account_status: "active", archived_at: null, archive_expires_at: null })
        .eq("id", userId);
      return NextResponse.json({ success: true, status: "active" });
    }

    // ─── ARCHIVE ───────────────────────────────────────────────────
    case "archive": {
      // Soft-delete: deactivate everything, set 90-day expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await supabase.from("client_niches").update({ is_active: false }).eq("client_id", userId);
      await supabase.from("profiles").update({
        account_status: "archived",
        archived_at: new Date().toISOString(),
        archive_expires_at: expiresAt.toISOString(),
        archived_by: auth.userId || null,
      }).eq("id", userId);

      return NextResponse.json({
        success: true,
        status: "archived",
        expires_at: expiresAt.toISOString(),
      });
    }

    // ─── EXPORT DATA ───────────────────────────────────────────────
    case "export": {
      // Get all client data for CSV export
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const { data: niches } = await supabase
        .from("client_niches")
        .select("id, name, geography, enabled_signals, is_active")
        .eq("client_id", userId);

      const nicheIds = niches?.map((n) => n.id) ?? [];
      const { data: leads } = nicheIds.length
        ? await supabase
            .from("leads")
            .select("*")
            .in("client_niche_id", nicheIds)
        : { data: [] };

      const { data: credits } = await supabase
        .from("credit_packs")
        .select("*")
        .eq("client_id", userId);

      const { data: transactions } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("client_id", userId);

      return NextResponse.json({
        profile,
        niches,
        leads: leads ?? [],
        credits,
        transactions,
        exported_at: new Date().toISOString(),
      });
    }

    // ─── HARD DELETE ───────────────────────────────────────────────
    case "hard_delete": {
      if (callerRole !== "admin") {
        return NextResponse.json({ error: "Only admins can permanently delete accounts" }, { status: 403 });
      }

      // Get user's company
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();
      const companyId = userProfile?.company_id;

      // Check if other users in same company
      let hasCompanyPeers = false;
      if (companyId) {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .neq("id", userId);
        hasCompanyPeers = (count ?? 0) > 0;
      }

      // Get niches linked to this user
      const { data: userNiches } = await supabase
        .from("client_niches")
        .select("id, company_id")
        .eq("client_id", userId);
      const nicheIds = userNiches?.map((n) => n.id) ?? [];

      if (hasCompanyPeers) {
        // Other users in company — only delete user-specific data
        // Detach niches that have company_id (keep them for company peers)
        // Delete niches that are user-only (no company_id)
        const userOnlyNiches = (userNiches || []).filter((n) => !n.company_id).map((n) => n.id);
        if (userOnlyNiches.length > 0) {
          await supabase.from("leads").delete().in("client_niche_id", userOnlyNiches);
          await supabase.from("signal_requests").delete().in("client_niche_id", userOnlyNiches);
          await supabase.from("client_niches").delete().in("id", userOnlyNiches);
        }
        // Detach company-linked niches from user
        await supabase.from("client_niches").update({ client_id: null }).eq("client_id", userId);
      } else {
        // Solo user — delete ALL data including company
        if (nicheIds.length > 0) {
          await supabase.from("leads").delete().in("client_niche_id", nicheIds);
          await supabase.from("signal_requests").delete().in("client_niche_id", nicheIds);
        }
        await supabase.from("client_niches").delete().eq("client_id", userId);
        // Also delete niches linked via company_id
        if (companyId) {
          const { data: companyNiches } = await supabase
            .from("client_niches")
            .select("id")
            .eq("company_id", companyId);
          const companyNicheIds = companyNiches?.map((n) => n.id) ?? [];
          if (companyNicheIds.length > 0) {
            await supabase.from("leads").delete().in("client_niche_id", companyNicheIds);
            await supabase.from("signal_requests").delete().in("client_niche_id", companyNicheIds);
            await supabase.from("client_niches").delete().in("id", companyNicheIds);
          }
        }
      }

      // Delete user-specific records
      await supabase.from("disputes").delete().eq("client_id", userId);
      await supabase.from("credit_transactions").delete().eq("client_id", userId);
      await supabase.from("credit_packs").delete().eq("client_id", userId);
      await supabase.from("profiles").delete().eq("id", userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);

      // Delete company if no more users
      if (companyId && !hasCompanyPeers) {
        await supabase.from("companies").delete().eq("id", companyId);
      }

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      console.log(`[AUDIT] HARD DELETE: user ${userId} | company: ${companyId} (${hasCompanyPeers ? "kept" : "deleted"}) | by ${callerRole} at ${new Date().toISOString()}`);
      return NextResponse.json({ success: true, permanently_deleted: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
