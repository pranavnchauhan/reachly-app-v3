import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const abn = searchParams.get("abn")?.replace(/\s/g, "");

  if (!abn || abn.length !== 11) {
    return NextResponse.json({ error: "ABN must be 11 digits" }, { status: 400 });
  }

  const apiKey = process.env.ABR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ABR API key not configured" }, { status: 500 });
  }

  try {
    // ABR returns JSONP — need to strip the callback wrapper
    const response = await fetch(
      `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=cb&guid=${apiKey}`
    );
    const text = await response.text();

    // Strip JSONP wrapper: cb({...}) → {...}
    const jsonStr = text.replace(/^cb\(/, "").replace(/\)$/, "");
    const data = JSON.parse(jsonStr);

    if (data.Message && data.Message !== "") {
      return NextResponse.json({ error: data.Message }, { status: 404 });
    }

    // Extract business names
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
