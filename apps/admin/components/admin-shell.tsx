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
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PublishButton } from './publish-button';
import { adminPath, isAdminRoute } from '../lib/routes';

/** Public site, opened from the sidebar. Falls back to the local dev site. */
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

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
  {
    section: 'Hesap',
    items: [{ label: 'Ayarlar', href: '/settings', icon: Settings }],
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

  // Compared through adminPath so the nav still highlights correctly once the
  // panel is mounted under a base path.
  const isActive = (href: string) => {
    if (href === '/') return isAdminRoute(pathname, '/');
    const target = adminPath(href);
    return pathname === target || (pathname?.startsWith(target + '/') ?? false);
  };

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-overlay/10 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient-bg text-sm font-bold text-white">
          N
        </span>
        <span className="font-heading text-lg font-bold text-fg">Nexuva OS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-faint">
              {group.section}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={adminPath(item.href)}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-overlay/10 text-fg'
                        : 'text-muted hover:bg-overlay/[0.06] hover:text-fg'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 ${active ? 'text-brand-dyn' : 'text-faint group-hover:text-fg'}`}
                      style={{ width: 18, height: 18 }}
                    />
                    {item.label}
                  </Link>
                );
              })}
              {group.section === 'İçerik' && (
                <Link
                  href={adminPath('/messages')}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive('/messages')
                      ? 'bg-overlay/10 text-fg'
                      : 'text-muted hover:bg-overlay/[0.06] hover:text-fg'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Inbox style={{ width: 18, height: 18 }} className="text-faint group-hover:text-fg" />
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

      <div className="border-t border-overlay/10 p-3">
        <a
          href={SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-overlay/[0.06] hover:text-fg"
        >
          <ExternalLink style={{ width: 18, height: 18 }} />
          Siteyi Görüntüle
        </a>
        <button
          onClick={() => signOut({ callbackUrl: adminPath('/login') })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
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
      <aside className="chrome fixed inset-y-0 left-0 z-40 hidden w-64 border-r backdrop-blur-xl lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="chrome absolute inset-y-0 left-0 w-64 border-r">
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="chrome sticky top-0 z-30 flex h-16 items-center justify-between border-b px-5 backdrop-blur-xl">
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-overlay/10 bg-overlay/5 text-fg lg:hidden"
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <PublishButton />
            <span className="hidden text-sm text-muted sm:inline">{userName}</span>
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
