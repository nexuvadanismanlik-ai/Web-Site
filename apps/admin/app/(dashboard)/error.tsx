'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Replaces Next's bare "server-side exception" screen for the dashboard.
 *
 * By far the most common cause is the API being unreachable — on a plan that
 * suspends when idle, the first request after a quiet spell can exceed the
 * timeout. That is recoverable by retrying, so the page says so instead of
 * showing a digest hash the operator cannot act on.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  const looksLikeApiOutage =
    /ulaşılamadı|fetch|network|timeout|aborted|ECONNREFUSED|503/i.test(error.message);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <AlertTriangle className="h-7 w-7" />
      </span>

      <h1 className="mt-6 font-heading text-xl font-bold text-fg">
        {looksLikeApiOutage ? 'Sunucuya ulaşılamadı' : 'Bir şeyler ters gitti'}
      </h1>

      <p className="mt-2 text-sm text-muted">
        {looksLikeApiOutage
          ? 'API servisi uyanıyor olabilir. İlk açılış bir dakikaya kadar sürebilir — birkaç saniye sonra tekrar deneyin.'
          : 'Sayfa yüklenirken beklenmeyen bir hata oluştu.'}
      </p>

      <button onClick={reset} className="btn-primary mt-6">
        <RefreshCw className="h-4 w-4" />
        Tekrar Dene
      </button>

      {error.digest && (
        <p className="mt-4 text-xs text-faint">Hata kodu: {error.digest}</p>
      )}
    </div>
  );
}
