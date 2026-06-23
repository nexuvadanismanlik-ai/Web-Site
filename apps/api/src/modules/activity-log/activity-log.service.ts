import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  log(params: {
    event: string;
    description: string;
    actorId?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.activityLog.create({
      data: {
        event: params.event,
        description: params.description,
        actorId: params.actorId ?? null,
        tenantId: params.tenantId ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
  }

  findByTenant(tenantId: string, limit = 50) {
    return this.prisma.activityLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  findRecent(limit = 100) {
    return this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }
}
