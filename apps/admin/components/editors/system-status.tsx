'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, MinusCircle, RefreshCw, ServerCrash } from 'lucide-react';
import type { Connection, ConnectionState, SystemStatus } from '../../lib/model';

/** Three states, three words, one colour each. */
const STATE: Record<ConnectionState, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  connected: {
    label: 'Bağlı',
    tone: 'border-green-500/30 bg-green-500/10 text-green-600',
    Icon: CheckCircle2,
  },
  broken: {
    label: 'Hatalı',
    tone: 'border-red-500/30 bg-red-500/10 text-red-500',
    Icon: AlertTriangle,
  },
  missing: {
    label: 'Eksik',
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    Icon: MinusCircle,
  },
};

function when(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * What is connected, what is broken, and what was never set up.
 *
 * Written for the moment publishing stops working. Until now that moment
 * produced a panel that looked fine and a website that did not change, and the
 * only way to find out why was to read server logs — which the person who
 * needs the answer does not have.
 */
export function SystemStatusScreen({ status }: { status: SystemStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checkedAt, setCheckedAt] = useState(status.checkedAt);

  const broken = status.connections.filter((c) => c.state === 'broken');
  const missing = status.connections.filter((c) => c.state === 'missing');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-fg">Sistem & Bağlantılar</h1>
          <p className="mt-0.5 text-sm text-muted">
            {when(checkedAt)} itibarıyla. Bir şey çalışmıyorsa sebebi burada yazar.
          </p>
        </div>
        <button
          onClick={() =>
            startTransition(() => {
              setCheckedAt(new Date().toISOString());
              router.refresh();
            })
          }
          disabled={pending}
          className="ui-button text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          Yeniden dene
        </button>
      </div>

      {/* The API comes first and stands alone: without it nothing else can even
          be asked. */}
      <div
        className={`mb-4 rounded-2xl border p-5 ${
          status.apiReachable
            ? 'border-green-500/30 bg-green-500/[0.06]'
            : 'border-red-500/30 bg-red-500/[0.06]'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              status.apiReachable ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'
            }`}
          >
            {status.apiReachable ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <ServerCrash className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading font-semibold text-fg">Nexuva API</h2>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  status.apiReachable ? STATE.connected.tone : STATE.broken.tone
                }`}
              >
                {status.apiReachable ? 'Bağlı' : 'Ulaşılamıyor'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{status.apiDetail}</p>
            <p className="mt-2 break-all font-mono text-xs text-faint">{status.apiUrl}</p>

            {!status.apiReachable && (
              <div className="mt-4 rounded-xl border border-overlay/15 bg-overlay/[0.03] p-4 text-sm">
                <p className="font-semibold text-fg">Bu haldeyken panel ne yapamaz</p>
                <ul className="mt-2 space-y-1 text-muted">
                  <li>· İçerik okunamaz ve kaydedilemez.</li>
                  <li>· Yayınlama yapılamaz — site güncellenmez.</li>
                  <li>· Talepler, medya ve bildirimler görünmez.</li>
                </ul>
                <p className="mt-3 text-muted">
                  Sunucu barındırma panelinde{' '}
                  <span className="text-fg">API servisinin çalışıp çalışmadığını</span> ve son
                  dağıtımın başarılı olup olmadığını kontrol edin. Adres yukarıda yazıyor.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {status.apiReachable && status.connections.length > 0 && (
        <>
          {(broken.length > 0 || missing.length > 0) && (
            <p className="mb-4 text-sm text-muted">
              {broken.length > 0 && (
                <span className="text-red-500">{broken.length} bağlantı hatalı</span>
              )}
              {broken.length > 0 && missing.length > 0 && ' · '}
              {missing.length > 0 && (
                <span className="text-amber-500">{missing.length} bağlantı eksik</span>
              )}
            </p>
          )}

          <div className="space-y-3">
            {status.connections.map((connection) => (
              <ConnectionCard key={connection.key} connection={connection} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectionCard({ connection }: { connection: Connection }) {
  const state = STATE[connection.state];
  const Icon = state.Icon;

  return (
    <div className="ui-panel p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${state.tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-fg">{connection.label}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${state.tone}`}>
              {state.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{connection.detail}</p>

          {connection.missing && connection.missing.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-faint">Tanımlanması gereken ayarlar:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {connection.missing.map((name) => (
                  <code
                    key={name}
                    className="rounded border border-overlay/15 bg-overlay/5 px-2 py-0.5 font-mono text-[11px] text-fg"
                  >
                    {name}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
