// Safe fetch wrapper — never throws, always returns structured result, enforces timeout

const DEFAULT_TIMEOUT_MS = 15_000; // 15 seconds

export async function safeFetchJson(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    console.error(`${isTimeout ? "Timeout" : "Fetch failed"} for ${url}:`, isTimeout ? `${timeoutMs}ms` : err);
    return { ok: false, status: 0, data: { error: isTimeout ? `Request timed out after ${timeoutMs}ms` : String(err) } };
  }
}
