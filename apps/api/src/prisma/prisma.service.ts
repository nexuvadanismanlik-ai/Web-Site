import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Why the eager connection failed, if it did. Read by the readiness check. */
  static bootError: string | null = null;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  /**
   * Connects, and survives not being able to.
   *
   * This used to be a bare `await this.$connect()`. Nest runs module init hooks
   * inside `app.listen()`, before the port is bound — so a database that was
   * unreachable for the few seconds the process happened to start in killed the
   * entire bootstrap. The process exited, nothing ever listened, and the
   * platform served 502 to every request until somebody noticed and redeployed.
   * A momentary blip became an indefinite outage.
   *
   * Reproduced exactly: point DATABASE_URL at a closed port and the API does
   * not start at all rather than starting without a database.
   *
   * Prisma connects lazily on the first query anyway, so the eager call buys
   * only an earlier log line. Now it stays an earlier log line: the failure is
   * recorded, the server starts, /health answers 200 because it touches no
   * database, and /health/connections says which link is actually broken.
   * Queries still fail while the database is down — but the API is reachable,
   * which is the difference between an outage you can diagnose and one you
   * cannot.
   */
  async onModuleInit() {
    try {
      await this.$connect();
      PrismaService.bootError = null;
      this.logger.log('Database connection established');
    } catch (err) {
      const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
      PrismaService.bootError = detail ?? 'Bağlanılamadı';
      this.logger.error(
        `Veritabanına açılışta bağlanılamadı: ${detail}. Sunucu yine de başlatılıyor; ` +
          'veritabanı isteyen uçlar hata verecek, /health yanıt vermeye devam edecek.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => {
      // Shutting down; a connection that was never established cannot be closed
      // and must not turn a clean stop into a crash.
    });
    this.logger.log('Database connection closed');
  }
}
