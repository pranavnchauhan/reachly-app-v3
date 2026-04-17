import { requireAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const body = await request.json();
  const { leadId, abn } = body as { leadId?: string; abn?: string };

  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const cleanAbn = abn?.replace(/\s/g, "") || null;

  if (cleanAbn && cleanAbn.length !== 11) {
    return NextResponse.json({ error: "ABN must be exactly 11 digits" }, { status: 400 });
  }

  // If ABN provided, verify against ABR
  if (cleanAbn) {
    const apiKey = process.env.ABR_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleanAbn}&callback=cb&guid=${apiKey}`
        );
        const text = await res.text();
        const data = JSON.parse(text.replace(/^cb\(/, "").replace(/\)$/, ""));

        if (data.Message && data.Message !== "") {
          return NextResponse.json({ error: "ABN not found in ABR" }, { status: 404 });
        }

        const { error } = await supabase
          .from("leads")
          .update({
            abn: data.Abn || cleanAbn,
            abn_status: data.AbnStatus || "Unknown",
            gst_registered: !!data.Gst,
          })
          .eq("id", leadId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          abn: data.Abn || cleanAbn,
          abn_status: data.AbnStatus,
          gst_registered: !!data.Gst,
          company_name: data.EntityName || "",
        });
      } catch (err) {
        console.error("ABR verification error:", err);
        return NextResponse.json({ error: "ABR verification failed" }, { status: 502 });
      }
    }

    // No API key — store raw ABN without verification
    const { error } = await supabase
      .from("leads")
      .update({ abn: cleanAbn, abn_status: "Unverified", gst_registered: false })
      .eq("id", leadId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ abn: cleanAbn, abn_status: "Unverified", gst_registered: false });
  }

  // Clear ABN if null passed
  const { error } = await supabase
    .from("leads")
    .update({ abn: null, abn_status: null, gst_registered: false })
    .eq("id", leadId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ abn: null, abn_status: null, gst_registered: false });
}
