import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("niche_templates")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return NextResponse.json({ templates: data || [] });
}
