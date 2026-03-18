import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Signal } from "@/types/database";

export async function POST(request: Request) {
  const {
    fullName, email, companyId, companyName, phone, position, role,
    templateId, nicheName, geography,
    initialCredits, sendWelcome,
  } = await request.json();

  if (!email || !fullName) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Create auth user (auto-confirmed, temporary password)
  const tempPassword = `Reachly_${crypto.randomUUID().slice(0, 8)}!`;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    phone: phone || undefined,
    user_metadata: {
      full_name: fullName,
      company_name: companyName,
      position: position || null,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // 2. Create profile with company link
  await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    company_name: companyName || null,
    company_id: companyId || null,
    role: role || "client",
    account_status: "active",
  });

  // 3. Assign niche (if template selected) — link to both user and company
  if (templateId) {
    const { data: template } = await supabase
      .from("niche_templates")
      .select("signals")
      .eq("id", templateId)
      .single();

    const allSignalIds = ((template?.signals as Signal[]) || []).map((s) => s.id);

    await supabase.from("client_niches").insert({
      client_id: userId,
      company_id: companyId || null,
      template_id: templateId,
      name: nicheName || "Default",
      geography: geography || [],
      enabled_signals: allSignalIds,
      excluded_companies: [],
      is_active: true,
    });
  }

  // 4. Add initial credits (if any)
  if (initialCredits && initialCredits > 0) {
    const { data: pack } = await supabase.from("credit_packs").insert({
      client_id: userId,
      total_credits: initialCredits,
      used_credits: 0,
    }).select().single();

    if (pack) {
      await supabase.from("credit_transactions").insert({
        client_id: userId,
        credit_pack_id: pack.id,
        type: "purchase",
        amount: initialCredits,
        description: "Initial credits (onboarding)",
      });
    }
  }

  // 5. Send welcome/password reset email
  if (sendWelcome) {
    // Use resetPasswordForEmail which actually sends the email via SMTP
    const { createClient: createServerClient } = await import("@supabase/supabase-js");
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au"}/auth/reset-password`,
    });
  }

  return NextResponse.json({
    success: true,
    clientId: userId,
    email,
  });
}
