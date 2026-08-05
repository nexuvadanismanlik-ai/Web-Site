import { Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { type AppEnvironment, databaseHost } from '../config/app.config';

const logger = new Logger('EnvironmentGuard');

/** Setting key under which a database records which environment it holds. */
const ENV_MARKER_KEY = 'platform.environment';

/**
 * Refuses to run against a database that belongs to a different environment.
 *
 * A connection string is easy to copy and impossible to tell apart at a glance,
 * so "am I about to write to production?" was answerable only by reading a URL
 * carefully every time. It was answered wrongly here: local development ran
 * against the production database, and test runs wrote real rows.
 *
 * The check does not try to recognise production from the host name, which is a
 * guess. The database says what it is: a row it carries names its environment,
 * written the first time an app connects. From then on, any process claiming to
 * be something else is refused.
 *
 * Escapable on purpose — a real operator sometimes has to run a migration
 * against production from a laptop — but only by saying so out loud, once, in
 * an environment variable that reads like what it is.
 */
export async function assertEnvironmentMatches(
  prisma: PrismaClient,
  appEnv: AppEnvironment,
  databaseUrl: string | undefined,
): Promise<void> {
  const host = databaseHost(databaseUrl);
  const override = process.env['DANGEROUSLY_ALLOW_ENV_MISMATCH'] === 'true';

  let recorded: string | null = null;
  try {
    const row = await prisma.systemSetting.findFirst({
      where: { key: ENV_MARKER_KEY },
      select: { value: true },
    });
    recorded = typeof row?.value === 'string' ? row.value : null;
  } catch (err) {
    // A database too old to have the settings table cannot be checked. Say so
    // rather than pretending the check passed.
    logger.warn(`Environment marker unreadable (${String(err)}); continuing unchecked.`);
    logger.log(`APP_ENV=${appEnv}  database=${host}`);
    return;
  }

  if (recorded === null) {
    // An unmarked database is claimed by the first process that states what it
    // is. A process that did not state anything must not claim it: APP_ENV
    // defaults to "local", and defaulting would mark the production database
    // "local" the first time production booted without the variable set.
    if (!process.env['APP_ENV']) {
      logger.warn(
        `Database at ${host} carries no environment marker and APP_ENV is not set, ` +
          'so it has been left unclaimed. Set APP_ENV to mark it.',
      );
      return;
    }

    try {
      await prisma.systemSetting.create({
        data: { key: ENV_MARKER_KEY, value: appEnv, description: 'Written by EnvironmentGuard' },
      });
      logger.log(`Database at ${host} marked as "${appEnv}".`);
    } catch {
      // A concurrent boot won the race; the next check will read its value.
      logger.warn(`Could not write the environment marker at ${host}.`);
    }
    return;
  }

  if (recorded === appEnv) {
    logger.log(`APP_ENV=${appEnv}  database=${host}`);
    return;
  }

  const message =
    `Environment mismatch: this process is APP_ENV=${appEnv}, but the database at ` +
    `${host} is marked "${recorded}". Point DATABASE_URL at a ${appEnv} database, ` +
    'or set DANGEROUSLY_ALLOW_ENV_MISMATCH=true if this is deliberate.';

  if (override) {
    logger.warn(`${message} — overridden.`);
    return;
  }

  logger.error(message);
  throw new Error(message);
}
