import { BarChart3, MousePointerClick, Send, Timer, Users } from 'lucide-react';
import { getAnalytics } from '../../actions';
import { Panel } from '../../../components/fields';

export const dynamic = 'force-dynamic';

/** Turkish names for the traffic sources the API recognises. */
const SOURCE_LABELS: Record<string, string> = {
  direct: 'Doğrudan',
  google: 'Google',
  bing: 'Bing',
  yandex: 'Yandex',
  duckduckgo: 'DuckDuckGo',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Masaüstü',
  mobile: 'Telefon',
  tablet: 'Tablet',
};

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-2xl font-bold text-fg">Ziyaretçiler</h1>
        <Panel className="mt-6 p-8">
          <p className="text-center text-sm text-faint">
            Ziyaretçi verisi okunamadı. API&apos;ye ulaşılamıyor olabilir.
          </p>
        </Panel>
      </div>
    );
  }

  const empty = data.views.month === 0;

  const tiles = [
    { label: 'Bugün', value: data.visitors.today, hint: `${data.views.today} sayfa görüntüleme`, icon: Users },
    { label: 'Bu hafta', value: data.visitors.week, hint: `${data.views.week} görüntüleme`, icon: Users },
    { label: 'Bu ay', value: data.visitors.month, hint: `${data.views.month} görüntüleme`, icon: Users },
    {
      label: 'Dönüşüm',
      value: data.conversionRate === null ? '—' : `%${data.conversionRate}`,
      hint: `${data.formSubmits} form dolduruldu`,
      icon: Send,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-fg">Ziyaretçiler</h1>
        <p className="mt-0.5 text-sm text-muted">
          Son 30 gün. Kendi ölçümümüz — çerez yok, IP saklanmıyor, veri üçüncü bir tarafa
          gitmiyor.
        </p>
      </div>

      {empty && (
        <p className="mb-6 rounded-xl border border-overlay/15 bg-overlay/[0.03] px-4 py-3 text-sm text-muted">
          Henüz ziyaretçi kaydı yok. Ölçüm, sitenin bir sonraki yayınından itibaren
          başlar — yayınla, sonra siteyi bir kez ziyaret et.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="panel p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-overlay/5 text-brand-dyn">
                <Icon className="h-4 w-4" />
              </span>
              <div className="mt-3 font-heading text-2xl font-bold text-fg">{tile.value}</div>
              <div className="mt-0.5 text-xs font-medium text-muted">{tile.label}</div>
              <div className="mt-0.5 text-[11px] text-faint">{tile.hint}</div>
            </div>
          );
        })}
      </div>

      {/* Daily traffic. Bars rather than a line: with a handful of days a line
          implies a trend that is not there yet. */}
      <div className="panel mt-6 p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-fg">Günlük Ziyaretçi</h2>
        <DailyChart series={data.daily} />
      </div>

      {/* Where traffic meets the business. */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Gelen talep" value={data.crm.leads} hint="Son 30 gün" />
        <Tile label="Kazanıldı" value={data.crm.won} hint="Son 30 günde sonuçlanan" />
        <Tile label="Kaybedildi" value={data.crm.lost} hint="Son 30 günde sonuçlanan" />
        <Tile
          label="Kazanma oranı"
          value={data.crm.winRate === null ? '—' : `%${data.crm.winRate}`}
          hint={data.crm.winRate === null ? 'Henüz sonuçlanan yok' : 'Kazanılan / sonuçlanan'}
        />
      </div>

      {/* The report a spend decision is made from. */}
      <div className="panel mt-6 overflow-hidden">
        <div className="border-b border-overlay/10 px-5 py-4">
          <h2 className="font-heading text-sm font-semibold text-fg">Kampanyalar</h2>
          <p className="mt-0.5 text-xs text-faint">
            Reklam bağlantılarına <code className="font-mono">?utm_source=google&amp;utm_campaign=…</code>{' '}
            eklediğinde her kampanyanın kaç ziyaretçi ve kaç talep getirdiği burada ayrışır.
          </p>
        </div>

        {data.campaigns.length === 0 ? (
          <p className="p-6 text-center text-sm text-faint">Henüz kaynak verisi yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-overlay/10 text-left text-xs text-faint">
                  <th className="px-5 py-2 font-medium">Kaynak</th>
                  <th className="px-3 py-2 font-medium">Kampanya</th>
                  <th className="px-3 py-2 text-right font-medium">Ziyaretçi</th>
                  <th className="px-3 py-2 text-right font-medium">Talep</th>
                  <th className="px-3 py-2 text-right font-medium">Kazanılan</th>
                  <th className="px-5 py-2 text-right font-medium">Dönüşüm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-overlay/5">
                {data.campaigns.map((row) => (
                  <tr key={`${row.source}-${row.campaign}`}>
                    <td className="px-5 py-2.5 text-fg">
                      {SOURCE_LABELS[row.source] ?? row.source}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{row.campaign || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-muted">{row.visitors}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-fg">{row.leads}</td>
                    <td className="px-3 py-2.5 text-right text-muted">{row.won}</td>
                    <td className="px-5 py-2.5 text-right text-muted">
                      {row.conversionRate === null ? '—' : `%${row.conversionRate}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Bars
          title="En çok ziyaret edilen sayfalar"
          icon={<BarChart3 className="h-4 w-4" />}
          rows={data.topPages.map((row) => ({ label: row.path, value: row.views }))}
        />
        <Bars
          title="Trafik kaynakları"
          icon={<MousePointerClick className="h-4 w-4" />}
          rows={data.sources.map((row) => ({
            label: SOURCE_LABELS[row.source] ?? row.source,
            value: row.views,
          }))}
        />
        <Bars
          title="Cihaz"
          icon={<Users className="h-4 w-4" />}
          rows={data.devices.map((row) => ({
            label: DEVICE_LABELS[row.device] ?? row.device,
            value: row.views,
          }))}
        />
        <Panel title="Etkileşim">
          <dl className="space-y-3 text-sm">
            <Row icon={<Timer className="h-3.5 w-3.5" />} label="Ortalama sayfa süresi">
              {data.averageSeconds > 0 ? `${data.averageSeconds} saniye` : '—'}
            </Row>
            <Row icon={<MousePointerClick className="h-3.5 w-3.5" />} label="CTA tıklaması">
              {data.ctaClicks}
            </Row>
            <Row icon={<Send className="h-3.5 w-3.5" />} label="Form gönderimi">
              {data.formSubmits}
            </Row>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

/**
 * A ranked list with a bar behind each row.
 *
 * Proportional to the largest row rather than to the total: the question is
 * "which page wins", and a share-of-total bar makes the top two look identical
 * whenever there is a long tail.
 */
function Bars({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-faint">
          {icon}
          Henüz veri yok.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-fg">{row.label}</span>
                <span className="shrink-0 text-xs text-muted">{row.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-overlay/10">
                <div
                  className="h-full rounded-full brand-gradient-bg"
                  style={{ width: `${Math.round((row.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted">
        <span className="text-faint">{icon}</span>
        {label}
      </dt>
      <dd className="font-medium text-fg">{children}</dd>
    </div>
  );
}

/**
 * Thirty days of traffic, as bars.
 *
 * Drawn with divs rather than a charting library: it is one series of thirty
 * numbers, and a library would be more JavaScript than the whole screen. Bars
 * rather than a line because with a handful of days a line implies a trend that
 * is not there yet.
 */
function DailyChart({ series }: { series: { date: string; views: number; visitors: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.views));
  const total = series.reduce((sum, d) => sum + d.views, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-faint">Henüz ziyaret kaydı yok.</p>;
  }

  return (
    <>
      <div className="flex h-32 items-end gap-[3px]">
        {series.map((day) => (
          <div
            key={day.date}
            className="group relative flex-1 rounded-t bg-overlay/10 transition-colors hover:bg-overlay/20"
            style={{ height: `${Math.max(2, (day.views / max) * 100)}%` }}
          >
            <div
              className="h-full w-full rounded-t brand-gradient-bg opacity-80"
              style={{ height: '100%' }}
            />
            {/* Values on hover: thirty labels along an axis would be unreadable
                and the shape is what the chart is for. */}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-overlay/15 bg-card px-2 py-1 text-[11px] text-fg shadow-lg group-hover:block">
              {new Date(day.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
              {' · '}
              {day.visitors} ziyaretçi · {day.views} görüntüleme
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-faint">
        <span>
          {new Date(series[0]?.date ?? '').toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
        <span>Bugün</span>
      </div>
    </>
  );
}

function Tile({
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
      <div className="mt-0.5 text-[11px] text-faint">{hint}</div>
    </div>
  );
}
