import { NextResponse } from "next/server";
import { safeFetchJson } from "@/lib/pipeline/safe-fetch";

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

  // ABR API returns XML by default, use JSON endpoint
  const { ok, data } = await safeFetchJson(
    `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=&guid=${apiKey}`,
    { method: "GET" }
  );

  if (!ok) {
    return NextResponse.json({ error: "ABR lookup failed" }, { status: 502 });
  }

  // ABR returns JSONP-like response, parse it
  // The response might be wrapped in a callback or be plain JSON
  const abnData = data as Record<string, unknown>;

  if (abnData.Message) {
    return NextResponse.json({ error: abnData.Message as string }, { status: 404 });
  }

  const entityName = abnData.EntityName as string || "";
  const entityType = abnData.EntityTypeName as string || "";
  const state = abnData.AddressState as string || "";
  const postcode = abnData.AddressPostcode as string || "";
  const isActive = abnData.AbnStatus as string === "Active";

  // Get business names
  const businessNames: string[] = [];
  const bnList = abnData.BusinessName as Record<string, string>[] | undefined;
  if (Array.isArray(bnList)) {
    bnList.forEach((bn) => {
      if (bn.Value) businessNames.push(bn.Value);
    });
  }

  return NextResponse.json({
    abn,
    company_name: entityName,
    entity_type: entityType,
    business_names: businessNames,
    state,
    postcode,
    is_active: isActive,
  });
}
