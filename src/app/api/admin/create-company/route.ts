import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = createAdminClient();

  if (!body.company_name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  // Check if ABN already exists
  if (body.abn) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("abn", body.abn)
      .single();

    if (existing) {
      return NextResponse.json({
        error: `A client with ABN ${body.abn} already exists: ${existing.company_name}`,
      }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      abn: body.abn || null,
      company_name: body.company_name,
      business_names: body.business_names || [],
      industry: body.industry || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      state: body.state || null,
      postcode: body.postcode || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, company_name: data.company_name });
}
