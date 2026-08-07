'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Activity, Clock, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { adminPath } from '../../lib/routes';

/**
 * What to say when a screen fails.
 *
 * "Bir şeyler ters gitti" is not an error message. It tells somebody that
 * something they cannot see went wrong for a reason they cannot know, and
 * leaves them with nothing to do but reload and hope. Every failure here gets
 * three things instead: what happened, why it happened, and what the person
 * looking at it can actually do about it.
 *
 * The classification is on the message text rather than on a status code
 * because by the time an error reaches a React error boundary the status is
 * gone — this is what survives the trip.
 */
type Kind = 'asleep' | 'offline' | 'auth' | 'unknown';

function classify(message: string): Kind {
  if (/ulaşılamadı|aborted|timeout|ETIMEDOUT|503/i.test(message)) return 'asleep';
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) return 'offline';
  if (/unauthor|401|403|forbidden|sign in|oturum/i.test(message)) return 'auth';
  return 'unknown';
}

const COPY: Record<
  Kind,
  { icon: typeof AlertTriangle; title: string; why: string; what: string }
> = {
  asleep: {
    icon: Clock,
    title: 'Sunucu uyanıyor',
    why:
      'API servisi bir süre kullanılmadığında uykuya geçiyor ve uyanması yaklaşık bir dakika sürüyor. ' +
      'Bu bir hata değil, barındırma planının davranışı.',
    what: 'Birkaç saniye bekleyip tekrar dene. Panel açık kaldığı sürece servis bir daha uyumayacak.',
  },
  offline: {
    icon: WifiOff,
    title: 'Sunucuya bağlanılamıyor',
    why:
      'API servisine hiç ulaşılamadı. Servis çalışmıyor olabilir, ya da internet bağlantında ' +
      'bir kesinti var.',
    what: 'Önce internet bağlantını kontrol et. Sorun devam ederse Sistem ekranı hangi bağlantının koptuğunu söyler.',
  },
  auth: {
    icon: ShieldAlert,
    title: 'Oturumun sona ermiş',
    why: 'Giriş bilgilerin artık geçerli değil. Uzun süre işlem yapılmadığında oturum kapanır.',
    what: 'Tekrar giriş yap. Kaydedilmemiş bir düzenlemen varsa önce onu bir yere kopyala.',
  },
  unknown: {
    icon: AlertTriangle,
    title: 'Bu ekran yüklenemedi',
    why: 'Beklenmeyen bir hata oluştu. Aşağıdaki teknik ayrıntı ne olduğunu gösteriyor.',
    what: 'Tekrar dene. Aynı hata sürüyorsa aşağıdaki hata kodunu not al.',
  },
};

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const kind = classify(error.message ?? '');
  const copy = COPY[kind];
  const Icon = copy.icon;

  const [seconds, setSeconds] = useState(kind === 'asleep' ? 8 : 0);

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  // A waking service will be up shortly, so this retries on its own rather than
  // asking somebody to sit and click. Only for that case: retrying an error
  // that is not going to fix itself just hides it behind a loop.
  useEffect(() => {
    if (kind !== 'asleep') return;
    if (seconds <= 0) {
      reset();
      return;
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [kind, seconds, reset]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          kind === 'asleep'
            ? 'bg-amber-500/15 text-amber-500'
            : kind === 'auth'
              ? 'bg-blue-500/15 text-blue-500'
              : 'bg-red-500/15 text-red-500'
        }`}
      >
        <Icon className="h-7 w-7" />
      </span>

      <h1 className="mt-6 font-heading text-xl font-bold text-fg">{copy.title}</h1>

      <p className="mt-3 text-sm leading-relaxed text-muted">{copy.why}</p>
      <p className="mt-2 text-sm leading-relaxed text-fg">{copy.what}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="btn-primary">
          <RefreshCw className="h-4 w-4" />
          {kind === 'asleep' && seconds > 0 ? `Tekrar deneniyor (${seconds})` : 'Tekrar Dene'}
        </button>
        {kind === 'auth' ? (
          <Link href={adminPath('/login')} className="btn-ghost">
            Giriş yap
          </Link>
        ) : (
          <Link href={adminPath('/system')} className="btn-ghost">
            <Activity className="h-4 w-4" />
            Sistem durumu
          </Link>
        )}
      </div>

      {/* The real message, not just a digest. Somebody debugging this needs the
          text; a hash only helps if there are server logs to match it against,
          and the person looking at this screen usually has neither. */}
      {(error.message || error.digest) && (
        <details className="mt-8 w-full text-left">
          <summary className="cursor-pointer text-xs text-faint hover:text-muted">
            Teknik ayrıntı
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-overlay/10 bg-overlay/[0.03] p-3 text-[11px] leading-relaxed text-muted">
            {error.message}
            {error.digest ? `\n\nHata kodu: ${error.digest}` : ''}
          </pre>
        </details>
      )}
    </div>
  );
}
