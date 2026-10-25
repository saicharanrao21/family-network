import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get() status() { return this.health.status(); }
  @Get('live') live() { return { status: 'alive', timestamp: new Date().toISOString() }; }
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.readiness();
    if (result.status !== 'ready') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
