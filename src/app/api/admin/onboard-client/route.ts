import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Signal } from "@/types/database";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

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
    // Onboarding credits expire in 4 months (same as Pilot pack)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 4);

    const { data: pack } = await supabase.from("credit_packs").insert({
      client_id: userId,
      total_credits: initialCredits,
      used_credits: 0,
      expires_at: expiresAt.toISOString(),
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

  // 5. Send welcome email with magic link
  if (sendWelcome) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.reachly.com.au";

    // Generate a magic link using admin API — no PKCE needed
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl}/auth` },
    });

    if (linkData?.properties?.action_link) {
      // Send branded welcome email with the magic link
      const { sendEmail } = await import("@/lib/email");
      const firstName = fullName.split(" ")[0];
      await sendEmail({
        to: email,
        toName: fullName,
        subject: "Welcome to Reachly — Your account is ready",
        body: `
          <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Welcome to Reachly, ${firstName}!</h2>
          <p style="color:#555;font-size:15px;line-height:1.6;">
            Your account has been created. Click the button below to sign in and set your password.
          </p>
          <div style="margin:24px 0;">
            <a href="${linkData.properties.action_link}"
               style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
              Sign In to Reachly
            </a>
          </div>
          <p style="color:#999;font-size:13px;">This link expires in 24 hours. If it expires, use "Forgot password" on the login page to get a new one.</p>
        `,
      });
    }
  }

  return NextResponse.json({
    success: true,
    clientId: userId,
    email,
  });
}
