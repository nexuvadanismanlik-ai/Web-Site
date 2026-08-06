import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError, ApiErrorCode } from '@nexuva/types';

/**
 * Status codes carry the meaning a client needs, but reading them as numbers
 * scattered through client code is how "if (status === 403)" ends up meaning
 * three different things. Each one gets a name.
 */
const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, string[]> | undefined;
    let errorCode: ApiErrorCode | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        message = (r['message'] as string) ?? message;
        if (Array.isArray(r['message'])) {
          message = 'Validation failed';
          errors = { validation: r['message'] as string[] };
          errorCode = 'VALIDATION_FAILED';
        }
        // An exception may name its own code when the status alone is too
        // coarse to tell two failures apart.
        if (typeof r['errorCode'] === 'string') {
          errorCode = r['errorCode'] as ApiErrorCode;
        }
      }
    } else if (exception instanceof Error) {
      // Fastify plugins throw plain Errors carrying their own status — the rate
      // limiter is one. Flattening those to 500 told a throttled caller the
      // server had broken, which is both wrong and unactionable.
      const status = (exception as Error & { statusCode?: unknown }).statusCode;
      if (typeof status === 'number' && status >= 400 && status < 600) {
        statusCode = status;
        message = exception.message;
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    }

    const body: ApiError = {
      success: false,
      statusCode,
      errorCode: errorCode ?? CODE_BY_STATUS[statusCode] ?? 'INTERNAL_ERROR',
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request?.url ?? '',
    };

    this.send(reply, statusCode, body);
  }

  /**
   * Answers with whatever object Nest handed us.
   *
   * An exception raised inside middleware reaches this filter before Fastify's
   * reply decorators are attached, so `reply` is Node's own ServerResponse and
   * `reply.status` does not exist. Calling it threw a TypeError out of the
   * filter itself — an unhandled error with no handler left above it, which
   * killed the process.
   *
   * That is how a database blip became a crash loop: every request went through
   * a middleware that queried the database, the query failed, the filter threw
   * while reporting it, the process died, the platform restarted it, and the
   * next request did the same. From outside it looked like an API that simply
   * would not come up.
   *
   * So: use the Fastify reply when it is one, fall back to the raw response
   * when it is not, and let nothing in here throw.
   */
  private send(reply: unknown, statusCode: number, body: ApiError): void {
    try {
      const fastify = reply as Partial<FastifyReply>;
      if (typeof fastify?.status === 'function' && typeof fastify.send === 'function') {
        void fastify.status(statusCode).send(body);
        return;
      }

      const raw = reply as {
        writeHead?: (status: number, headers: Record<string, string>) => unknown;
        end?: (chunk: string) => unknown;
        headersSent?: boolean;
      };
      if (raw?.headersSent) return;
      if (typeof raw?.writeHead === 'function' && typeof raw.end === 'function') {
        raw.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
        raw.end(JSON.stringify(body));
        return;
      }

      this.logger.error(`Hata yanıtı gönderilemedi: tanınmayan yanıt nesnesi (${statusCode}).`);
    } catch (err) {
      // The last line of defence. A filter that throws takes the process with
      // it, so this one swallows and records instead.
      this.logger.error(`Hata yanıtı gönderilirken hata: ${String(err)}`);
    }
  }
}
