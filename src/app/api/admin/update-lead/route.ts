import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { leadId, status } = await request.json();

  if (!leadId || !status) {
    return NextResponse.json({ error: "leadId and status required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updateData: Record<string, string> = { status };
  if (status === "validated") updateData.validated_at = new Date().toISOString();
  if (status === "published") updateData.published_at = new Date().toISOString();

  const { error } = await supabase.from("leads").update(updateData).eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
