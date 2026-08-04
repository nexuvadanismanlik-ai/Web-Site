'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { CloudUpload, Check, AlertTriangle, Loader2, X } from 'lucide-react';
import { publishSite, getPublishStatus } from '../app/actions';
import type { PublishResult, PublishStatus } from '../lib/content';

/**
 * Content is saved to the database the moment an editor saves; this is the
 * separate step that carries it to the public site.
 *
 * Publishing is a deliberate action rather than automatic because the site is
 * currently a static export: each publish rebuilds it, which takes minutes, so
 * firing one per keystroke-save would queue useless deploys. Once the site runs
 * with ISR the same button becomes near-instant and this stays as the
 * publish-when-ready control editors already understand.
 *
 * A deploy hook answers as soon as the build is queued, so the button used to
 * say "Yayınlandı" while the build was still running — and stayed saying it if
 * the build then failed. It now follows the deploy through to its real outcome.
 */

/** How often a running build is checked. Deploys take minutes, not seconds. */
const POLL_MS = 15_000;

export function PublishButton() {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const next = await getPublishStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;

    async function tick() {
      const next = await refresh();
      if (!alive) return;
      // Only keep polling while something is actually in flight.
      if (next?.publishInProgress) {
        timer.current = setTimeout(() => void tick(), POLL_MS);
      }
    }

    void tick();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const notConfigured = status !== null && !status.configured;
  const inProgress = pending || (status?.publishInProgress ?? false);
  const last = status?.lastPublish ?? null;
  const showResult = !dismissed && last !== null && !inProgress;

  function onPublish() {
    setDismissed(false);
    startTransition(async () => {
      await publishSite();
      await refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {showResult && <Outcome result={last} onDismiss={() => setDismissed(true)} />}

      {!showResult && !inProgress && notConfigured && (
        <span
          className="hidden items-center gap-1.5 text-xs text-amber-500 sm:flex"
          title="PUBLISH_STRATEGY ve hedef adres sunucuda tanımlı değil."
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Yayınlama yapılandırılmamış
        </span>
      )}

      {!showResult && !inProgress && !notConfigured && status?.pendingChanges && (
        <span className="hidden items-center gap-1.5 text-xs text-amber-500 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Yayınlanmamış değişiklik var
        </span>
      )}

      <button
        onClick={onPublish}
        disabled={inProgress || notConfigured}
        className="inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        title={
          notConfigured
            ? 'Sunucuda yayınlama stratejisi tanımlı değil'
            : 'Kaydedilen içeriği siteye taşı'
        }
      >
        {inProgress ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Yayınlanıyor
          </>
        ) : last?.state === 'SUCCEEDED' && !status?.pendingChanges ? (
          <>
            <Check className="h-4 w-4" />
            Yayınlandı
          </>
        ) : (
          <>
            <CloudUpload className="h-4 w-4" />
            Yayınla
          </>
        )}
      </button>
    </div>
  );
}

/** The settled outcome of the most recent attempt, with who and when. */
function Outcome({ result, onDismiss }: { result: PublishResult; onDismiss: () => void }) {
  const failed = result.state === 'FAILED';
  const when = new Date(result.at).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <span
      className={`hidden max-w-sm items-center gap-2 text-xs sm:flex ${
        failed ? 'text-red-500' : 'text-green-600'
      }`}
      title={result.detail}
    >
      <span className="truncate">
        {failed ? `Yayınlanamadı: ${result.detail}` : 'Yayınlandı'}
        <span className="text-faint">
          {' · '}
          {when}
          {result.actor ? ` · ${result.actor}` : ''}
        </span>
      </span>
      <button
        onClick={onDismiss}
        aria-label="Bildirimi kapat"
        className="shrink-0 text-faint transition-colors hover:text-fg"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
