/**
 * ABN lookup for pipeline — calls ABR API directly (no auth needed, it's server-side).
 * Returns the best matching active ABN for a company name, or null.
 */

interface ABNResult {
  abn: string;
  company_name: string;
  abn_status: string;
  is_active: boolean;
  gst_registered: boolean;
}

export async function lookupABN(companyName: string): Promise<ABNResult | null> {
  const apiKey = process.env.ABR_API_KEY;
  if (!apiKey) {
    console.warn("ABR_API_KEY not set — skipping ABN lookup");
    return null;
  }

  if (!companyName || companyName.length < 2) return null;

  try {
    // Step 1: Search by company name
    const searchUrl = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(companyName)}&maxResults=5&callback=cb&guid=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchText = await searchRes.text();
    const searchJson = JSON.parse(searchText.replace(/^cb\(/, "").replace(/\)$/, ""));

    if (searchJson.Message && searchJson.Message !== "") return null;

    const names = searchJson.Names || [];
    if (names.length === 0) return null;

    // Pick the highest-scoring current result
    const best = names
      .filter((n: Record<string, unknown>) => n.IsCurrent === true || n.IsCurrent === "Y")
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(b.Score) || 0) - (Number(a.Score) || 0))[0];

    if (!best?.Abn) return null;

    // Step 2: Get full ABN details
    const abn = String(best.Abn).replace(/\s/g, "");
    const detailUrl = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=cb&guid=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detailText = await detailRes.text();
    const detail = JSON.parse(detailText.replace(/^cb\(/, "").replace(/\)$/, ""));

    if (detail.Message && detail.Message !== "") return null;

    return {
      abn: detail.Abn || abn,
      company_name: detail.EntityName || companyName,
      abn_status: detail.AbnStatus || "Unknown",
      is_active: detail.AbnStatus === "Active",
      gst_registered: !!detail.Gst,
    };
  } catch (err) {
    console.error(`ABN lookup failed for "${companyName}":`, err);
    return null;
  }
}
