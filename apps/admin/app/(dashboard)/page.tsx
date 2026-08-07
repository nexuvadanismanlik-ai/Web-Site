import Link from 'next/link';
import {
  Briefcase,
  Star,
  Inbox,
  Palette,
  Sparkles,
  BarChart3,
  Phone,
  ArrowRight,
  Mail,
  ExternalLink,
  KanbanSquare,
  UserX,
  CalendarDays,
  Trophy,
  ServerCrash,
  Bell,
  CloudUpload,
  HardDrive,
  MailWarning,
} from 'lucide-react';
import { readSiteContent, readMessages } from '../../lib/content';
import {
  getAnalytics,
  getLeadSummary,
  getMailLogs,
  getMedia,
  getNotifications,
  getPublishStatus,
} from '../actions';
import { SystemSummary } from '../../components/editors/system-summary';
import { adminPath } from '../../lib/routes';

export const dynamic = 'force-dynamic';

/** Public site, opened from the overview. Falls back to the local dev site. */
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default async function DashboardHome() {
  // In parallel: two sequential round trips are two cold starts back to back
  // when the API has been idle.
  // The overview must survive an unreachable API. It used to throw straight
  // into error.tsx, so the first thing an operator saw when the backend was
  // down was a blank apology with no cause and nowhere to go — while the one
  // screen that could explain it sat one click away, unmentioned.
  const [content, inbox, crm, publish, media, mail, notifications, analytics] =
    await Promise.all([
      readSiteContent().catch(() => null),
      readMessages().catch(() => ({ items: [], total: 0, unread: 0 })),
      getLeadSummary(),
      getPublishStatus(),
      getMedia(),
      getMailLogs(),
      getNotifications(true),
      getAnalytics(),
    ]);

  if (!content) return <ApiUnreachable />;

  // The campaign that produced the most enquiries, not the most visits: the
  // whole point of the report is that traffic and results are different things.
  const topCampaign =
    analytics?.campaigns.filter((row) => row.leads > 0).sort((a, b) => b.leads - a.leads)[0] ??
    null;

  const { items: messages, unread } = inbox;

  // Only the last day: a failure from last month is history, not something to
  // act on this morning.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const mailToday = mail.items.filter((entry) => new Date(entry.createdAt).getTime() > dayAgo);
  const mailFailedToday = mailToday.filter((entry) => entry.status === 'FAILED').length;

  const lastPublish = publish?.lastPublish ?? null;

  // The pipeline, summarised. Unassigned leads come first because they are the
  // only line here that is somebody's job rather than a fact.
  const crmTiles = [
    { label: 'Atanmamış', value: crm.unassigned, icon: UserX, alert: crm.unassigned > 0 },
    { label: 'Açık talep', value: crm.open, icon: KanbanSquare, alert: false },
    { label: 'Bu hafta', value: crm.thisWeek, icon: CalendarDays, alert: false },
    { label: 'Kazanıldı', value: crm.won, icon: Trophy, alert: false },
  ];

  // What wants attention today, rather than what the site is made of. The
  // overview used to count services and references — true, and never once the
  // reason somebody opened the panel.
  const stats = [
    {
      label: 'Okunmamış talep',
      value: unread,
      icon: Inbox,
      highlight: unread > 0,
    },
    {
      label: 'Okunmamış bildirim',
      value: notifications.length,
      icon: Bell,
      highlight: notifications.length > 0,
    },
    {
      label: 'Bekleyen yayın',
      value: publish?.pendingChanges ? 'Var' : 'Yok',
      icon: CloudUpload,
      highlight: publish?.pendingChanges === true,
    },
    {
      label: 'Başarısız mail (24s)',
      value: mailFailedToday,
      icon: MailWarning,
      highlight: mailFailedToday > 0,
    },
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

      {/* CRM */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-fg">Talep Yönetimi</h2>
          <Link href={adminPath('/crm')} className="text-sm text-brand-dyn hover:opacity-80">
            Pipeline
          </Link>
        </div>
        <Link
          href={adminPath('/crm')}
          className="panel grid grid-cols-2 gap-4 p-5 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.03] sm:grid-cols-4"
        >
          {crmTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label}>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    tile.alert ? 'bg-amber-500/15 text-amber-500' : 'bg-overlay/5 text-brand-dyn'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="mt-3 font-heading text-2xl font-bold text-fg">{tile.value}</div>
                <div className="mt-0.5 text-xs text-muted">{tile.label}</div>
              </div>
            );
          })}
        </Link>
      </div>

      {/* Operations */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <SystemSummary />

        {/* Last publish */}
        <Link
          href={adminPath('/publish')}
          className="panel group flex items-center gap-4 p-5 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.03]"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              lastPublish?.state === 'FAILED'
                ? 'bg-red-500/15 text-red-500'
                : lastPublish?.state === 'PENDING'
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'bg-overlay/5 text-brand-dyn'
            }`}
          >
            <CloudUpload className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Son Yayın</span>
            <span className="block truncate text-xs text-muted">
              {!lastPublish
                ? 'Henüz yayın yapılmadı'
                : lastPublish.state === 'FAILED'
                  ? `Başarısız — ${lastPublish.detail}`
                  : lastPublish.state === 'PENDING'
                    ? 'Derleme sürüyor...'
                    : `Sürüm ${lastPublish.version ?? '—'} · ${formatWhen(lastPublish.at)}${
                        lastPublish.actor ? ` · ${lastPublish.actor}` : ''
                      }`}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg" />
        </Link>

        {/* Storage */}
        <Link
          href={adminPath('/media')}
          className="panel group flex items-center gap-4 p-5 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.03]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-overlay/5 text-brand-dyn">
            <HardDrive className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Medya</span>
            <span className="block truncate text-xs text-muted">
              {media.total} dosya · {formatBytes(media.usedBytes)}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg" />
        </Link>

        {/* Traffic */}
        <Link
          href={adminPath('/analytics')}
          className="panel group flex items-center gap-4 p-5 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.03]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-overlay/5 text-brand-dyn">
            <BarChart3 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Ziyaretçi</span>
            <span className="block truncate text-xs text-muted">
              {!analytics
                ? 'Ziyaretçi verisi okunamadı'
                : analytics.views.month === 0
                  ? 'Son 30 günde ziyaret kaydı yok'
                  : `Bugün ${analytics.visitors.today} · son 30 gün ${analytics.visitors.month} ziyaretçi`}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg" />
        </Link>
      </div>

      {/* Visits in, enquiries out, work won. The three numbers that say whether
          the site is doing its job — on the first screen rather than three
          clicks into a report nobody opens. */}
      {analytics && analytics.views.month > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Figure
            label="Ziyaretçi"
            value={analytics.visitors.month}
            hint="Son 30 gün"
          />
          <Figure
            label="Gelen talep"
            value={analytics.crm.leads}
            hint={
              analytics.crm.leadRate === null
                ? 'Son 30 gün'
                : `Ziyaretçilerin %${analytics.crm.leadRate}'i`
            }
          />
          <Figure
            label="Kazanılan"
            value={analytics.crm.won}
            hint={
              analytics.crm.winRate === null
                ? 'Henüz sonuçlanan yok'
                : `Kazanma oranı %${analytics.crm.winRate}`
            }
          />
          <Figure
            label="En çok getiren"
            value={topCampaign ? topCampaign.leads : 0}
            hint={
              topCampaign
                ? `${topCampaign.source}${topCampaign.campaign ? ` / ${topCampaign.campaign}` : ''}`
                : 'Kaynak verisi yok'
            }
          />
        </div>
      )}

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

/**
 * What the overview shows when the API cannot be reached.
 *
 * Not an error page: an error page says something went wrong, and the person
 * reading it already knows that. This says which part is down, what it stops
 * them doing, and where to look — because the panel is the only window they
 * have onto the system it manages.
 */
/** One number with what it means under it. */
function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="panel p-5">
      <div className="font-heading text-2xl font-bold text-fg">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[11px] text-faint" title={hint}>
        {hint}
      </div>
    </div>
  );
}

function ApiUnreachable() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
            <ServerCrash className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold text-fg">API&apos;ye ulaşılamıyor</h1>
            <p className="mt-1 text-sm text-muted">
              Panel ayakta, ancak içeriği tutan servise bağlanamıyor. Bu haldeyken içerik
              okunamaz, kaydedilemez ve yayınlanamaz — site son yayınlanan haliyle kalır.
            </p>
            <Link href={adminPath('/system')} className="btn-primary mt-5 inline-flex">
              Sistem &amp; Bağlantılar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
