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

  // Get profiles for role info
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
  const { action, userId, data } = await request.json();
  const supabase = createAdminClient();

  switch (action) {
    case "update": {
      // Update auth user
      const updateAuth: Record<string, unknown> = {};
      if (data.email) updateAuth.email = data.email;
      if (data.phone) updateAuth.phone = data.phone;
      updateAuth.user_metadata = {
        full_name: data.full_name,
        company_name: data.company_name,
      };

      const { error: authError } = await supabase.auth.admin.updateUserById(userId, updateAuth);
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

      // Update profile
      const profileUpdate: Record<string, string> = {};
      if (data.full_name) profileUpdate.full_name = data.full_name;
      if (data.company_name !== undefined) profileUpdate.company_name = data.company_name;
      if (data.email) profileUpdate.email = data.email;
      if (data.role) profileUpdate.role = data.role;

      await supabase.from("profiles").update(profileUpdate).eq("id", userId);
      return NextResponse.json({ success: true });
    }

    case "delete": {
      await supabase.from("profiles").delete().eq("id", userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case "reset_password": {
      // Generate a magic link for password reset
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
