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

    send('/analytics/collect', {
      path: pathname,
      ...(document.referrer && !document.referrer.includes(location.host)
        ? { referrer: document.referrer }
        : {}),
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
