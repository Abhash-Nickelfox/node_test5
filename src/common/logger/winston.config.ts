import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';

export const winstonConfig = (configService: ConfigService): WinstonModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const logLevel = configService.get<string>('LOG_LEVEL') || 'info';
  const logDir = configService.get<string>('LOG_DIR') || './logs';

  const transports: winston.transport[] = [];

  if (nodeEnv === 'development') {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, context, trace }) => {
            return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
          }),
        ),
      }),
    );
  } else {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new winston.transports.DailyRotateFile({
        filename: 'error-%DATE%.log',
        dirname: logDir,
        level: 'error',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new winston.transports.DailyRotateFile({
        filename: 'combined-%DATE%.log',
        dirname: logDir,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );
  }

  return {
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    transports: transports,
  };
};
