// This file is kept for completeness but the project uses NestJS built-in Logger
// or WinstonModule directly as per Rule 23 and 29.
// If you need a custom logger service, it would typically wrap Winston.
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger as WinstonLogger } from 'winston';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class AppLoggerService implements NestLoggerService {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: WinstonLogger) {}

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
