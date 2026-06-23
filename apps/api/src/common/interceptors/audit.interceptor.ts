import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: { id: string };
    }>();

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

    if (!isMutation) {
      return next.handle();
    }

    const actorId = request.user?.id ?? 'anonymous';
    const { method, url } = request;

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`[AUDIT] ${method} ${url} by ${actorId}`);
      }),
    );
  }
}
