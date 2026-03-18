import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list all users
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || "",
    company_name: u.user_metadata?.company_name || "",
    phone: u.phone || "",
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at,
    confirmed: !!u.email_confirmed_at,
  }));

  const { data: profiles } = await supabase.from("profiles").select("id, role, full_name, company_name");
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const enriched = users.map((u) => ({
    ...u,
    role: profileMap.get(u.id)?.role || "client",
    full_name: profileMap.get(u.id)?.full_name || u.full_name,
    company_name: profileMap.get(u.id)?.company_name || u.company_name,
  }));

  return NextResponse.json({ users: enriched });
}

// POST — update user, delete user, or reset password
export async function POST(request: Request) {
  const { action, userId, data, callerRole } = await request.json();
  const supabase = createAdminClient();

  switch (action) {
    case "update": {
      const updateAuth: Record<string, unknown> = {};
      if (data.email) updateAuth.email = data.email;
      if (data.phone) updateAuth.phone = data.phone;
      updateAuth.user_metadata = {
        full_name: data.full_name,
        company_name: data.company_name,
      };

      const { error: authError } = await supabase.auth.admin.updateUserById(userId, updateAuth);
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

      const profileUpdate: Record<string, string> = {};
      if (data.full_name) profileUpdate.full_name = data.full_name;
      if (data.company_name !== undefined) profileUpdate.company_name = data.company_name;
      if (data.email) profileUpdate.email = data.email;
      if (data.role) profileUpdate.role = data.role;

      await supabase.from("profiles").update(profileUpdate).eq("id", userId);
      return NextResponse.json({ success: true });
    }

    case "check_delete": {
      // Pre-flight check before deletion — returns impact assessment
      const { data: userNiches } = await supabase
        .from("client_niches")
        .select("id, template_id")
        .eq("client_id", userId);

      const nicheIds = userNiches?.map((n) => n.id) ?? [];
      const templateIds = userNiches?.map((n) => n.template_id) ?? [];

      // Count leads attached to this user's niches
      let leadCount = 0;
      if (nicheIds.length > 0) {
        const { count } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .in("client_niche_id", nicheIds);
        leadCount = count ?? 0;
      }

      // Check if other users share the same templates (same niche type)
      let sharedUsers: string[] = [];
      if (templateIds.length > 0) {
        const { data: otherNiches } = await supabase
          .from("client_niches")
          .select("client_id, profiles(full_name)")
          .in("template_id", templateIds)
          .neq("client_id", userId);

        sharedUsers = [...new Set(
          (otherNiches || [])
            .filter((n) => n.client_id)
            .map((n) => (n.profiles as unknown as { full_name: string })?.full_name || n.client_id)
        )];
      }

      // Get credit balance
      const { data: creditPacks } = await supabase
        .from("credit_packs")
        .select("total_credits, used_credits")
        .eq("client_id", userId);
      const creditBalance = creditPacks?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;

      const isShared = sharedUsers.length > 0;

      return NextResponse.json({
        nicheCount: nicheIds.length,
        leadCount,
        creditBalance,
        isShared,
        sharedUsers,
        impact: isShared
          ? "safe" // Other users share this niche template — data stays
          : nicheIds.length > 0 || leadCount > 0
            ? "destructive" // Solo user — data will be orphaned/lost
            : "clean", // No data to worry about
      });
    }

    case "delete": {
      // Staff cannot delete — must be admin
      if (callerRole === "staff") {
        return NextResponse.json({
          error: "Staff cannot delete users. Please contact an admin.",
        }, { status: 403 });
      }

      // Get user info for audit log
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", userId)
        .single();

      // Orphan data — nullify client_id references
      await supabase.from("client_niches").update({ client_id: null, is_active: false }).eq("client_id", userId);
      await supabase.from("credit_transactions").update({ client_id: null }).eq("client_id", userId);
      await supabase.from("credit_packs").update({ client_id: null }).eq("client_id", userId);
      await supabase.from("disputes").update({ client_id: null }).eq("client_id", userId);
      await supabase.from("signal_requests").update({ client_id: null }).eq("client_id", userId);

      // Delete profile and auth user
      await supabase.from("profiles").delete().eq("id", userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Log the deletion (insert into a simple audit log)
      // For now, console.log — can be moved to a DB table later
      console.log(`[AUDIT] User deleted: ${targetProfile?.full_name} (${targetProfile?.email}) by ${callerRole} at ${new Date().toISOString()}`);

      return NextResponse.json({ success: true });
    }

    case "reset_password": {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (!userData?.user?.email) return NextResponse.json({ error: "User has no email" }, { status: 400 });

      const { error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: userData.user.email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au"}/auth/login` },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, email: userData.user.email });
    }

    case "confirm_email": {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
