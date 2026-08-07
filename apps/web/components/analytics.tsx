'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');

/**
 * First-party traffic measurement.
 *
 * No cookie, no local storage, no third-party script. The visitor is never
 * given an identifier — the server counts them with a hash it throws away
 * daily — so this needs no consent banner and sends nothing to anybody but
 * Nexuva's own API.
 *
 * Everything here fails silently by design. A visitor must never see a
 * measurement problem, and a tracker that can break a page is a tracker that
 * should not be on it.
 */
/** Where sessionStorage keeps the campaign that started this visit. */
const ATTRIBUTION_KEY = 'nexuva.attribution';

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
  referrer?: string;
}

/**
 * The campaign that brought this visitor, remembered for the visit.
 *
 * Read from the address on the first page and kept in sessionStorage, because
 * the form is usually several clicks after the landing page and the parameters
 * are long gone by then. Session-scoped on purpose: it dies with the tab, which
 * is the whole point — this identifies a visit, never a person.
 *
 * The first campaign of the visit wins. Someone who arrives from an ad and then
 * comes back through a bookmark was still won by the ad.
 */
export function readAttribution(): Attribution {
  if (typeof window === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored) as Attribution;

    const params = new URLSearchParams(window.location.search);
    const attribution: Attribution = {};
    const get = (name: string) => params.get(name)?.slice(0, 160) || undefined;

    const source = get('utm_source');
    const medium = get('utm_medium');
    const campaign = get('utm_campaign');
    const content = get('utm_content');
    const term = get('utm_term');

    if (source) attribution.utmSource = source;
    if (medium) attribution.utmMedium = medium;
    if (campaign) attribution.utmCampaign = campaign;
    if (content) attribution.utmContent = content;
    if (term) attribution.utmTerm = term;

    attribution.landingPath = window.location.pathname;
    if (document.referrer && !document.referrer.includes(location.host)) {
      attribution.referrer = document.referrer.slice(0, 300);
    }

    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    // Private browsing can refuse storage. Measurement is not worth an error.
    return {};
  }
}

export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!API_BASE || !pathname) return;

    const startedAt = Date.now();
    let deepest = 0;

    const send = (path: string, body: Record<string, unknown>) => {
      const payload = JSON.stringify(body);
      // sendBeacon survives the page being closed, which is exactly when the
      // duration is worth sending. fetch would be cancelled mid-flight.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_BASE}${path}`, new Blob([payload], { type: 'application/json' }));
        return;
      }
      void fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // A visitor never hears about this.
      });
    };

    const attribution = readAttribution();

    send('/analytics/collect', {
      path: pathname,
      ...(document.referrer && !document.referrer.includes(location.host)
        ? { referrer: document.referrer }
        : {}),
      // Sent on every page of the visit, not just the landing page: a report
      // that only counts the first page understates a campaign by however many
      // pages people read.
      ...attribution,
    });

    const onScroll = () => {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = Math.round(((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100);
      if (percent > deepest) deepest = Math.min(percent, 100);
    };

    // Sent when the tab is hidden rather than on unload: mobile browsers
    // frequently kill a page without ever firing unload, and this is the last
    // moment the browser guarantees.
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      send('/analytics/collect', {
        path: pathname,
        durationSeconds: Math.min(Math.round((Date.now() - startedAt) / 1000), 86_400),
        scrollDepth: deepest,
      });
    };

    // Clicks on anything a visitor would call a call to action.
    //
    // The marked element is looked for first and independently of the link:
    // resolving to the nearest a/button and then reading its attribute meant a
    // marker placed on a wrapper — or on a span inside the link — was never
    // seen, which is exactly what happened to the header button.
    const onClick = (event: MouseEvent) => {
      const from = event.target as HTMLElement | null;
      if (!from) return;

      const marked = from.closest('[data-cta]');
      const link = from.closest('a,button');
      const element = marked ?? link;
      if (!element) return;

      // Unmarked elements still count when they carry the primary button
      // styling, so a new CTA reports itself before anybody remembers to
      // label it.
      const isCta =
        marked !== null ||
        (link?.className ?? '').includes('btn-primary') ||
        (link?.className ?? '').includes('brand-gradient-bg');
      if (!isCta) return;

      const label =
        marked?.getAttribute('data-cta') ||
        (element.textContent ?? '').trim().slice(0, 120);
      if (!label) return;

      send('/analytics/event', { name: 'cta_click', path: pathname, label });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('click', onClick, true);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('click', onClick, true);
    };
  }, [pathname]);

  return null;
}

/** Records a completed contact form. Called by the form itself on success. */
export function trackFormSubmit(path: string): void {
  if (!API_BASE) return;
  void fetch(`${API_BASE}/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'form_submit', path, label: 'contact' }),
    keepalive: true,
  }).catch(() => {
    // Never surfaces to the visitor: their enquiry was already sent.
  });
}
