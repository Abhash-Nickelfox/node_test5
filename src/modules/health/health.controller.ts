import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { Public } from '@common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    const appPort = this.configService.get<number>('PORT') || 3000;
    return this.health.check([
      () => this.http.pingCheck('nestjs-app', `http://localhost:${appPort}/api/v1/`),
    ]);
  }
}
