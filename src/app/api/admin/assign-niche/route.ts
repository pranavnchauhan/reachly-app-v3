import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { clientId, templateId, name, geography, enabledSignals } = await request.json();

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("client_niches")
    .insert({
      client_id: clientId,
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
