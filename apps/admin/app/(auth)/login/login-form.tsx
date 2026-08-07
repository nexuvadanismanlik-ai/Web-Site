'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { adminPath } from '../../../lib/routes';
import { diagnoseSignInFailure } from './actions';

const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');

/**
 * Split out from the page because useSearchParams opts a component out of
 * static rendering; the page wraps this in a Suspense boundary so the rest of
 * the login screen still prerenders.
 */

/** Why the middleware sent someone back here, in words they can act on. */
const REDIRECT_REASONS: Record<string, string> = {
  forbidden: 'Bu hesabın yönetim paneline erişim yetkisi yok.',
};

/**
 * What the provider's refusal actually meant.
 *
 * NextAuth can only pass a string back from `authorize`, so the server throws
 * a code and this turns it into a sentence. The distinction matters: telling
 * somebody their password is wrong when the service is asleep sends them off
 * to reset a password that was never the problem.
 */
const FAILURE_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'E-posta veya şifre hatalı.',
  ApiTimeout:
    'Sunucu zamanında yanıt vermedi. Uzun süredir kullanılmadıysa uyanması bir dakika sürebilir — birkaç saniye sonra tekrar dene.',
  ApiUnreachable:
    'Sunucuya bağlanılamadı. İnternet bağlantını kontrol et; sorun sürerse servis çalışmıyor olabilir.',
  ApiError: 'Sunucu beklenmeyen bir yanıt verdi. Birkaç saniye sonra tekrar dene.',
  TooManyAttempts:
    'Çok fazla giriş denemesi yapıldı. Bir dakika bekleyip tekrar dene.',
};

/**
 * How long the form waits before giving up on its own.
 *
 * The server budget is eighty seconds; this is a little longer so the server's
 * own message wins the race when it has one. What it guarantees is that the
 * spinner always stops — before this existed, a sign-in that never came back
 * left the button spinning with no error and no way forward, which is exactly
 * what people described as "sonsuza kadar dönüyor".
 */
const CLIENT_TIMEOUT_MS = 95_000;

/** After this long, the wait is worth explaining rather than just enduring. */
const EXPLAIN_AFTER_MS = 6_000;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || adminPath('/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(REDIRECT_REASONS[params.get('error') ?? ''] ?? '');
  const [loading, setLoading] = useState(false);
  const [waited, setWaited] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Starts waking the API the moment this page is open.
   *
   * The service suspends when idle and takes about seventy seconds to come
   * back. Somebody spends five to twenty seconds typing an address and a
   * password — so if the wake-up begins when the page loads rather than when
   * they press the button, most of it happens while they are busy. It costs
   * one health check and removes the worst first impression the panel has.
   */
  useEffect(() => {
    if (!API_BASE) return;
    void fetch(`${API_BASE}/health`, { cache: 'no-store' }).catch(() => {
      // A failed wake-up is not something the person signing in needs to hear
      // about; they will find out from the sign-in itself, with a real message.
    });
  }, []);

  useEffect(() => {
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setWaited(0);

    const startedAt = Date.now();
    tick.current = setInterval(
      () => setWaited(Math.round((Date.now() - startedAt) / 1000)),
      1000,
    );

    const stop = () => {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
      setLoading(false);
    };

    try {
      // Raced against a deadline so the spinner cannot outlive the person's
      // patience. Whichever settles first decides what they are told.
      const result = await Promise.race([
        signIn('credentials', { email, password, redirect: false }),
        new Promise<{ ok: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, error: 'ApiTimeout' }), CLIENT_TIMEOUT_MS),
        ),
      ]);

      if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
        return;
      }

      const code = result?.error ?? '';
      if (FAILURE_MESSAGES[code]) {
        setError(FAILURE_MESSAGES[code] as string);
        stop();
        return;
      }

      // An unrecognised refusal. The provider can only say no, so ask the
      // server what it can see before blaming the password — during an outage
      // this form used to tell the one person who could fix it that their
      // credentials were wrong.
      const reason = await diagnoseSignInFailure();
      setError(reason.message);
      stop();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Giriş yapılamadı: ${err.message}`
          : 'Giriş yapılamadı. Birkaç saniye sonra tekrar dene.',
      );
      stop();
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass rounded-3xl p-7 shadow-2xl">
      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="login-email">
            E-posta
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="field-input pl-10"
              placeholder="ornek@nexuva.com"
            />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="login-password">
            Şifre
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="field-input pl-10"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-300"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Giriş yapılıyor
            {waited > 2 ? ` (${waited}s)` : ''}
          </>
        ) : (
          <>
            Giriş Yap <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* A long wait that is explained is a different experience from the same
          wait unexplained. This is the honest reason, and it names an end. */}
      {loading && waited * 1000 >= EXPLAIN_AFTER_MS && (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
          Sunucu uzun süredir kullanılmadığı için uyanıyor. Bu ilk girişte bir dakikaya
          kadar sürebilir — sonraki girişler saniyeler içinde açılır.
        </p>
      )}

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-overlay/10 bg-overlay/[0.02] px-3.5 py-3 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dyn" />
        <span>Bu panel yalnızca yetkili kullanıcılar içindir.</span>
      </div>
    </form>
  );
}
