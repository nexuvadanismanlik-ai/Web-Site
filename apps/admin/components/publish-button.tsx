'use client';

import { useEffect, useState, useTransition } from 'react';
import { CloudUpload, Check, AlertTriangle, Loader2 } from 'lucide-react';
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
 */
export function PublishButton() {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void getPublishStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [result]);

  const notConfigured = status !== null && !status.configured;
  const hasPending = status?.pendingChanges ?? false;

  function onPublish() {
    startTransition(async () => {
      const res = await publishSite();
      setResult(res);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span
          className={`hidden max-w-xs truncate text-xs sm:inline ${
            result.ok ? 'text-green-300' : 'text-red-300'
          }`}
          title={result.detail}
        >
          {result.ok ? result.detail : `Yayınlanamadı: ${result.detail}`}
        </span>
      )}

      {!result && notConfigured && (
        <span
          className="hidden items-center gap-1.5 text-xs text-amber-300 sm:flex"
          title="PUBLISH_STRATEGY ve hedef adres sunucuda tanımlı değil."
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Yayınlama yapılandırılmamış
        </span>
      )}

      {!result && !notConfigured && hasPending && (
        <span className="hidden items-center gap-1.5 text-xs text-amber-300 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Yayınlanmamış değişiklik var
        </span>
      )}

      <button
        onClick={onPublish}
        disabled={pending || notConfigured}
        className="inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        title={
          notConfigured
            ? 'Sunucuda yayınlama stratejisi tanımlı değil'
            : 'Kaydedilen içeriği siteye taşı'
        }
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Yayınlanıyor
          </>
        ) : result?.ok ? (
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
