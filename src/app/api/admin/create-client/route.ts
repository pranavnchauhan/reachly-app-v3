import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const { email, password, fullName, companyName } = await request.json();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, company_name: companyName },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // The trigger should create the profile, but let's ensure it exists
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: authData.user.id,
      email,
      full_name: fullName,
      company_name: companyName || null,
      role: "client",
    });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ clientId: authData.user.id });
}
