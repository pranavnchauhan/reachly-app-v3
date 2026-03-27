import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST — assign a new niche to a client
export async function POST(request: Request) {
  const { clientId, companyId, templateId, name, geography, enabledSignals } = await request.json();

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("client_niches")
    .insert({
      client_id: clientId || null,
      company_id: companyId || null,
      template_id: templateId,
      name,
      geography: geography || [],
      enabled_signals: enabledSignals || [],
      excluded_companies: [],
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ niche: data });
}

// PATCH — update an existing client niche (name, geography, signals, active status)
export async function PATCH(request: Request) {
  const { nicheId, name, geography, enabledSignals, isActive } = await request.json();

  if (!nicheId) {
    return NextResponse.json({ error: "nicheId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = {};

  if (name !== undefined) update.name = name;
  if (geography !== undefined) update.geography = geography;
  if (enabledSignals !== undefined) update.enabled_signals = enabledSignals;
  if (isActive !== undefined) update.is_active = isActive;

  const { error } = await supabase
    .from("client_niches")
    .update(update)
    .eq("id", nicheId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove a niche from a client
export async function DELETE(request: Request) {
  const { nicheId } = await request.json();

  if (!nicheId) {
    return NextResponse.json({ error: "nicheId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check if niche has leads — if so, soft delete (deactivate + rename)
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_niche_id", nicheId);

  if (count && count > 0) {
    // Soft delete — deactivate and mark as removed
    const { error } = await supabase
      .from("client_niches")
      .update({ is_active: false, name: `[Removed] ${nicheId.slice(0, 8)}` })
      .eq("id", nicheId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // No leads — safe to hard delete
    const { error } = await supabase
      .from("client_niches")
      .delete()
      .eq("id", nicheId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
