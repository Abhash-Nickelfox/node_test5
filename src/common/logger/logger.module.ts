import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@common/logger/winston.config';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => winstonConfig(configService),
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
