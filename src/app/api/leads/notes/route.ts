import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: fetch notes for a lead
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: notes, error } = await supabase
    .from("lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: notes || [] });
}

// POST: add a note
export async function POST(request: Request) {
  const { leadId, clientId, type, content } = await request.json();

  if (!leadId || !clientId || !content) {
    return NextResponse.json({ error: "leadId, clientId, and content required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: note, error } = await supabase
    .from("lead_notes")
    .insert({
      lead_id: leadId,
      client_id: clientId,
      type: type || "note",
      content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note });
}
