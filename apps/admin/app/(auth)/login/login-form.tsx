'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { adminPath } from '../../../lib/routes';

/**
 * Split out from the page because useSearchParams opts a component out of
 * static rendering; the page wraps this in a Suspense boundary so the rest of
 * the login screen still prerenders.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || adminPath('/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
      setError('E-posta veya şifre hatalı.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass rounded-3xl p-7 shadow-2xl">
      <div className="space-y-4">
        <div>
          <label className="field-label">E-posta</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
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
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
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

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-xs text-ink-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
        <span>Bu panel yalnızca yetkili kullanıcılar içindir.</span>
      </div>
    </form>
  );
}
