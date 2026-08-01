import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpRequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpRequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = request.header('x-request-id') ?? randomUUID();
    const startedAt = performance.now();

    response.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      tap({
        next: () =>
          this.log(request, response.statusCode, requestId, startedAt),
        error: (error: unknown) =>
          this.log(
            request,
            error instanceof HttpException ? error.getStatus() : 500,
            requestId,
            startedAt,
          ),
      }),
    );
  }

  private log(
    request: Request,
    statusCode: number,
    requestId: string,
    startedAt: number,
  ): void {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = `${request.method} ${request.baseUrl}${request.path} ${statusCode} ${durationMs}ms requestId=${requestId}`;

    if (statusCode >= 500) {
      this.logger.error(message);
    } else if (statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
