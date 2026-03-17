import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { leadIds } = await request.json();

  if (!leadIds?.length) {
    return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("leads")
    .delete()
    .in("id", leadIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: leadIds.length });
}
