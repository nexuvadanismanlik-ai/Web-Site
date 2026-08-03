'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/';
  const [email, setEmail] = useState('admin@nexuva.com');
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--brand)_28%,transparent),transparent_65%)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient-bg text-xl font-bold text-white shadow-lg">
            N
          </div>
          <h1 className="mt-5 font-heading text-2xl font-bold text-white">Nexuva OS</h1>
          <p className="mt-1 text-sm text-ink-400">Yönetim Paneli · Super Admin</p>
        </div>

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
                  className="field-input pl-10"
                  placeholder="admin@nexuva.com"
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
            <span>
              Demo giriş: <span className="text-ink-200">admin@nexuva.com</span> /{' '}
              <span className="text-ink-200">nexuva123</span>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
