import Link from 'next/link';
import {
  Briefcase,
  Star,
  Quote,
  Inbox,
  Palette,
  Sparkles,
  BarChart3,
  Phone,
  ArrowRight,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { readSiteContent, readMessages } from '../../lib/content';
import { adminPath } from '../../lib/routes';

export const dynamic = 'force-dynamic';

/** Public site, opened from the overview. Falls back to the local dev site. */
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default async function DashboardHome() {
  const content = await readSiteContent();
  const messages = await readMessages();
  const unread = messages.filter((m) => !m.read).length;

  const stats = [
    { label: 'Hizmet', value: content.services.length, icon: Briefcase },
    { label: 'Referans', value: content.references.length, icon: Star },
    { label: 'Görüş', value: content.testimonials.length, icon: Quote },
    { label: 'Okunmamış Mesaj', value: unread, icon: Inbox, highlight: unread > 0 },
  ];

  const quickLinks = [
    { label: 'Marka & Tema', href: '/brand', icon: Palette, desc: 'Logo, renkler, iletişim' },
    { label: 'Hero', href: '/hero', icon: Sparkles, desc: 'Ana başlık ve metrikler' },
    { label: 'Hizmetler', href: '/services', icon: Briefcase, desc: 'Sunulan hizmetler' },
    { label: 'Referanslar', href: '/references', icon: Star, desc: 'Akan referans listesi' },
    { label: 'İstatistikler', href: '/stats', icon: BarChart3, desc: 'Sayaç rakamları' },
    { label: 'İletişim', href: '/contact', icon: Phone, desc: 'İletişim bilgileri' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-fg sm:text-3xl">Hoş geldin 👋</h1>
          <p className="mt-1 text-muted">
            {content.brand.siteName} web sitesini buradan yönetiyorsun. Değişiklikler kaydedilir,
            yayına almak için <span className="text-fg">Yayınla</span>&apos;ya bas.
          </p>
        </div>
        <a href={SITE_URL} target="_blank" rel="noreferrer" className="btn-ghost shrink-0">
          <ExternalLink className="h-4 w-4" />
          Siteyi Görüntüle
        </a>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="panel p-5">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  s.highlight ? 'brand-gradient-bg text-white' : 'bg-overlay/5 text-brand-dyn'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-4 font-heading text-3xl font-bold text-fg">{s.value}</div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Quick links */}
        <div>
          <h2 className="mb-4 font-heading text-lg font-semibold text-fg">Hızlı Erişim</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="panel group flex items-center gap-4 p-4 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.05]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-overlay/5 text-brand-dyn transition-colors group-hover:brand-gradient-bg group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-fg">{q.label}</span>
                    <span className="block text-xs text-faint">{q.desc}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent messages */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-fg">Son Mesajlar</h2>
            <Link href={adminPath('/messages')} className="text-sm text-brand-dyn hover:opacity-80">
              Tümü
            </Link>
          </div>
          <div className="panel divide-y divide-overlay/5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-faint">
                <Mail className="h-6 w-6" />
                Henüz mesaj yok.
              </div>
            ) : (
              messages.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={adminPath('/messages')}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-overlay/[0.03]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-overlay/5 text-xs font-bold text-fg">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-fg">{m.name}</span>
                      {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {m.subject || m.message}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
