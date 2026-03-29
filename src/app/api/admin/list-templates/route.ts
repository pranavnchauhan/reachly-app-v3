import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("niche_templates")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return NextResponse.json({ templates: data || [] });
}
