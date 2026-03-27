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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, full_name, company_name, company_id, account_status, archived_at, archive_expires_at");
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const enriched = users.map((u) => ({
    ...u,
    role: profileMap.get(u.id)?.role || "client",
    full_name: profileMap.get(u.id)?.full_name || u.full_name,
    company_name: profileMap.get(u.id)?.company_name || u.company_name,
    company_id: profileMap.get(u.id)?.company_id || null,
    account_status: profileMap.get(u.id)?.account_status || "active",
    archived_at: profileMap.get(u.id)?.archived_at || null,
    archive_expires_at: profileMap.get(u.id)?.archive_expires_at || null,
  }));

  return NextResponse.json({ users: enriched });
}

// POST — update, check_delete, delete, reset_password, confirm_email
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
      // Get user's profile to find their company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

      const companyId = profile?.company_id;

      // Get niches linked to this user directly
      const { data: userNiches } = await supabase
        .from("client_niches")
        .select("id, template_id, company_id")
        .eq("client_id", userId);

      const nicheIds = userNiches?.map((n) => n.id) ?? [];

      // Count leads
      let leadCount = 0;
      if (nicheIds.length > 0) {
        const { count } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .in("client_niche_id", nicheIds);
        leadCount = count ?? 0;
      }

      // Check other users in same company
      let companyUsers: string[] = [];
      if (companyId) {
        const { data: sameCompany } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("company_id", companyId)
          .neq("id", userId);

        companyUsers = (sameCompany || []).map((u) => u.full_name);
      }

      // Check other users sharing same niche templates
      const templateIds = userNiches?.map((n) => n.template_id) ?? [];
      let sharedNicheUsers: string[] = [];
      if (templateIds.length > 0) {
        const { data: otherNiches } = await supabase
          .from("client_niches")
          .select("client_id, profiles(full_name)")
          .in("template_id", templateIds)
          .neq("client_id", userId);

        sharedNicheUsers = [...new Set(
          (otherNiches || [])
            .filter((n) => n.client_id)
            .map((n) => (n.profiles as unknown as { full_name: string })?.full_name || "Unknown")
        )];
      }

      // Credit balance
      const { data: creditPacks } = await supabase
        .from("credit_packs")
        .select("total_credits, used_credits")
        .eq("client_id", userId);
      const creditBalance = creditPacks?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;

      const hasCompanyPeers = companyUsers.length > 0;
      const hasSharedNiches = sharedNicheUsers.length > 0;
      const hasData = nicheIds.length > 0 || leadCount > 0;

      let impact: string;
      if (!hasData) {
        impact = "clean";
      } else if (hasCompanyPeers) {
        impact = "safe"; // Other users in same company will retain access
      } else if (hasSharedNiches) {
        impact = "safe";
      } else {
        impact = "destructive";
      }

      return NextResponse.json({
        nicheCount: nicheIds.length,
        leadCount,
        creditBalance,
        companyUsers,
        sharedNicheUsers,
        hasCompanyPeers,
        impact,
      });
    }

    case "delete": {
      if (callerRole === "staff") {
        return NextResponse.json({
          error: "Staff cannot delete users. Please contact an admin.",
        }, { status: 403 });
      }

      // Get user's profile
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("full_name, email, role, company_id")
        .eq("id", userId)
        .single();

      const companyId = targetProfile?.company_id;

      // Check if other users exist in the same company
      let hasCompanyPeers = false;
      if (companyId) {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .neq("id", userId);
        hasCompanyPeers = (count ?? 0) > 0;
      }

      if (hasCompanyPeers) {
        // Other users in same company — just detach user, leave niches + data intact
        // Niches with company_id will still be accessible to other company users
        // Only orphan niches that are directly linked to this user without company_id
        await supabase
          .from("client_niches")
          .update({ client_id: null, is_active: false })
          .eq("client_id", userId)
          .is("company_id", null); // Only orphan niches without company link

        // For niches with company_id, just remove the user link
        await supabase
          .from("client_niches")
          .update({ client_id: null })
          .eq("client_id", userId)
          .not("company_id", "is", null); // Keep active, just detach user
      } else {
        // Solo user — orphan everything
        await supabase
          .from("client_niches")
          .update({ client_id: null, is_active: false })
          .eq("client_id", userId);
      }

      // Orphan credit and dispute records
      await supabase.from("credit_transactions").update({ client_id: null }).eq("client_id", userId);
      await supabase.from("credit_packs").update({ client_id: null }).eq("client_id", userId);
      await supabase.from("disputes").update({ client_id: null }).eq("client_id", userId);
      await supabase.from("signal_requests").delete().eq("client_id", userId);

      // Delete profile and auth user (company stays)
      await supabase.from("profiles").delete().eq("id", userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      console.log(`[AUDIT] User deleted: ${targetProfile?.full_name} (${targetProfile?.email}) | company_id: ${companyId} | peers: ${hasCompanyPeers} | by ${callerRole} at ${new Date().toISOString()}`);

      return NextResponse.json({ success: true });
    }

    case "reset_password": {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (!userData?.user?.email) return NextResponse.json({ error: "User has no email" }, { status: 400 });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
        options: { redirectTo: `${appUrl}/auth` },
      });

      if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

      if (linkData?.properties?.action_link) {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail({
          to: userData.user.email,
          subject: "Sign in to Reachly",
          body: `
            <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Sign in to Reachly</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;">
              Click the button below to sign in. Once signed in, you can set a new password from settings.
            </p>
            <div style="margin:24px 0;">
              <a href="${linkData.properties.action_link}"
                 style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
                Sign In
              </a>
            </div>
            <p style="color:#999;font-size:13px;">This link expires in 24 hours.</p>
          `,
        });
      }

      return NextResponse.json({ success: true, email: userData.user.email });
    }

    case "confirm_email": {
      const { error } = await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
