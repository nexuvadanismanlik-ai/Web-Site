'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  CloudUpload,
  History,
  Loader2,
  RotateCcw,
  ScrollText,
  X,
} from 'lucide-react';
import { publishSite, restoreVersion } from '../../app/actions';
import type { ContentVersion, PublishResult, PublishStatus } from '../../lib/content';
import { Panel } from '../fields';

/**
 * Everything about what is live and how it got there.
 *
 * Publishing used to be a single button with no history behind it: the record
 * of who published what lived in memory on the API, so the deploy a publish
 * triggered erased the record of that publish. This screen exists because the
 * question "what is on the site right now, and can I go back?" had no answer.
 */
export function PublishCenter({
  status,
  versions,
}: {
  status: PublishStatus | null;
  versions: ContentVersion[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const live = versions.find((v) => v.isPublished) ?? null;
  const inProgress = pending || (status?.publishInProgress ?? false);

  function onPublish() {
    setMessage(null);
    startTransition(async () => {
      const result = await publishSite();
      setMessage({
        ok: result.state !== 'FAILED',
        text: result.detail,
      });
    });
  }

  function onRestore(number: number) {
    setConfirming(null);
    setMessage(null);
    startTransition(async () => {
      const result = await restoreVersion(number);
      setMessage(
        result.ok
          ? { ok: true, text: `Sürüm ${number} geri yüklendi ve sürüm ${result.version} olarak yayınlandı.` }
          : { ok: false, text: result.error ?? 'Geri yüklenemedi.' },
      );
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-fg sm:text-3xl">Yayın Merkezi</h1>
        <p className="mt-1 text-muted">
          Panelde yaptığın değişiklikler taslakta durur. Ziyaretçiler yalnızca yayınladığın
          sürümü görür.
        </p>
      </div>

      {message && (
        <p
          role="alert"
          className={`mb-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            message.ok
              ? 'border-green-500/30 bg-green-500/10 text-green-600'
              : 'border-red-500/30 bg-red-500/10 text-red-500'
          }`}
        >
          {message.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </p>
      )}

      {/* ── Current state ──────────────────────────────────────────────── */}
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Şu an yayında</div>
            <div className="mt-1 font-heading text-2xl font-bold text-fg">
              {live ? `Sürüm ${live.number}` : 'Henüz yayınlanmadı'}
            </div>
            {live && (
              <div className="mt-1 text-sm text-faint">
                {formatWhen(live.publishedAt ?? live.createdAt)}
                {live.createdBy ? ` · ${live.createdBy}` : ''}
              </div>
            )}
          </div>

          <button
            onClick={onPublish}
            disabled={inProgress || status?.configured === false}
            className="inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {inProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Yayınlanıyor
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4" /> Taslağı Yayınla
              </>
            )}
          </button>
        </div>

        <div className="mt-6 grid gap-3 border-t border-overlay/10 pt-5 sm:grid-cols-2">
          <Fact
            label="Bekleyen değişiklik"
            value={status?.pendingChanges ? 'Var' : 'Yok'}
            warn={status?.pendingChanges === true}
            hint={
              status?.lastChangeAt
                ? `Son düzenleme: ${formatWhen(status.lastChangeAt)}`
                : 'Kaydedilmiş düzenleme yok'
            }
          />
          <Fact
            label="Yayınlama yöntemi"
            value={STRATEGY_LABEL[status?.strategy ?? 'none']}
            warn={status?.configured === false}
            hint={
              status?.configured === false
                ? 'Sunucuda yapılandırılmamış — site yeniden derlenemez'
                : status?.outcomeTracking
                  ? 'Derleme sonucu izleniyor'
                  : 'Derleme sonucu izlenemiyor (RENDER_API_KEY tanımlı değil)'
            }
          />
        </div>
      </Panel>

      {/* ── History ────────────────────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-fg">
          <History className="h-4 w-4" /> Sürüm Geçmişi
        </h2>

        {versions.length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 p-10 text-center text-sm text-faint">
            <History className="h-6 w-6" />
            Henüz yayınlanmış bir sürüm yok. İlk yayınla birlikte burada listelenecek.
          </Panel>
        ) : (
          <Panel className="divide-y divide-overlay/5">
            {versions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-center gap-4 p-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    version.isPublished
                      ? 'brand-gradient-bg text-white'
                      : 'bg-overlay/5 text-muted'
                  }`}
                >
                  {version.number}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">
                      Sürüm {version.number}
                    </span>
                    {version.isPublished && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                        Yayında
                      </span>
                    )}
                    {version.restoredFrom !== null && (
                      <span className="rounded-full bg-overlay/10 px-2 py-0.5 text-[11px] text-muted">
                        Sürüm {version.restoredFrom}&apos;den geri alındı
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-faint">
                    {formatWhen(version.publishedAt ?? version.createdAt)}
                    {version.createdBy ? ` · ${version.createdBy}` : ''}
                  </div>
                </div>

                {!version.isPublished &&
                  (confirming === version.number ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => onRestore(version.number)}
                        disabled={pending}
                        className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Geri al
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        aria-label="Vazgeç"
                        className="text-faint transition-colors hover:text-fg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirming(version.number)}
                      disabled={pending}
                      className="btn-ghost shrink-0 text-xs disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Bu sürüme dön
                    </button>
                  ))}
              </div>
            ))}
          </Panel>
        )}

        {versions.length > 0 && (
          <p className="mt-3 text-xs text-faint">
            Geri almak eski sürümü siler değil, kopyasını yeni bir sürüm olarak yayınlar —
            böylece geri alma işlemi de geri alınabilir.
          </p>
        )}
      </div>

      {/* ── Publish log ────────────────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-fg">
          <ScrollText className="h-4 w-4" /> Yayın Kayıtları
        </h2>

        {!status || status.history.length === 0 ? (
          <Panel className="p-8">
            <p className="text-center text-sm text-faint">Henüz yayın denemesi yok.</p>
          </Panel>
        ) : (
          <Panel className="divide-y divide-overlay/5">
            {status.history.map((entry) => (
              <PublishLogRow key={entry.id ?? entry.at} entry={entry} />
            ))}
          </Panel>
        )}

        <p className="mt-3 text-xs text-faint">
          Bu kayıtlar silinmez. Bir yayının başarısız olduğu, ne kadar sürdüğü ve kimin
          yaptığı sonradan da sorulabilmeli.
        </p>
      </div>
    </div>
  );
}

/** How a publish ended, in the panel's own words. */
const STATE_STYLE: Record<string, { label: string; tone: string }> = {
  SUCCEEDED: { label: 'Yayınlandı', tone: 'border-green-500/30 bg-green-500/10 text-green-600' },
  FAILED: { label: 'Başarısız', tone: 'border-red-500/30 bg-red-500/10 text-red-500' },
  PENDING: { label: 'Derleniyor', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-500' },
};

/**
 * One publish attempt, with everything needed to reason about it afterwards.
 *
 * The duration matters more than it looks: "the site has not changed yet" and
 * "the build is still running" are the same picture from the panel, and this
 * is what tells them apart. The deploy id is here so a build can be found in
 * the hosting provider's own logs without guessing from timestamps.
 */
function PublishLogRow({ entry }: { entry: PublishResult }) {
  const style = STATE_STYLE[entry.state] ?? {
    label: entry.state,
    tone: 'border-overlay/20 text-muted',
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.tone}`}>
          {style.label}
        </span>
        {entry.version !== null && (
          <span className="text-sm font-medium text-fg">Sürüm {entry.version}</span>
        )}
        <span className="text-xs text-faint">{formatWhen(entry.startedAt)}</span>
        {entry.actor && <span className="text-xs text-muted">· {entry.actor}</span>}
        {entry.durationMs !== null && (
          <span className="text-xs text-faint">· {formatDuration(entry.durationMs)}</span>
        )}
      </div>

      <p className="mt-1.5 text-sm text-muted">{entry.detail}</p>

      {entry.deployId && (
        <p className="mt-1.5 font-mono text-[11px] text-faint">deploy: {entry.deployId}</p>
      )}
    </div>
  );
}

/** Seconds under a minute, minutes above — nobody reads "138000 ms". */
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} sn`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} dk` : `${minutes} dk ${rest} sn`;
}

const STRATEGY_LABEL = {
  'deploy-hook': 'Yeniden derleme (deploy hook)',
  revalidate: 'Anlık yenileme (ISR)',
  none: 'Tanımlı değil',
} as const satisfies Record<NonNullable<PublishStatus['strategy']>, string>;

function Fact({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className={`mt-0.5 text-sm font-medium ${warn ? 'text-amber-500' : 'text-fg'}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
