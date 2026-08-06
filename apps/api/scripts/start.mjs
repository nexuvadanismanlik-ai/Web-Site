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

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

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

  line('→ prisma migrate deploy');
  const result = spawnSync('prisma', ['migrate', 'deploy'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status === 0) return { status: 'ok', detail: 'Migration’lar güncel.' };

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

// Imported rather than spawned so there is one process: signals, exit codes and
// the platform's idea of "is it running" all stay attached to the server.
await import('../dist/apps/api/src/main.js');
