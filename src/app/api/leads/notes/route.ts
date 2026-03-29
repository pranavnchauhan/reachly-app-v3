import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth-guard";

// GET: fetch notes for a lead
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

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
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  const { leadId, type, content } = await request.json();
  const clientId = auth.userId;

  if (!leadId || !content) {
    return NextResponse.json({ error: "leadId and content required" }, { status: 400 });
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
