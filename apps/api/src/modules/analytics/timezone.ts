/**
 * Day boundaries in the business's own timezone.
 *
 * Reports are read by a person sitting in one place, and that place decides
 * when a day starts. The analytics screen was bucketing by UTC, so for a
 * company in UTC+3 "Bugün" began at three in the morning and the last three
 * hours of every evening — often the busiest — landed on tomorrow's row.
 *
 * Done with Intl rather than a date library: the platform already knows every
 * zone's rules including daylight saving, and this is a hundred lines less
 * dependency for an answer that has to be right twice a year.
 */

/**
 * How far the zone is from UTC at a given instant, in milliseconds.
 *
 * Derived by asking Intl what the wall-clock reads there and comparing it with
 * the instant. Positive east of Greenwich.
 */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const read = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');

  // `hour` comes back as 24 at midnight under hour12:false in some runtimes.
  const hour = read('hour') % 24;

  // Milliseconds are carried through from the instant. Intl does not report
  // them and no timezone shifts them, but dropping them makes the offset 999ms
  // short for any instant with a fractional second — which is precisely what
  // the end of a day is, and it moved the boundary a second into the next day.
  const wallClockAsUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
    at.getUTCMilliseconds(),
  );

  return wallClockAsUtc - at.getTime();
}

/**
 * The instant a `YYYY-MM-DD` begins and ends in the given zone.
 *
 * The end is the last millisecond of the day, not its midnight: somebody
 * picking today as the last day of a range means everything up to now, and a
 * naive `<= midnight` silently excludes the entire day they asked for.
 *
 * Each end is resolved in two passes. A single offset taken at midday is wrong
 * on the two days a year that daylight saving moves: on a spring-forward day
 * midday is already on summer time while midnight was still on winter time, so
 * the range starts an hour early and swallows the last hour of the previous
 * day. The first pass gets close enough to land inside the right side of the
 * change; the second measures the offset there and uses it.
 */
export function zonedDayBounds(day: string, timeZone: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const startUtc = new Date(`${day}T00:00:00.000Z`);
  const endUtc = new Date(`${day}T23:59:59.999Z`);
  if (Number.isNaN(startUtc.getTime())) return null;

  return { from: resolve(startUtc, timeZone), to: resolve(endUtc, timeZone) };
}

/**
 * The instant whose wall clock in `timeZone` reads the same as `wanted` reads
 * in UTC.
 *
 * Two passes, for the reason above. A third would not help: after the second
 * the guess is on the correct side of any transition, and the remaining
 * ambiguity is the hour that genuinely happens twice in autumn, where either
 * answer is defensible and the earlier one is the conventional choice.
 */
function resolve(wanted: Date, timeZone: string): Date {
  let guess = new Date(wanted.getTime() - zoneOffsetMs(wanted, timeZone));
  guess = new Date(wanted.getTime() - zoneOffsetMs(guess, timeZone));
  return guess;
}

/** Today's date in the given zone, as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The date `offset` days before today, in the given zone, as `YYYY-MM-DD`. */
export function dayBefore(offset: number, timeZone: string, now = new Date()): string {
  return todayIn(timeZone, new Date(now.getTime() - offset * 86_400_000));
}
