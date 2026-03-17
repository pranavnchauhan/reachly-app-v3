// Safe fetch wrapper that never throws on JSON parse errors

export async function safeFetchJson(
  url: string,
  options: RequestInit
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, options);
    const text = await response.text();

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`Non-JSON response from ${url}: ${text.slice(0, 150)}`);
      return { ok: false, status: response.status, data: { error: text.slice(0, 200) } };
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    console.error(`Fetch failed for ${url}:`, err);
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}
