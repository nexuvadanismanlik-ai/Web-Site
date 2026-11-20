#!/usr/bin/env node
/**
 * Applies pending Prisma migrations as a deliberate release step.
 *
 * On Vercel the API has no start command, so migrations no longer run when
 * the server boots (they never should run per request). They run here, by a
 * person or a CI job, against one named environment at a time:
 *
 *   APP_ENV=preview CONFIRM_MIGRATION=preview DIRECT_URL=... DATABASE_URL=... \
 *     pnpm --filter @nexuva/api run migrate:release
 *
 * Guards, in order:
 *   1. DIRECT_URL must be set — pgbouncer cannot run DDL.
 *   2. CONFIRM_MIGRATION must equal APP_ENV, so the target is typed twice.
 *   3. APP_ENV=production additionally needs ALLOW_PRODUCTION_MIGRATION=yes.
 *   4. `prisma migrate status` runs first and its output is shown; a failed
 *      (half-applied) migration stops the run before anything changes.
 *
 * Production migrations need the owner's explicit approval (PRODUCTION_CHECKLIST.md).
 */
import { spawnSync } from 'node:child_process';

function fail(message) {
  process.stderr.write(`\n✖ ${message}\n\n`);
  process.exit(1);
}

const env = process.env['APP_ENV'] ?? '';
if (!process.env['DIRECT_URL'])
  fail('DIRECT_URL tanımlı değil. Migration doğrudan bağlantı (5432) ister.');
if (!env) fail('APP_ENV tanımlı değil. Hedef ortamı açıkça belirtin.');
if (process.env['CONFIRM_MIGRATION'] !== env) {
  fail(
    `CONFIRM_MIGRATION, APP_ENV ile aynı olmalı (APP_ENV=${env}). Hedefi iki kez yazarak onaylayın.`,
  );
}
if (env === 'production' && process.env['ALLOW_PRODUCTION_MIGRATION'] !== 'yes') {
  fail(
    'Production migration için ALLOW_PRODUCTION_MIGRATION=yes gerekir ve sahibinin onayı alınmış olmalıdır.',
  );
}

function prisma(args) {
  return spawnSync('pnpm', ['exec', 'prisma', ...args], { stdio: 'pipe', encoding: 'utf8' });
}

process.stdout.write(`\nHedef ortam: ${env}\n\nprisma migrate status:\n`);
const status = prisma(['migrate', 'status']);
process.stdout.write(status.stdout ?? '');
process.stderr.write(status.stderr ?? '');
const statusText = `${status.stdout ?? ''}\n${status.stderr ?? ''}`;
if (/failed to apply|P3009|have failed/i.test(statusText)) {
  fail(
    'Yarım kalmış bir migration var. Önce DATABASE_MIGRATION.md içindeki çözüm adımları uygulanmalı.',
  );
}

process.stdout.write('\nprisma migrate deploy:\n');
const deploy = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
process.exit(deploy.status ?? 1);
