import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("companies")
    .select("id, company_name, abn")
    .order("company_name");

  return NextResponse.json({ companies: data || [] });
}
