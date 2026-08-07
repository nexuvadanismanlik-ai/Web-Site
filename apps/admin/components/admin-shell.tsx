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
  CloudUpload,
  Image as ImageIcon,
  Star,
  Quote,
  ListChecks,
  Phone,
  LayoutList,
  Activity,
  Search,
  Type,
  Plug,
  Mail as MailIcon,
  Inbox,
  LogOut,
  Menu,
  MousePointerClick,
  Settings,
  MessageSquare,
  LineChart,
  type LucideIcon,
} from 'lucide-react';
import { PublishButton } from './publish-button';
import { NotificationCenter } from './notification-center';
import { CommandPalette, CommandTrigger } from './command-palette';
import { ShellStatus } from './shell-status';
import { adminPath, isAdminRoute } from '../lib/routes';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which count, if any, belongs on this row. */
  badge?: 'enquiries';
}

/**
 * The sidebar, grouped by what somebody is trying to do rather than by which
 * part of the codebase owns it.
 *
 * Content editing, running the business, and configuring the system are three
 * different jobs done at three different times; a flat list of twenty-two
 * entries makes each of them a scan. Anything not found here is one Ctrl-K
 * away — see the command palette.
 */
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Genel',
    items: [
      { label: 'Genel Bakış', href: '/', icon: LayoutDashboard },
      { label: 'Yayın Merkezi', href: '/publish', icon: CloudUpload },
      { label: 'Medya', href: '/media', icon: ImageIcon },
    ],
  },
  {
    section: 'İçerik',
    items: [
      { label: 'Marka & Tema', href: '/brand', icon: Palette },
      { label: 'Hero', href: '/hero', icon: Sparkles },
      { label: 'Hizmetler', href: '/services', icon: Briefcase },
      { label: 'Referanslar', href: '/references', icon: Star },
      { label: 'Görüşler', href: '/testimonials', icon: Quote },
      { label: 'Süreç', href: '/process', icon: ListChecks },
      { label: 'Hakkımızda', href: '/about', icon: Building2 },
      { label: 'İstatistikler', href: '/stats', icon: BarChart3 },
      { label: 'İletişim', href: '/contact', icon: Phone },
      { label: 'Menü & Footer', href: '/navigation', icon: LayoutList },
      { label: 'Site Metinleri', href: '/texts', icon: Type },
      { label: 'Canlı Düzenleme', href: '/visual', icon: MousePointerClick },
    ],
  },
  {
    // What the site produced, as opposed to what it says. Kept apart because
    // somebody answering an enquiry is not somebody editing a headline.
    section: 'İş',
    items: [
      { label: 'Talepler', href: '/crm', icon: Inbox, badge: 'enquiries' },
      { label: 'Mesajlar', href: '/messages', icon: MessageSquare },
      { label: 'Ziyaretçiler', href: '/analytics', icon: LineChart },
    ],
  },
  {
    section: 'Sistem',
    items: [
      { label: 'SEO', href: '/seo', icon: Search },
      { label: 'Mail', href: '/mail', icon: MailIcon },
      { label: 'Entegrasyonlar', href: '/integrations', icon: Plug },
      { label: 'Sistem & Bağlantılar', href: '/system', icon: Activity },
      { label: 'Ayarlar', href: '/settings', icon: Settings },
    ],
  },
];

export function AdminShell({
  children,
  userName,
  unreadCount,
  unreadNotifications,
}: {
  children: ReactNode;
  userName: string;
  /** Unread enquiries, shown on the CRM link. */
  unreadCount: number;
  /** Unread notifications, shown on the bell. */
  unreadNotifications: number;
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
                      className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-brand-dyn' : 'text-faint group-hover:text-fg'}`}
                      style={{ width: 18, height: 18 }}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {/* The count sits on the row it belongs to, so an unanswered
                        enquiry is visible from any screen without opening one. */}
                    {item.badge === 'enquiries' && unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full brand-gradient-bg px-1.5 text-[0.65rem] font-bold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account block — the whole row is the way into Settings. */}
      <div className="border-t border-overlay/10 p-3">
        <Link
          href={adminPath('/settings')}
          onClick={() => setOpen(false)}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
            isActive('/settings') ? 'bg-overlay/10' : 'hover:bg-overlay/[0.06]'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full brand-gradient-bg text-sm font-bold text-white">
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-fg">{userName}</span>
            <span className="block text-xs text-faint">Ayarlar</span>
          </span>
          <Settings
            style={{ width: 16, height: 16 }}
            className="shrink-0 text-faint group-hover:text-fg"
          />
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: adminPath('/login') })}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
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
          {/* Search on the left where the eye starts, so it reads as the way
              in rather than as another control among the icons. */}
          <div className="hidden lg:block">
            <CommandTrigger />
          </div>

          {/* Identity lives in the sidebar account block; the topbar carries
              what applies to every page: what happened, and publishing. */}
          <div className="flex items-center gap-3">
            <ShellStatus />
            <NotificationCenter initialUnread={unreadNotifications} />
            <PublishButton />
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
