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
} from 'lucide-react';
import { readSiteContent, readMessages } from '../../lib/content';

export const dynamic = 'force-dynamic';

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
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Hoş geldin 👋</h1>
        <p className="mt-1 text-ink-400">
          {content.brand.siteName} web sitesini buradan yönetiyorsun. Her değişiklik anında siteye
          yansır.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="panel p-5">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  s.highlight ? 'brand-gradient-bg text-white' : 'bg-white/5 text-brand-300'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-4 font-heading text-3xl font-bold text-white">{s.value}</div>
              <div className="mt-1 text-sm text-ink-400">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Quick links */}
        <div>
          <h2 className="mb-4 font-heading text-lg font-semibold text-white">Hızlı Erişim</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="panel group flex items-center gap-4 p-4 transition-colors hover:border-white/25 hover:bg-white/[0.05]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-brand-300 transition-colors group-hover:brand-gradient-bg group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-white">{q.label}</span>
                    <span className="block text-xs text-ink-500">{q.desc}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent messages */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-white">Son Mesajlar</h2>
            <Link href="/messages" className="text-sm text-brand-300 hover:text-brand-200">
              Tümü
            </Link>
          </div>
          <div className="panel divide-y divide-white/5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-ink-500">
                <Mail className="h-6 w-6" />
                Henüz mesaj yok.
              </div>
            ) : (
              messages.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href="/messages"
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">{m.name}</span>
                      {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
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
