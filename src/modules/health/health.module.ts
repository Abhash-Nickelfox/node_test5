import { Module } from '@nestjs/common';
import { HealthController } from '@modules/health/health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([]), // Required for TypeOrmHealthIndicator, even if no entities are passed
    HttpModule, // Required for HttpHealthIndicator
  ],
  controllers: [HealthController],
})
export class HealthModule {}
