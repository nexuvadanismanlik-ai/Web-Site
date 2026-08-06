#!/usr/bin/env node
/**
 * Production entry point.
 *
 * The start command used to be:
 *
 *     prisma migrate deploy && node dist/apps/api/src/main
 *
 * which means any problem with migrations — a missing DIRECT_URL, a database
 * that is slow to answer, a migration that cannot apply — stops the server from
 * ever starting. Nothing binds the port, the platform reports 502, and the only
 * clue is in a build log. An API that is up with a schema one migration behind
 * is a bad day; an API that is not up at all is an outage, and the two failures
 * were being treated as the same thing.
 *
 * So migrations run first and are allowed to fail loudly. The server starts
 * either way, and the outcome is passed to the process so /health/connections
 * can report it — which is where somebody will actually look.
 */
import { spawnSync } from 'node:child_process';

const MIGRATION_STATUS_ENV = 'NEXUVA_MIGRATION_STATUS';
const MIGRATION_DETAIL_ENV = 'NEXUVA_MIGRATION_DETAIL';

/** Long enough for a real migration, short enough not to outlive a deploy. */
const MIGRATION_TIMEOUT_MS = 120_000;

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

// Printed before anything can go wrong, so a deploy log always shows whether
// this script ran at all. The previous failure produced no output whatsoever
// between "Deploying..." and the port-scan timeout, which left no way to tell a
// process that crashed from one that was never started.
line('');
line(`Nexuva API başlatılıyor — node ${process.version}`);
line(`  NODE_ENV=${process.env['NODE_ENV'] ?? '(tanımsız)'}`);
line(`  APP_ENV=${process.env['APP_ENV'] ?? '(tanımsız)'}`);
line(`  PORT=${process.env['PORT'] ?? '(tanımsız — 4000 kullanılacak)'}`);
line(`  DATABASE_URL=${process.env['DATABASE_URL'] ? 'tanımlı' : 'TANIMSIZ'}`);
line(`  DIRECT_URL=${process.env['DIRECT_URL'] ? 'tanımlı' : 'TANIMSIZ'}`);
line('');

function runMigrations() {
  if (process.env['SKIP_MIGRATIONS'] === 'true') {
    return { status: 'skipped', detail: 'SKIP_MIGRATIONS=true' };
  }

  // Named here rather than left to Prisma's error, which reports a missing
  // variable without saying which command needed it or why.
  if (!process.env['DIRECT_URL']) {
    return {
      status: 'failed',
      detail:
        'DIRECT_URL tanımlı değil. Şema migration için doğrudan bağlantı istiyor ' +
        '(pgbouncer üzerinden DDL çalışmaz), bu yüzden migration atlandı.',
    };
  }

  line(`→ prisma migrate deploy (en fazla ${MIGRATION_TIMEOUT_MS / 1000} sn)`);
  const result = spawnSync('prisma', ['migrate', 'deploy'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
    // Prisma takes an advisory lock before applying anything. A previous
    // process that died holding it leaves the next run waiting forever — and
    // with the old `migrate && node main` start command that meant the server
    // never started, the port was never bound, and the platform reported
    // nothing but a port-scan timeout with no output to explain it.
    timeout: MIGRATION_TIMEOUT_MS,
  });

  if (result.status === 0) return { status: 'ok', detail: 'Migration’lar güncel.' };

  if (result.error && result.error.code === 'ETIMEDOUT') {
    return {
      status: 'failed',
      detail:
        `prisma migrate deploy ${MIGRATION_TIMEOUT_MS / 1000} saniyede bitmedi ve ` +
        'durduruldu. Büyük ihtimalle advisory lock bekliyordu.',
    };
  }

  if (result.error) {
    return {
      status: 'failed',
      detail: `prisma migrate deploy çalıştırılamadı: ${result.error.message}`,
    };
  }

  return {
    status: 'failed',
    detail:
      `prisma migrate deploy ${result.status} koduyla döndü. Sunucu yine de ` +
      'başlatıldı; şema bir sürüm geride olabilir.',
  };
}

const outcome = runMigrations();

if (outcome.status === 'failed') {
  line('');
  line('════════════════════════════════════════════════════════════════');
  line('  MIGRATION BAŞARISIZ — SUNUCU YİNE DE BAŞLATILIYOR');
  line(`  ${outcome.detail}`);
  line('  Panelde: Sistem & Bağlantılar');
  line('════════════════════════════════════════════════════════════════');
  line('');
} else if (outcome.status === 'skipped') {
  line(`→ migration atlandı (${outcome.detail})`);
}

process.env[MIGRATION_STATUS_ENV] = outcome.status;
process.env[MIGRATION_DETAIL_ENV] = outcome.detail;

line('→ sunucu başlatılıyor');

// Imported rather than spawned so there is one process: signals, exit codes and
// the platform's idea of "is it running" all stay attached to the server.
await import('../dist/apps/api/src/main.js');
