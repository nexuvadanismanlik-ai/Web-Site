import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default function LoginPage() {
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
          <h1 className="mt-5 font-heading text-2xl font-bold text-fg">Nexuva OS</h1>
          <p className="mt-1 text-sm text-muted">Yönetim Paneli · Super Admin</p>
        </div>

        {/* The form reads the callbackUrl query param, which cannot be known at
            build time — Suspense keeps the surrounding screen prerenderable. */}
        <Suspense
          fallback={<div className="glass h-[22rem] animate-pulse rounded-3xl" />}
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
