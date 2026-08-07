/**
 * Day boundaries have to be right, including twice a year when they are hard.
 *
 * This exists because the bug it guards against is invisible: bucketing traffic
 * by UTC for a UTC+3 business does not fail, it just quietly moves every
 * evening's last three hours onto the next day. Nobody notices until they
 * compare a total against something else and the numbers disagree by a little.
 *
 *   pnpm --filter @nexuva/api build
 *   node apps/api/test/timezone.test.mjs
 */
import { zonedDayBounds, todayIn, dayBefore, zoneOffsetMs } from '../dist/apps/api/src/modules/analytics/timezone.js';

let passed = 0;
let failed = 0;

function check(ok, label, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) passed++;
  else failed++;
}

console.log('\nZaman dilimi sınırları\n');

// ── Istanbul is UTC+3 all year: no daylight saving since 2016 ───────────
{
  const bounds = zonedDayBounds('2026-08-07', 'Europe/Istanbul');
  check(
    bounds?.from.toISOString() === '2026-08-06T21:00:00.000Z',
    'İstanbul günü 21:00 UTC’de başlıyor',
    String(bounds?.from.toISOString()),
  );
  check(
    bounds?.to.toISOString() === '2026-08-07T20:59:59.999Z',
    'İstanbul günü 20:59:59.999 UTC’de bitiyor',
    String(bounds?.to.toISOString()),
  );
}

// ── UTC is its own boundary ─────────────────────────────────────────────
{
  const bounds = zonedDayBounds('2026-08-07', 'UTC');
  check(
    bounds?.from.toISOString() === '2026-08-07T00:00:00.000Z',
    'UTC günü gece yarısında başlıyor',
    String(bounds?.from.toISOString()),
  );
}

// ── The end of a range must include the whole day ───────────────────────
// A naive `<= midnight` excludes every visit made that day, which looks
// exactly like no traffic — the failure this guards.
{
  const bounds = zonedDayBounds('2026-08-07', 'Europe/Istanbul');
  const lateEvening = new Date('2026-08-07T20:30:00.000Z'); // 23:30 in Istanbul
  check(
    bounds !== null && lateEvening >= bounds.from && lateEvening <= bounds.to,
    'Akşam 23:30’daki ziyaret o güne düşüyor',
  );

  const justAfter = new Date('2026-08-07T21:00:00.000Z'); // 00:00 next day
  check(
    bounds !== null && justAfter > bounds.to,
    'Gece yarısını geçen ziyaret ertesi güne düşüyor',
  );
}

// ── Daylight saving, where this is genuinely hard ───────────────────────
// Berlin moves to summer time on 2026-03-29. The day is 23 hours long and
// local midnight on the transition day still has to resolve.
{
  const before = zonedDayBounds('2026-03-28', 'Europe/Berlin');
  const during = zonedDayBounds('2026-03-29', 'Europe/Berlin');
  const after = zonedDayBounds('2026-03-30', 'Europe/Berlin');

  check(before !== null && during !== null && after !== null, 'Yaz saati günü çözümleniyor');
  check(
    before?.from.toISOString() === '2026-03-27T23:00:00.000Z',
    'Kış saati: gün 23:00 UTC’de başlıyor',
    String(before?.from.toISOString()),
  );
  check(
    after?.from.toISOString() === '2026-03-29T22:00:00.000Z',
    'Yaz saati: gün 22:00 UTC’de başlıyor',
    String(after?.from.toISOString()),
  );
  // Spring forward: the day is 23 hours long, exactly. "Under 24 hours" passed
  // while the code was a whole hour out — the offset was being read at midday,
  // by which time the clocks had already moved, so the range started an hour
  // early and swallowed the last hour of the previous day. A loose assertion
  // on a boundary is not a test of the boundary.
  const span = during ? during.to.getTime() - during.from.getTime() : 0;
  const hours = span / 3600_000;
  check(hours > 22.9 && hours < 23, `Geçiş günü tam 23 saat (${hours.toFixed(3)})`);
  check(
    during?.from.toISOString() === '2026-03-28T23:00:00.000Z',
    'Geçiş günü kış saatiyle başlıyor',
    String(during?.from.toISOString()),
  );
  check(
    during?.to.toISOString() === '2026-03-29T21:59:59.999Z',
    'Geçiş günü yaz saatiyle bitiyor',
    String(during?.to.toISOString()),
  );
}

// ── The offset itself ───────────────────────────────────────────────────
{
  check(
    zoneOffsetMs(new Date('2026-08-07T12:00:00Z'), 'Europe/Istanbul') === 3 * 3600_000,
    'İstanbul UTC+3',
  );
  check(zoneOffsetMs(new Date('2026-08-07T12:00:00Z'), 'UTC') === 0, 'UTC sıfır fark');
  check(
    zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York') === -5 * 3600_000,
    'New York kışın UTC−5',
  );
}

// ── Midnight must not read as hour 24 ───────────────────────────────────
// Some runtimes format midnight as "24" under hour12:false; unhandled, that
// puts the offset a whole day out.
{
  const offset = zoneOffsetMs(new Date('2026-08-06T21:00:00Z'), 'Europe/Istanbul');
  check(offset === 3 * 3600_000, 'Yerel gece yarısında fark doğru', `${offset / 3600_000}s`);
}

// ── Day arithmetic ──────────────────────────────────────────────────────
{
  const now = new Date('2026-08-07T00:30:00Z'); // 03:30 in Istanbul, 00:30 UTC
  check(
    todayIn('Europe/Istanbul', now) === '2026-08-07',
    'İstanbul’da bugün',
    todayIn('Europe/Istanbul', now),
  );
  // The same instant is still the 6th in New York — the point of all this.
  check(
    todayIn('America/New_York', now) === '2026-08-06',
    'Aynı an New York’ta dün',
    todayIn('America/New_York', now),
  );
  check(dayBefore(1, 'Europe/Istanbul', now) === '2026-08-06', 'Dün');
  check(dayBefore(6, 'Europe/Istanbul', now) === '2026-08-01', '7 gün önce');
}

// ── Rubbish in ──────────────────────────────────────────────────────────
{
  check(zonedDayBounds('abc', 'Europe/Istanbul') === null, 'Geçersiz tarih null döner');
  check(zonedDayBounds('2026-8-7', 'Europe/Istanbul') === null, 'Eksik sıfırlı tarih reddedilir');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} geçti, ${failed} kaldı`);
console.log(failed === 0 ? '✅ Gün sınırları doğru.\n' : '❌ Gün sınırları yanlış.\n');
process.exit(failed === 0 ? 0 : 1);
