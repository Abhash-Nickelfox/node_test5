import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, query } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse<Response>();
        const { statusCode } = response;
        const duration = Date.now() - now;

        this.logger.info({
          message: `HTTP Request`,
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          requestBody: body,
          requestQuery: query,
          response: data,
        });
      }, (error) => {
        const response = context.switchToHttp().getResponse<Response>();
        const statusCode = error.status || response.statusCode || 500;
        const duration = Date.now() - now;

        this.logger.error({
          message: `HTTP Error`,
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          requestBody: body,
          requestQuery: query,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });
      }),
    );
  }
}
