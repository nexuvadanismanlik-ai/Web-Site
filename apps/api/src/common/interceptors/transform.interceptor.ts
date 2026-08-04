import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '@nexuva/types';
import { NO_ENVELOPE_KEY, RESPONSE_MESSAGE_KEY } from '../decorators/response.decorator';

/**
 * Wraps every handler's return value in the standard envelope.
 *
 * Applied once, globally, rather than by each controller. Before this the API
 * answered in whatever shape a handler happened to return — 93 routes sent raw
 * rows and arrays while 7 hand-rolled a `success` field in five mutually
 * incompatible ways, so no client could treat a response generically and each
 * new module invented its own convention.
 *
 * Handlers now return their payload and nothing else. Errors are shaped by
 * HttpExceptionFilter, which owns the failure half of the same contract.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(NO_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return next.handle();

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? '';

    return next.handle().pipe(
      map((data): ApiResponse<T> => ({ success: true, message, data })),
    );
  }
}
