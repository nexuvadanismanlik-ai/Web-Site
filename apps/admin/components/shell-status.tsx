'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminPath } from '../lib/routes';

const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');

type State = 'checking' | 'up' | 'slow' | 'down';

/**
 * Whether the system is answering, on every screen.
 *
 * When the panel is slow, the first question is always the same: is it me, my
 * connection, or the server? Without an answer people reload, then reload
 * again, then assume the thing is broken. A dot that says "the API answered
 * 80ms ago" turns that into a fact, and a red one turns "everything is broken"
 * into "the API is down, and here is the screen that says why".
 *
 * Deliberately a health check and nothing more: it must be cheap enough to run
 * every half minute and must never be the reason a page is slow.
 */
const INTERVAL_MS = 30_000;

/** Above this, the service is answering but something is wrong. */
const SLOW_MS = 2_000;

export function ShellStatus() {
  const [state, setState] = useState<State>('checking');
  const [ms, setMs] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!API_BASE) return;
    let alive = true;

    const check = async () => {
      // A background tab does not need to know, and polling one keeps a
      // suspended service awake for nobody.
      if (document.visibilityState !== 'visible') return;

      const started = Date.now();
      try {
        const res = await fetch(`${API_BASE}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });
        if (!alive) return;
        const took = Date.now() - started;
        setMs(took);
        setCheckedAt(new Date());
        setState(res.ok ? (took > SLOW_MS ? 'slow' : 'up') : 'down');
      } catch {
        if (!alive) return;
        setMs(null);
        setCheckedAt(new Date());
        setState('down');
      }
    };

    void check();
    const timer = setInterval(check, INTERVAL_MS);
    document.addEventListener('visibilitychange', check);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const dot =
    state === 'up'
      ? 'bg-green-500'
      : state === 'slow'
        ? 'bg-amber-500'
        : state === 'down'
          ? 'bg-red-500'
          : 'bg-overlay/30';

  const label =
    state === 'up'
      ? 'Sistem çalışıyor'
      : state === 'slow'
        ? 'Sistem yavaş'
        : state === 'down'
          ? 'Sunucuya ulaşılamıyor'
          : 'Kontrol ediliyor';

  const title = [
    label,
    ms !== null ? `${ms} ms` : null,
    checkedAt ? `son kontrol ${checkedAt.toLocaleTimeString('tr-TR')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={adminPath('/system')}
      title={title}
      aria-label={title}
      className="flex items-center gap-2 rounded-xl border border-overlay/10 px-2.5 py-2 transition-colors hover:border-overlay/25"
    >
      <span className="relative flex h-2 w-2">
        {state === 'up' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {/* The word only on wide screens; the colour carries it everywhere else,
          and the label is on the title and aria-label for anything that is not
          reading colour. */}
      <span className="hidden text-xs text-muted xl:inline">{label}</span>
    </Link>
  );
}
