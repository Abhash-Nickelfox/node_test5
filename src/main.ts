import { NestFactory } from '@nestjs/core';
import { AppModule } from '@app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from '@common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { WINSTON_MODULE_NEST_PROVIDER, WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Set global prefix for API endpoints
  app.setGlobalPrefix('api/v1');

  // Use Winston for logging
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global pipes for validation and transformation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Global filters for exception handling
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors for response transformation and logging
  const winstonLogger = app.get<Logger>(WINSTON_MODULE_PROVIDER);
  app.useGlobalInterceptors(
    new ResponseTransformInterceptor(),
    new LoggingInterceptor(winstonLogger),
  );

  // Security middleware
  app.use(helmet());

  // Enable CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000',
    credentials: true,
  });

  // Cookie parser middleware
  app.use(cookieParser());

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  app.get(WINSTON_MODULE_NEST_PROVIDER).log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
