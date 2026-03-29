import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const {
    templateId, name, description, industries, keywords,
    target_titles, employee_min, employee_max, signals,
  } = await request.json();

  if (!templateId) {
    return NextResponse.json({ error: "templateId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (industries !== undefined) update.industries = industries;
  if (keywords !== undefined) update.keywords = keywords;
  if (target_titles !== undefined) update.target_titles = target_titles;
  if (employee_min !== undefined) update.employee_min = employee_min;
  if (employee_max !== undefined) update.employee_max = employee_max;
  if (signals !== undefined) update.signals = signals;

  const { error } = await supabase
    .from("niche_templates")
    .update(update)
    .eq("id", templateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
