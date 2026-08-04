'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Palette,
  Sparkles,
  Briefcase,
  BarChart3,
  Building2,
  Star,
  Quote,
  ListChecks,
  Phone,
  LayoutList,
  Inbox,
  ExternalLink,
  LogOut,
  Menu,
  MousePointerClick,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PublishButton } from './publish-button';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Genel',
    items: [
      { label: 'Genel Bakış', href: '/', icon: LayoutDashboard },
      { label: 'Canlı Düzenleme', href: '/visual', icon: MousePointerClick },
      { label: 'Marka & Tema', href: '/brand', icon: Palette },
    ],
  },
  {
    section: 'İçerik',
    items: [
      { label: 'Hero', href: '/hero', icon: Sparkles },
      { label: 'Hizmetler', href: '/services', icon: Briefcase },
      { label: 'İstatistikler', href: '/stats', icon: BarChart3 },
      { label: 'Hakkımızda', href: '/about', icon: Building2 },
      { label: 'Referanslar', href: '/references', icon: Star },
      { label: 'Görüşler', href: '/testimonials', icon: Quote },
      { label: 'Süreç', href: '/process', icon: ListChecks },
      { label: 'İletişim', href: '/contact', icon: Phone },
      { label: 'Menü & Footer', href: '/navigation', icon: LayoutList },
    ],
  },
];

export function AdminShell({
  children,
  userName,
  unreadCount,
}: {
  children: ReactNode;
  userName: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient-bg text-sm font-bold text-white">
          N
        </span>
        <span className="font-heading text-lg font-bold text-white">Nexuva OS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-ink-600">
              {group.section}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-ink-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 ${active ? 'text-brand-300' : 'text-ink-500 group-hover:text-ink-200'}`}
                      style={{ width: 18, height: 18 }}
                    />
                    {item.label}
                  </Link>
                );
              })}
              {group.section === 'İçerik' && (
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive('/messages')
                      ? 'bg-white/10 text-white'
                      : 'text-ink-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Inbox style={{ width: 18, height: 18 }} className="text-ink-500 group-hover:text-ink-200" />
                    Mesajlar
                  </span>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full brand-gradient-bg px-1.5 text-[0.65rem] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ExternalLink style={{ width: 18, height: 18 }} />
          Siteyi Görüntüle
        </a>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut style={{ width: 18, height: 18 }} />
          Çıkış Yap
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-ink-925/70 backdrop-blur-xl lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-ink-925">
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-ink-950/70 px-5 backdrop-blur-xl">
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white lg:hidden"
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <PublishButton />
            <span className="hidden text-sm text-ink-400 sm:inline">{userName}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full brand-gradient-bg text-sm font-bold text-white">
              {userName.charAt(0)}
            </span>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
