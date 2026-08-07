'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { getSystemStatus } from '../../app/actions';
import { adminPath } from '../../lib/routes';
import type { SystemStatus } from '../../lib/model';

/**
 * System health on the overview, without slowing it down.
 *
 * The full check opens a TLS handshake, resolves DNS and asks the mail and
 * hosting providers — a few seconds at best, and this is the first screen
 * anybody sees after signing in. So it loads after the page paints: the
 * overview appears immediately and this fills in.
 */
export function SystemSummary() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getSystemStatus().then((result) => {
      if (!alive) return;
      setStatus(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const broken = status?.connections.filter((c) => c.state === 'broken') ?? [];
  const missing = status?.connections.filter((c) => c.state === 'missing') ?? [];
  const healthy = status?.apiReachable === true && broken.length === 0;

  return (
    <Link
      href={adminPath('/system')}
      className="panel group flex items-center gap-4 p-5 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.03]"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          loading
            ? 'bg-overlay/5 text-faint'
            : healthy
              ? 'bg-green-500/15 text-green-600'
              : 'bg-red-500/15 text-red-500'
        }`}
      >
        <Activity className={`h-5 w-5 ${loading ? 'animate-pulse' : ''}`} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">Sistem Durumu</span>
        <span className="block truncate text-xs text-muted">
          {loading
            ? 'Bağlantılar kontrol ediliyor...'
            : !status?.apiReachable
              ? 'API’ye ulaşılamıyor — panel içeriği okuyamıyor'
              : broken.length > 0
                ? `${broken.length} bağlantı hatalı: ${broken.map((c) => c.label).join(', ')}`
                : missing.length > 0
                  ? `Her şey çalışıyor · ${missing.length} bağlantı kurulmayı bekliyor`
                  : 'Bütün bağlantılar çalışıyor'}
        </span>
      </span>

      <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg" />
    </Link>
  );
}
