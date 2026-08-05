'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { adminPath } from '../../../lib/routes';
import { diagnoseSignInFailure } from './actions';

/**
 * Split out from the page because useSearchParams opts a component out of
 * static rendering; the page wraps this in a Suspense boundary so the rest of
 * the login screen still prerenders.
 */
/** Why the middleware sent someone back here, in words they can act on. */
const REDIRECT_REASONS: Record<string, string> = {
  forbidden: 'Bu hesabın yönetim paneline erişim yetkisi yok.',
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || adminPath('/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(REDIRECT_REASONS[params.get('error') ?? ''] ?? '');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    } else {
      // The provider can only say no. Ask why before blaming the password:
      // during an outage this form used to tell the one person who could fix
      // it that their credentials were wrong.
      const reason = await diagnoseSignInFailure();
      setError(reason.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass rounded-3xl p-7 shadow-2xl">
      <div className="space-y-4">
        <div>
          <label className="field-label">E-posta</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
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
          <label className="field-label">Şifre</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
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
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Giriş yapılıyor...
          </>
        ) : (
          <>
            Giriş Yap <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-overlay/10 bg-overlay/[0.02] px-3.5 py-3 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dyn" />
        <span>Bu panel yalnızca yetkili kullanıcılar içindir.</span>
      </div>
    </form>
  );
}
