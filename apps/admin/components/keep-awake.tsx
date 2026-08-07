'use client';

import { useEffect } from 'react';

const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');

/**
 * How often the API is poked while somebody has the panel open.
 *
 * The host suspends a service after fifteen minutes without traffic, and waking
 * it costs about seventy seconds — measured against production, not guessed.
 * Ten minutes leaves comfortable margin without being chatty: six requests an
 * hour, each a health check that touches no database.
 */
const INTERVAL_MS = 10 * 60_000;

/**
 * Keeps the API awake for as long as the panel is open.
 *
 * The single worst thing about using this panel was waiting out a cold start
 * mid-task: read some enquiries, go and do something else for twenty minutes,
 * come back, click a tab, and stare at a frozen screen for a minute. Nothing in
 * the application was slow — warm navigation is well under a second — the
 * service had simply gone to sleep between two clicks of the same session.
 *
 * So while a person is actually working, the service does not get to sleep.
 * This is not a workaround for slow code; it is the difference between "idle
 * costs the next click a minute" and "idle costs nothing".
 *
 * Deliberately modest about it:
 *  - only while the tab is visible, so a forgotten background tab does not keep
 *    a service awake all night for nobody;
 *  - fires once immediately on becoming visible, which covers the common case
 *    of returning to a tab left open over lunch;
 *  - `keepalive` and a swallowed failure, because a health ping must never be
 *    something a person sees.
 */
export function KeepAwake() {
  useEffect(() => {
    if (!API_BASE) return;

    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      void fetch(`${API_BASE}/health`, { cache: 'no-store', keepalive: true }).catch(() => {
        // Nobody needs to hear about a failed keep-alive.
      });
    };

    ping();
    const timer = setInterval(ping, INTERVAL_MS);
    document.addEventListener('visibilitychange', ping);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, []);

  return null;
}
