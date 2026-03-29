import { requireAdmin } from "@/lib/auth-guard";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Normalize URL
  let baseUrl = url;
  if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
  baseUrl = baseUrl.replace(/\/+$/, "");

  const result: Record<string, string | null> = {
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    postcode: null,
    industry: null,
    description: null,
  };

  // Fetch homepage + contact page in parallel
  const pages = [baseUrl, `${baseUrl}/contact`, `${baseUrl}/contact-us`, `${baseUrl}/about`, `${baseUrl}/about-us`];
  const htmls: string[] = [];

  const fetchPage = async (pageUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ReachlyBot/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const results = await Promise.all(pages.map(fetchPage));
  for (const html of results) {
    if (html) htmls.push(html);
  }

  const allHtml = htmls.join("\n");

  // ─── Extract email ────────────────────────────────────────────────
  const emailPatterns = allHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  // Filter out common non-contact emails
  const contactEmails = emailPatterns.filter((e) =>
    !e.includes("example.com") &&
    !e.includes("sentry.io") &&
    !e.includes("wixpress") &&
    !e.includes("wordpress") &&
    !e.endsWith(".png") &&
    !e.endsWith(".jpg")
  );
  // Prefer info@, contact@, hello@, admin@, enquiries@
  const priorityEmail = contactEmails.find((e) =>
    /^(info|contact|hello|admin|enquir|general|office|support)@/i.test(e)
  );
  result.email = priorityEmail || contactEmails[0] || null;

  // ─── Extract phone ────────────────────────────────────────────────
  // Australian phone patterns
  const phonePatterns = allHtml.match(
    /(?:(?:\+61|0)[\s.-]?(?:\d[\s.-]?){8,9})|(?:1[38]00[\s.-]?\d{3}[\s.-]?\d{3})/g
  ) || [];
  const cleanPhones = phonePatterns
    .map((p) => p.replace(/[\s.-]/g, ""))
    .filter((p) => p.length >= 10 && p.length <= 13);
  const uniquePhones = [...new Set(cleanPhones)];
  result.phone = uniquePhones[0] || null;

  // ─── Extract address (Australian) ─────────────────────────────────
  // Look for patterns like "123 Street Name, Suburb, STATE 1234"
  const addressPattern = /\d{1,5}\s+[A-Za-z\s]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Place|Pl|Crescent|Cr|Boulevard|Blvd|Way|Court|Ct|Parade|Pde|Terrace|Tce|Highway|Hwy)[,\s]+[A-Za-z\s]+[,\s]+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}/gi;
  const addresses = allHtml.match(addressPattern) || [];
  const firstAddr = addresses[0];
  if (firstAddr) {
    const addr = firstAddr.replace(/\s+/g, " ").trim();
    result.address = addr;

    // Extract state and postcode from address
    const stateMatch = addr.match(/(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})/i);
    if (stateMatch) {
      result.state = stateMatch[1].toUpperCase();
      result.postcode = stateMatch[2];
    }

    // Extract city (word before state)
    const cityMatch = addr.match(/,\s*([A-Za-z\s]+?)\s*,?\s*(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)/i);
    if (cityMatch) {
      result.city = cityMatch[1].trim();
    }
  }

  // ─── Extract meta description (for industry/description hints) ────
  const metaDesc = allHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaDesc) {
    result.description = metaDesc[1].trim().slice(0, 300);
  }

  // ─── Extract title for fallback description ───────────────────────
  if (!result.description) {
    const titleMatch = allHtml.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.description = titleMatch[1].trim().slice(0, 300);
    }
  }

  // ─── Try to detect industry from keywords/content ─────────────────
  const metaKeywords = allHtml.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
  if (metaKeywords) {
    result.industry = metaKeywords[1].split(",")[0].trim();
  }

  return NextResponse.json(result);
}
