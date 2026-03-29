import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const { companyId } = await request.json();
  const supabase = createAdminClient();

  // Detach users from company (don't delete users)
  await supabase.from("profiles").update({ company_id: null }).eq("company_id", companyId);

  // Orphan niches (don't delete — can be reassigned)
  await supabase.from("client_niches").update({ company_id: null, is_active: false }).eq("company_id", companyId);

  // Delete company
  const { error } = await supabase.from("companies").delete().eq("id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`[AUDIT] Company deleted: ${companyId} at ${new Date().toISOString()}`);
  return NextResponse.json({ success: true });
}
