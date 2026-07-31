import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: 'ok'; dependencies: ['database'] }> {
    await this.healthService.assertDatabaseReady();
    return { status: 'ok', dependencies: ['database'] };
  }
}
