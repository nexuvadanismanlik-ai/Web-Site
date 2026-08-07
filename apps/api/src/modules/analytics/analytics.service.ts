import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { dayBefore, zonedDayBounds } from './timezone';

/**
 * The mark a verification run puts on everything it creates, so its rows can
 * be found and removed afterwards without touching anybody's real traffic.
 */
export const TEST_CAMPAIGN_PREFIX = 'zz-test-';

/**
 * Traffic measurement that keeps nothing it should not.
 *
 * Built rather than bought: the alternative is a third party's script on every
 * page, which means a consent banner, visitor data leaving for somebody else's
 * servers, and a site whose loading depends on their uptime.
 *
 * No address is stored. Counting distinct visitors needs a value that is stable
 * within a day and meaningless afterwards, so the address is hashed with a salt
 * that is regenerated daily and then discarded. A visitor can be counted; no
 * visitor can be identified — and the salt disappearing at midnight means the
 * old rows cannot be re-identified even by us.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  /** Rotated daily. Held in memory only; a restart simply starts a new day. */
  private salt = randomBytes(32).toString('hex');
  private saltDay = today();

  constructor(private readonly prisma: PrismaService) {}

  private visitorHash(ip: string, userAgent: string): string {
    if (this.saltDay !== today()) {
      this.salt = randomBytes(32).toString('hex');
      this.saltDay = today();
    }
    return createHash('sha256').update(`${this.salt}:${ip}:${userAgent}`).digest('hex').slice(0, 32);
  }

  async recordView(params: {
    tenantId: string;
    path: string;
    referrer?: string;
    ip: string;
    userAgent: string;
    country?: string;
    durationSeconds?: number;
    scrollDepth?: number;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
      term?: string;
    };
  }): Promise<void> {
    await this.prisma.pageView.create({
      data: {
        tenantId: params.tenantId,
        path: normalisePath(params.path),
        referrer: params.referrer?.slice(0, 300) ?? null,
        source: params.utm?.source?.trim() || classifySource(params.referrer),
        device: classifyDevice(params.userAgent),
        browser: classifyBrowser(params.userAgent),
        country: params.country?.slice(0, 2).toUpperCase() ?? '',
        visitorHash: this.visitorHash(params.ip, params.userAgent),
        durationSeconds: params.durationSeconds ?? null,
        scrollDepth: params.scrollDepth ?? null,
        // An explicit utm_source beats what the referrer implies: an ad click
        // often arrives with no referrer at all, and the campaign is the only
        // thing that says where it came from.
        utmSource: params.utm?.source ?? null,
        utmMedium: params.utm?.medium ?? null,
        utmCampaign: params.utm?.campaign ?? null,
        utmContent: params.utm?.content ?? null,
        utmTerm: params.utm?.term ?? null,
      },
    });
  }

  async recordEvent(params: {
    tenantId: string;
    name: string;
    path: string;
    label?: string;
    ip: string;
    userAgent: string;
  }): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: {
        tenantId: params.tenantId,
        name: params.name.slice(0, 40),
        path: normalisePath(params.path),
        label: params.label?.slice(0, 120) ?? '',
        visitorHash: this.visitorHash(params.ip, params.userAgent),
      },
    });
  }

  /**
   * Everything the analytics screen shows, in one read.
   *
   * Counted in the database rather than pulled into memory: a month of traffic
   * is exactly the size that works in development and falls over in production.
   */
  async summary(
    tenantId: string,
    range?: { from?: Date; to?: Date; timeZone?: string },
  ) {
    // Days are bucketed where the reader is, not at Greenwich. See timezone.ts.
    const timeZone = range?.timeZone ?? 'UTC';
    const now = Date.now();
    const since = (days: number) => new Date(now - days * 86_400_000);
    const base = { tenantId };

    // The window everything below the tiles is measured over.
    //
    // The default is thirty *calendar* days ending today, not the instant
    // thirty times twenty-four hours ago — those differ, and the second one
    // touches thirty-one days on the chart while claiming to be thirty.
    const defaults = defaultRange(timeZone, now);
    const from = range?.from ?? defaults.from;
    const to = range?.to ?? defaults.to;
    const period = { gte: from, lte: to };
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));

    const [today_, week, month, selected, periodViews, topPages, sources, devices, events, avgDuration] =
      await Promise.all([
        // The three tiles are fixed reference points on purpose: "bugün" has to
        // mean today whatever range is being read below it.
        this.window(tenantId, since(1)),
        this.window(tenantId, since(7)),
        this.window(tenantId, since(30)),
        this.window(tenantId, from, to),
        this.prisma.pageView.count({ where: { ...base, createdAt: period } }),
        this.prisma.pageView.groupBy({
          by: ['path'],
          where: { ...base, createdAt: period },
          _count: { _all: true },
          orderBy: { _count: { path: 'desc' } },
          take: 10,
        }),
        this.prisma.pageView.groupBy({
          by: ['source'],
          where: { ...base, createdAt: period },
          _count: { _all: true },
          orderBy: { _count: { source: 'desc' } },
          take: 10,
        }),
        this.prisma.pageView.groupBy({
          by: ['device'],
          where: { ...base, createdAt: period },
          _count: { _all: true },
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['name'],
          where: { ...base, createdAt: period },
          _count: { _all: true },
        }),
        this.prisma.pageView.aggregate({
          where: { ...base, createdAt: period, durationSeconds: { not: null } },
          _avg: { durationSeconds: true },
        }),
      ]);

    const formSubmits = events.find((row) => row.name === 'form_submit')?._count._all ?? 0;
    const ctaClicks = events.find((row) => row.name === 'cta_click')?._count._all ?? 0;

    // Traffic is only half the picture. What the business wants to know is
    // whether visits turn into enquiries and enquiries turn into work — and
    // that answer lives in the CRM, which is in the same database.
    const [leads, won, lost] = await Promise.all([
      this.prisma.contactMessage.count({
        where: { tenantId, deletedAt: null, createdAt: period },
      }),
      this.prisma.contactMessage.count({
        where: { tenantId, deletedAt: null, status: 'WON', lastActionAt: period },
      }),
      this.prisma.contactMessage.count({
        where: { tenantId, deletedAt: null, status: 'LOST', lastActionAt: period },
      }),
    ]);

    const [daily, campaigns, extra] = await Promise.all([
      this.dailySeries(tenantId, from, to, timeZone),
      this.campaignReport(tenantId, from, to),
      this.breakdowns(tenantId, from, to),
    ]);

    return {
      // What the range currently reads, echoed back so the screen can label
      // its own numbers rather than assuming they are the last thirty days.
      range: { from: from.toISOString(), to: to.toISOString(), days, timeZone },
      visitors: {
        today: today_.visitors,
        week: week.visitors,
        month: month.visitors,
        selected: selected.visitors,
      },
      views: {
        today: today_.views,
        week: week.views,
        month: month.views,
        selected: periodViews,
      },
      // Conversion over visitors, not views: one person filling in the form
      // after reading four pages is one conversion, not a quarter of one.
      conversionRate:
        selected.visitors > 0
          ? Math.round((formSubmits / selected.visitors) * 1000) / 10
          : null,
      formSubmits,
      ctaClicks,
      averageSeconds: Math.round(avgDuration._avg.durationSeconds ?? 0),
      topPages: topPages.map((row) => ({ path: row.path, views: row._count._all })),
      sources: sources.map((row) => ({ source: row.source, views: row._count._all })),
      devices: devices.map((row) => ({ device: row.device, views: row._count._all })),
      daily,
      campaigns,
      browsers: extra.browsers,
      countries: extra.countries,
      landingPages: extra.landingPages,
      averageScroll: extra.averageScroll,
      crm: {
        leads,
        won,
        lost,
        // Won over decided, not over all leads: an enquiry still being worked
        // is not a loss, and counting it as one makes every healthy pipeline
        // look like a failing one.
        winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
        // What a visit is ultimately worth: visitors in, enquiries out.
        leadRate:
          selected.visitors > 0
            ? Math.round((leads / selected.visitors) * 1000) / 10
            : null,
      },
    };
  }

  /**
   * What each campaign actually produced.
   *
   * The whole point of tagging a link is to answer "was that spend worth it",
   * and that question is not about visits — it is about visits, enquiries and
   * won work in the same row. Traffic and the CRM live in the same database,
   * so this is one query per side rather than an integration.
   *
   * Grouped by source and campaign together: the same campaign name run on two
   * platforms is two lines of spend and has to be two lines here.
   */
  private async campaignReport(tenantId: string, since: Date, until: Date) {
    const [visits, leads] = await Promise.all([
      this.prisma.$queryRaw<
        { source: string | null; campaign: string | null; visitors: bigint; views: bigint }[]
      >`
        SELECT COALESCE("utmSource", "source") AS source,
               "utmCampaign" AS campaign,
               count(DISTINCT "visitorHash") AS visitors,
               count(*) AS views
        FROM page_views
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${since}
          AND "createdAt" <= ${until}
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 20
      `,
      this.prisma.$queryRaw<
        { source: string | null; campaign: string | null; leads: bigint; won: bigint }[]
      >`
        SELECT COALESCE("utmSource", "source") AS source,
               "utmCampaign" AS campaign,
               count(*) AS leads,
               count(*) FILTER (WHERE "status" = 'WON') AS won
        FROM contact_messages
        WHERE "tenantId" = ${tenantId}
          AND "deletedAt" IS NULL
          AND "createdAt" >= ${since}
          AND "createdAt" <= ${until}
        GROUP BY 1, 2
      `,
    ]);

    // JSON rather than a joined string: a campaign name is whatever the
    // advertiser typed, and any separator character you pick is one they are
    // allowed to have used — at which point two campaigns silently merge.
    const key = (source: string | null, campaign: string | null) =>
      JSON.stringify([source ?? 'direct', campaign ?? '']);

    const rows = new Map<
      string,
      { source: string; campaign: string; visitors: number; views: number; leads: number; won: number }
    >();

    for (const row of visits) {
      rows.set(key(row.source, row.campaign), {
        source: row.source ?? 'direct',
        campaign: row.campaign ?? '',
        visitors: Number(row.visitors),
        views: Number(row.views),
        leads: 0,
        won: 0,
      });
    }

    // Enquiries whose campaign produced no recorded visit still belong here —
    // the visit may predate measurement, and dropping the row would hide the
    // very conversions the report exists to show.
    for (const row of leads) {
      const id = key(row.source, row.campaign);
      const existing = rows.get(id) ?? {
        source: row.source ?? 'direct',
        campaign: row.campaign ?? '',
        visitors: 0,
        views: 0,
        leads: 0,
        won: 0,
      };
      existing.leads = Number(row.leads);
      existing.won = Number(row.won);
      rows.set(id, existing);
    }

    return [...rows.values()]
      .map((row) => ({
        ...row,
        conversionRate:
          row.visitors > 0 ? Math.round((row.leads / row.visitors) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.leads - a.leads || b.visitors - a.visitors);
  }

  /**
   * Removes the page views a verification run created.
   *
   * Scoped to campaign names beginning `zz-test-`, which is the marker the
   * verification scripts stamp on everything they make. Deliberately narrow:
   * an endpoint that can delete arbitrary measurement is a foot-gun, and the
   * only thing anybody legitimately needs to delete is the noise a test made.
   * Real traffic has no campaign name a person would type as `zz-test-`.
   */
  async purgeTestViews(tenantId: string, campaign: string): Promise<number> {
    if (!campaign.startsWith(TEST_CAMPAIGN_PREFIX)) {
      throw new BadRequestException(
        `Yalnızca "${TEST_CAMPAIGN_PREFIX}" ile başlayan test kampanyaları silinebilir.`,
      );
    }

    const result = await this.prisma.pageView.deleteMany({
      where: { tenantId, utmCampaign: campaign },
    });
    return result.count;
  }

  /**
   * Views and visitors per day, for the chart.
   *
   * Grouped in the database and then filled in here: a day with no traffic
   * produces no row, and a chart that silently skips those days draws a
   * flattering line through the gaps.
   */
  private async dailySeries(tenantId: string, from: Date, to: Date, timeZone: string) {
    // Grouped in the reader's own timezone. Truncating in UTC put the last
    // hours of every evening — often the busiest — on the next day's bar for
    // anybody east of Greenwich, and nothing about the chart said so.
    const rows = await this.prisma.$queryRaw<
      { day: Date; views: bigint; visitors: bigint }[]
    >`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE ${timeZone}) AS day,
             count(*) AS views,
             count(DISTINCT "visitorHash") AS visitors
      FROM page_views
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `;

    const byDay = new Map(
      rows.map((row) => [
        row.day.toISOString().slice(0, 10),
        { views: Number(row.views), visitors: Number(row.visitors) },
      ]),
    );

    // Filled day by day across the same calendar the rows were grouped by.
    //
    // This walked UTC midnights while the query grouped by local days, so for
    // anybody east of Greenwich a one-day range drew two bars — yesterday's,
    // empty, and today's — and a thirty-day range drew thirty-one. The gap was
    // in the labels, not the data: both were right about different calendars.
    const label = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const series: { date: string; views: number; visitors: number }[] = [];
    // Plain calendar arithmetic on the local date strings. No conversion is
    // involved once the ends are named, so daylight saving cannot shift a step.
    const cursor = new Date(`${label.format(from)}T00:00:00Z`);
    const last = new Date(`${label.format(to)}T00:00:00Z`);

    // A guard, not a policy: a year of daily bars is unreadable long before
    // it is slow, and an unbounded loop here is a request that never returns.
    for (let guard = 0; cursor <= last && guard < 400; guard++) {
      const date = cursor.toISOString().slice(0, 10);
      const found = byDay.get(date);
      series.push({ date, views: found?.views ?? 0, visitors: found?.visitors ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return series;
  }

  /**
   * The dimensions the screen never showed.
   *
   * Browser and country have been collected since the tracker was written and
   * reported nowhere, which is the worst of both: the data was gathered and
   * nobody could see it. Landing pages are derived rather than stored — the
   * first page each visit touched, which is the one an advert paid for.
   */
  private async breakdowns(tenantId: string, from: Date, to: Date) {
    const period = { gte: from, lte: to };

    const [browsers, countries, landings, engagement] = await Promise.all([
      this.prisma.pageView.groupBy({
        by: ['browser'],
        where: { tenantId, createdAt: period },
        _count: { _all: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 8,
      }),
      this.prisma.pageView.groupBy({
        by: ['country'],
        where: { tenantId, createdAt: period },
        _count: { _all: true },
        orderBy: { _count: { country: 'desc' } },
        take: 8,
      }),
      // The earliest view of each visitor in the window. DISTINCT ON is the
      // one place raw SQL is genuinely shorter than the query builder.
      this.prisma.$queryRaw<{ path: string; visits: bigint }[]>`
        SELECT path, count(*) AS visits
        FROM (
          SELECT DISTINCT ON ("visitorHash") "visitorHash", path
          FROM page_views
          WHERE "tenantId" = ${tenantId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
          ORDER BY "visitorHash", "createdAt" ASC
        ) AS first_pages
        GROUP BY path
        ORDER BY visits DESC
        LIMIT 10
      `,
      this.prisma.pageView.aggregate({
        where: { tenantId, createdAt: period, scrollDepth: { not: null } },
        _avg: { scrollDepth: true },
      }),
    ]);

    return {
      // Empty strings mean the tracker could not tell. Reported as "bilinmiyor"
      // rather than dropped, so the percentages still add up to what was seen.
      browsers: browsers
        .filter((row) => row._count._all > 0)
        .map((row) => ({ browser: row.browser || 'bilinmiyor', views: row._count._all })),
      countries: countries
        .filter((row) => row._count._all > 0)
        .map((row) => ({ country: row.country || 'bilinmiyor', views: row._count._all })),
      landingPages: landings.map((row) => ({ path: row.path, visits: Number(row.visits) })),
      averageScroll: Math.round(engagement._avg.scrollDepth ?? 0),
    };
  }

  /** Views and distinct visitors since a moment. */
  private async window(tenantId: string, since: Date, until?: Date) {
    const createdAt = until ? { gte: since, lte: until } : { gte: since };
    const [views, distinct] = await Promise.all([
      this.prisma.pageView.count({ where: { tenantId, createdAt } }),
      this.prisma.pageView.findMany({
        where: { tenantId, createdAt },
        distinct: ['visitorHash'],
        select: { visitorHash: true },
      }),
    ]);
    return { views, visitors: distinct.length };
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Query strings and trailing slashes would split one page into many rows. */
function normalisePath(raw: string): string {
  const path = raw.split('?')[0] ?? '/';
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return (trimmed || '/').slice(0, 200);
}

/**
 * Where a visit came from, as a name somebody can read.
 *
 * A referrer URL is not an answer to "where do my visitors come from" — the
 * answer is "Google", "Instagram", "direct", and that is what this returns.
 */
export function classifySource(referrer?: string): string {
  if (!referrer) return 'direct';
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'direct';
  }

  const known: [RegExp, string][] = [
    [/google\./, 'google'],
    [/bing\./, 'bing'],
    [/yandex\./, 'yandex'],
    [/duckduckgo\./, 'duckduckgo'],
    [/instagram\./, 'instagram'],
    [/facebook\.|fb\./, 'facebook'],
    [/linkedin\./, 'linkedin'],
    [/t\.co$|twitter\.|x\.com$/, 'twitter'],
    [/youtube\./, 'youtube'],
    [/tiktok\./, 'tiktok'],
  ];
  for (const [pattern, name] of known) if (pattern.test(host)) return name;
  return host.slice(0, 60);
}

export function classifyDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone/.test(ua)) return 'mobile';
  return 'desktop';
}

export function classifyBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  // Order matters: Edge and Opera both claim to be Chrome, and Chrome claims
  // to be Safari.
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  return 'Diğer';
}

/**
 * The last thirty calendar days in the reader's own timezone.
 *
 * Used when nobody asked for a range. Counted in days rather than in hours,
 * because "son 30 gün" means thirty rows on a chart, and `now - 30 × 24h`
 * starts partway through a thirty-first.
 */
function defaultRange(timeZone: string, now: number): { from: Date; to: Date } {
  const today = dayBefore(0, timeZone, new Date(now));
  const start = dayBefore(29, timeZone, new Date(now));

  const first = zonedDayBounds(start, timeZone);
  const last = zonedDayBounds(today, timeZone);

  // Both are well-formed dates from the formatter, so the fallback is only
  // here because the types allow null — it cannot be reached in practice.
  return {
    from: first?.from ?? new Date(now - 30 * 86_400_000),
    to: last?.to ?? new Date(now),
  };
}
