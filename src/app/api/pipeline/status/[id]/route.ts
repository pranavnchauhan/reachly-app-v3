import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Simple auth — check for valid session token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: run, error } = await supabase
    .from("pipeline_runs")
    .select("id, status, current_step, progress, result, error, created_at, completed_at")
    .eq("id", id)
    .single();

  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
