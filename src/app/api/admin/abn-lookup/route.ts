import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const abn = searchParams.get("abn")?.replace(/\s/g, "");
  const name = searchParams.get("name")?.trim();

  const apiKey = process.env.ABR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ABR API key not configured" }, { status: 500 });
  }

  // ─── Search by company name ────────────────────────────────────────
  if (name && name.length >= 2) {
    try {
      const response = await fetch(
        `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(name)}&maxResults=10&callback=cb&guid=${apiKey}`
      );
      const text = await response.text();
      const jsonStr = text.replace(/^cb\(/, "").replace(/\)$/, "");
      const data = JSON.parse(jsonStr);

      if (data.Message && data.Message !== "") {
        return NextResponse.json({ error: data.Message, results: [] }, { status: 404 });
      }

      const results = (data.Names || []).map((entry: Record<string, unknown>) => ({
        abn: entry.Abn || "",
        name: entry.Name || "",
        name_type: entry.NameType || "",
        state: entry.State || "",
        postcode: entry.Postcode || "",
        score: entry.Score || 0,
        is_current: entry.IsCurrent === true || entry.IsCurrent === "Y",
      }));

      return NextResponse.json({ results });
    } catch (err) {
      console.error("ABR name search error:", err);
      return NextResponse.json({ error: "ABR name search failed", results: [] }, { status: 502 });
    }
  }

  // ─── Lookup by ABN ─────────────────────────────────────────────────
  if (!abn || abn.length !== 11) {
    return NextResponse.json({ error: "Provide either 'name' (2+ chars) or 'abn' (11 digits)" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=cb&guid=${apiKey}`
    );
    const text = await response.text();
    const jsonStr = text.replace(/^cb\(/, "").replace(/\)$/, "");
    const data = JSON.parse(jsonStr);

    if (data.Message && data.Message !== "") {
      return NextResponse.json({ error: data.Message }, { status: 404 });
    }

    const businessNames: string[] = [];
    if (Array.isArray(data.BusinessName)) {
      data.BusinessName.forEach((bn: Record<string, string>) => {
        if (bn.Value) businessNames.push(bn.Value);
      });
    }

    return NextResponse.json({
      abn: data.Abn,
      company_name: data.EntityName || "",
      entity_type: data.EntityTypeName || "",
      acn: data.Acn || "",
      business_names: businessNames,
      state: data.AddressState || "",
      postcode: data.AddressPostcode || "",
      is_active: data.AbnStatus === "Active",
      abn_status: data.AbnStatus,
      gst_registered: !!data.Gst,
    });
  } catch (err) {
    console.error("ABR lookup error:", err);
    return NextResponse.json({ error: "ABR lookup failed" }, { status: 502 });
  }
}
