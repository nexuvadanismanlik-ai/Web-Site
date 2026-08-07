'use client';

import { useState, type FormEvent } from 'react';
import { Sun, Moon, Check, Loader2, KeyRound, Palette, AlertCircle, User } from 'lucide-react';
import { useAdminTheme, type AdminTheme } from '../theme-provider';
import { changePassword } from '../../app/actions';

const THEMES: { value: AdminTheme; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Aydınlık', description: 'Beyaz zemin, gündüz kullanımı için', icon: Sun },
  { value: 'dark', label: 'Koyu', description: 'Koyu zemin, düşük ışıkta göz yormaz', icon: Moon },
];

export function SettingsClient({ email, name, role }: { email: string; name: string; role: string }) {
  const { theme, setTheme } = useAdminTheme();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (next !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (next.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }

    setStatus('saving');
    const res = await changePassword(current, next);
    if (res.ok) {
      setStatus('done');
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => setStatus('idle'), 4000);
    } else {
      setStatus('idle');
      setError(res.error ?? 'Şifre değiştirilemedi.');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-faint">
        Hesabın
      </h2>

      {/* ── Account ─────────────────────────────────────────────────────── */}
      <section className="panel p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <User className="h-4 w-4 text-brand-dyn" />
          <h2 className="font-heading text-base font-semibold text-fg">Hesap</h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="section-label">Ad</dt>
            <dd className="mt-1 text-sm text-fg">{name}</dd>
          </div>
          <div>
            <dt className="section-label">E-posta</dt>
            <dd className="mt-1 truncate text-sm text-fg">{email}</dd>
          </div>
          <div>
            <dt className="section-label">Rol</dt>
            <dd className="mt-1 text-sm text-fg">{role}</dd>
          </div>
        </dl>
      </section>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <section className="panel p-6">
        <div className="mb-2 flex items-center gap-2.5">
          <Palette className="h-4 w-4 text-brand-dyn" />
          <h2 className="font-heading text-base font-semibold text-fg">Panel Görünümü</h2>
        </div>
        <p className="mb-5 text-sm text-muted">
          Yalnızca bu paneli ve yalnızca bu tarayıcıyı etkiler. Web sitesinin teması ayrıdır ve{' '}
          <span className="text-fg">Marka &amp; Tema</span> bölümünden yönetilir.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {THEMES.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                aria-pressed={active}
                className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-brand-400 bg-brand-500/10'
                    : 'border-overlay/10 hover:border-overlay/30'
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    opt.value === 'light'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-slate-800 text-indigo-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                    {opt.label}
                    {active && <Check className="h-3.5 w-3.5 text-brand-dyn" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Password ────────────────────────────────────────────────────── */}
      <section className="panel p-6">
        <div className="mb-2 flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 text-brand-dyn" />
          <h2 className="font-heading text-base font-semibold text-fg">Şifre Değiştir</h2>
        </div>
        <p className="mb-5 text-sm text-muted">
          Değişiklikten sonra diğer cihazlardaki oturumlar kapanır.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="current-password">
              Mevcut şifre
            </label>
            <input
              id="current-password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="field-input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="new-password">
                Yeni şifre
              </label>
              <input
                id="new-password"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="field-input"
              />
              <p className="mt-1.5 text-xs text-faint">En az 8 karakter.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="confirm-password">
                Yeni şifre (tekrar)
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="field-input"
              />
            </div>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {status === 'done' && (
            <p className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3.5 py-2.5 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Şifreniz güncellendi.
            </p>
          )}

          <button type="submit" disabled={status === 'saving'} className="btn-primary">
            {status === 'saving' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" /> Şifreyi Güncelle
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
