'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  Palette,
  Plug,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { saveSitePreferences } from '../../app/actions';
import { adminPath } from '../../lib/routes';
import type { Connection, SitePreferences } from '../../lib/model';

/**
 * Where everything the system is configured with can be found.
 *
 * Deliberately a map rather than a second set of forms. Brand, SEO, mail and
 * the tag identifiers each already have a screen that owns them, and copying
 * those fields here would give every setting two homes and two chances to
 * disagree. What was missing was not another editor — it was any single place
 * that answers "what is this site configured with, and is any of it broken?"
 *
 * So each card states the live state of one area and leads to the screen that
 * owns it. The only things edited in place are the ones that have no other home.
 */

/** How a connection's state reads to somebody who has to act on it. */
const STATE_STYLE: Record<string, { dot: string; label: string }> = {
  connected: { dot: 'bg-green-500', label: 'Çalışıyor' },
  degraded: { dot: 'bg-amber-500', label: 'Kısmen çalışıyor' },
  broken: { dot: 'bg-red-500', label: 'Sorunlu' },
  missing: { dot: 'bg-overlay/40', label: 'Ayarlanmadı' },
};

function Status({ connection }: { connection: Connection | undefined }) {
  if (!connection) return null;
  const style = STATE_STYLE[connection.state] ?? STATE_STYLE['missing'];
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style?.dot ?? ''}`} />
      <span className="text-muted">{style?.label}</span>
    </span>
  );
}

function Card({
  icon: Icon,
  title,
  description,
  href,
  connection,
  detail,
}: {
  icon: typeof Globe;
  title: string;
  description: string;
  href: string;
  connection?: Connection | undefined;
  detail?: string | undefined;
}) {
  return (
    <Link
      href={adminPath(href)}
      className="panel group flex items-start gap-4 p-5 transition-colors hover:border-overlay/25 hover:bg-overlay/[0.03]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-overlay/5 text-brand-dyn">
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-fg">{title}</span>
          <Status connection={connection} />
        </span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
        {/* The API's own words about what is wrong, not a generic label. This is
            the difference between "Sorunlu" and knowing what to fix. */}
        {(detail ?? connection?.detail) && (
          <span className="mt-1.5 block text-[11px] leading-relaxed text-faint">
            {detail ?? connection?.detail}
          </span>
        )}
      </span>

      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg" />
    </Link>
  );
}

const TIMEZONE_LABELS: Record<string, string> = {
  'Europe/Istanbul': 'İstanbul (UTC+3)',
  'Europe/London': 'Londra (UTC+0/+1)',
  'Europe/Berlin': 'Berlin (UTC+1/+2)',
  'America/New_York': 'New York (UTC−5/−4)',
  'Asia/Dubai': 'Dubai (UTC+4)',
  UTC: 'UTC',
};

export function SettingsHub({
  connections,
  preferences,
  siteUrl,
}: {
  connections: Connection[];
  preferences: (SitePreferences & { options: string[] }) | null;
  siteUrl: string;
}) {
  const byKey = (key: string) => connections.find((c) => c.key === key);

  const [timezone, setTimezone] = useState(preferences?.timezone ?? 'Europe/Istanbul');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onTimezone(value: string) {
    const previous = timezone;
    setTimezone(value);
    setSaved(false);
    setError('');
    startTransition(async () => {
      const result = await saveSitePreferences({ timezone: value });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        // Put the control back where it was: a select that keeps a value the
        // server rejected is a lie about what is configured.
        setTimezone(previous);
        setError(result.error ?? 'Kaydedilemedi.');
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* ── What the site is ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-faint">
          Site
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card
            icon={Palette}
            title="Marka & Tema"
            description="Site adı, logo, favicon, renkler, iletişim bilgileri"
            href="/brand"
          />
          <Card
            icon={Globe}
            title="Alan Adı & SSL"
            description="Sitenin adresi, DNS ve sertifika durumu"
            href="/system"
            connection={byKey('domain')}
            detail={
              byKey('ssl')
                ? `${byKey('domain')?.detail ?? ''} ${byKey('ssl')?.detail ?? ''}`.trim()
                : undefined
            }
          />
          <Card
            icon={Search}
            title="SEO"
            description="Başlık, açıklama, paylaşım görseli, robots ve sitemap"
            href="/seo"
          />
          <Card
            icon={ImageIcon}
            title="Medya"
            description="Yüklenen görseller, hangi dosyanın nerede kullanıldığı"
            href="/media"
            connection={byKey('storage')}
          />
        </div>
      </section>

      {/* ── How it reaches people ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-faint">
          Bağlantılar
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card
            icon={Mail}
            title="Mail"
            description="Sağlayıcı, gönderen adresi, bildirim alıcıları, şablonlar"
            href="/mail"
            connection={byKey('email')}
          />
          <Card
            icon={Plug}
            title="Entegrasyonlar"
            description="Google Analytics, Meta Pixel, Google Ads, Tag Manager"
            href="/integrations"
          />
          <Card
            icon={BarChart3}
            title="Ziyaretçi Ölçümü"
            description="Kendi ölçümümüz — çerezsiz, IP saklamadan"
            href="/analytics"
            connection={byKey('analytics')}
          />
          <Card
            icon={Activity}
            title="Sistem & Yayın"
            description="Veritabanı, dosya deposu, derleme ve barındırma durumu"
            href="/system"
            connection={byKey('deploy')}
          />
        </div>
      </section>

      {/* ── Edited here because nothing else owns it ──────────────────── */}
      <section className="panel p-6">
        <div className="mb-1 flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-brand-dyn" />
          <h2 className="font-heading text-base font-semibold text-fg">Zaman Dilimi</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Raporların günü nerede başlattığını belirler. Yanlış olduğunda &quot;Bugün&quot;
          gecenin ortasında başlar ve akşamın son saatleri ertesi güne düşer.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timezone}
            onChange={(event) => onTimezone(event.target.value)}
            disabled={pending}
            className="field-input max-w-xs"
          >
            {(preferences?.options ?? [timezone]).map((zone) => (
              <option key={zone} value={zone}>
                {TIMEZONE_LABELS[zone] ?? zone}
              </option>
            ))}
          </select>

          {pending && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Kaydediliyor
            </span>
          )}
          {saved && !pending && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <Check className="h-3.5 w-3.5" />
              Kaydedildi
            </span>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <p className="mt-4 text-xs text-faint">
          Şu anki yerel saat:{' '}
          <span className="font-mono text-muted">
            {new Date().toLocaleString('tr-TR', { timeZone: timezone })}
          </span>
        </p>
      </section>

      {/* The live site, so somebody can check what they just published. */}
      <p className="flex flex-wrap items-center gap-2 text-xs text-faint">
        <ShieldCheck className="h-3.5 w-3.5" />
        Yayındaki site:{' '}
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-brand-dyn hover:underline"
        >
          {siteUrl.replace(/^https?:\/\//, '')}
        </a>
      </p>
    </div>
  );
}
