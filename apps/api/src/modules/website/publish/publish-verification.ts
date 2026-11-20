/**
 * Proof that a publish reached visitors.
 *
 * An HTTP 200 from the site's revalidation endpoint, or from a deploy hook,
 * only means the request was accepted. What matters is what the next visitor
 * is served. The site prints the content version it was rendered from into
 * every page (`<meta name="nexuva-content-version" content="N">`); after a
 * publish the API reads the live home page back and compares.
 *
 * Provider-agnostic on purpose: the same check works for an ISR revalidation,
 * a Vercel deploy hook, or any host, which is what lets the Render deploy API
 * lookup go away.
 */

const VERSION_META =
  /<meta[^>]+name=["']nexuva-content-version["'][^>]*content=["'](\d+)["'][^>]*>|<meta[^>]+content=["'](\d+)["'][^>]*name=["']nexuva-content-version["'][^>]*>/i;

/** The content version a rendered page declares, or null when it declares none. */
export function extractContentVersion(html: string): number | null {
  const match = VERSION_META.exec(html);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) ? value : null;
}

export type VerificationOutcome =
  | { status: 'verified'; served: number; attempts: number }
  | { status: 'stale'; served: number | null; attempts: number }
  | { status: 'unreachable'; detail: string; attempts: number };

export interface VerifyOptions {
  attempts: number;
  delayMs: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads the site until it serves `expected` (or a later version), up to
 * `attempts` times. A later version counts: another publish may have landed in
 * between, and that one carries this one's changes too.
 */
export async function verifySiteVersion(
  siteUrl: string,
  expected: number,
  options: VerifyOptions,
): Promise<VerificationOutcome> {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let lastServed: number | null = null;
  let lastError = '';
  let reached = false;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    if (attempt > 1) await sleep(options.delayMs);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const res = await doFetch(siteUrl, {
        method: 'GET',
        headers: { accept: 'text/html', 'user-agent': 'NexuvaPublishVerifier/1.0' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      reached = true;
      const served = extractContentVersion(await res.text());
      lastServed = served;
      if (served !== null && served >= expected) {
        return { status: 'verified', served, attempts: attempt };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }

  return reached
    ? { status: 'stale', served: lastServed, attempts: options.attempts }
    : { status: 'unreachable', detail: lastError || 'no response', attempts: options.attempts };
}

/** The panel's sentence for an outcome. Turkish, like the rest of the panel. */
export function describeOutcome(outcome: VerificationOutcome, expected: number): string {
  switch (outcome.status) {
    case 'verified':
      return outcome.served === expected
        ? `Site sürüm ${expected}'i sunuyor (doğrulandı).`
        : `Site daha yeni bir sürümü (${outcome.served}) sunuyor; bu yayın da içinde (doğrulandı).`;
    case 'stale':
      return outcome.served === null
        ? `Site yanıt verdi ama sürüm bilgisi taşımıyor; yayının sitede göründüğü doğrulanamadı.`
        : `Site hâlâ sürüm ${outcome.served}'i sunuyor; sürüm ${expected} ziyaretçilere ulaşmadı.`;
    case 'unreachable':
      return `Siteye ulaşılamadı (${outcome.detail}); yayının sitede göründüğü doğrulanamadı.`;
  }
}
