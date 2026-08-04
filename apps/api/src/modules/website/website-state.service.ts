import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Facts about a tenant's website that are read far more often than written.
 *
 * `lastContentChangeAt` answers "are there edits waiting to be published?" and
 * the panel asks on every page view. Deriving it would mean an aggregate across
 * all nine content tables each time, so it is materialised by the same writes
 * that cause it.
 *
 * It lives here rather than on PublishService because it is a property of the
 * draft, not of how the draft gets published. Keeping it separate also breaks a
 * dependency cycle: content writing needs to record a change, publishing needs
 * to freeze a version, and versioning needs to read content.
 */
@Injectable()
export class WebsiteStateService {
  private readonly logger = new Logger(WebsiteStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records that the draft moved.
   *
   * Deliberately not awaited by callers: a content save must not fail because
   * the bookkeeping write did.
   */
  contentChanged(tenantId: string): void {
    const now = new Date();
    void this.prisma.websiteState
      .upsert({
        where: { tenantId },
        create: { tenantId, lastContentChangeAt: now },
        update: { lastContentChangeAt: now },
      })
      .catch((err: unknown) => {
        this.logger.error(`Could not record content change: ${String(err)}`);
      });
  }

  async lastContentChangeAt(tenantId: string): Promise<Date | null> {
    const row = await this.prisma.websiteState.findUnique({
      where: { tenantId },
      select: { lastContentChangeAt: true },
    });
    return row?.lastContentChangeAt ?? null;
  }
}
