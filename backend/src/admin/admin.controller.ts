import { BadRequestException, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}
  private async auth(auth?: string) { return this.admin.assertAdmin(auth); }
  @Get('overview') async overview(@Headers('authorization') auth?: string) { await this.auth(auth); return this.admin.overview(); }
  @Get('anomalies') async anomalies(@Headers('authorization') auth?: string, @Query('status') status = 'OPEN', @Query('limit') limit = '100') { await this.auth(auth); return this.admin.anomalies(status, Number(limit)); }
  @Post('anomalies/scan') async scan(@Headers('authorization') auth?: string) { await this.auth(auth); return this.admin.scanGraph(); }
  @Patch('anomalies/:id/resolve') async resolve(@Headers('authorization') auth: string, @Param('id') id: string) { const adminId = await this.auth(auth); return this.admin.resolveAnomaly(id, adminId); }
  @Get('reports') async reports(@Headers('authorization') auth?: string, @Query('status') status = 'OPEN', @Query('limit') limit = '100') { await this.auth(auth); return this.admin.reports(status, Number(limit)); }
  @Patch('reports/:id/:status') async resolveReport(@Headers('authorization') auth: string, @Param('id') id: string, @Param('status') status: string) { const adminId = await this.auth(auth); if (status !== 'RESOLVED' && status !== 'DISMISSED') throw new BadRequestException('Invalid moderation status'); return this.admin.resolveReport(id, adminId, status); }
  @Get('audit') async audit(@Headers('authorization') auth?: string, @Query('limit') limit = '200') { await this.auth(auth); return this.admin.audit(Number(limit)); }
  @Get('analytics') async analytics(@Headers('authorization') auth?: string, @Query('days') days = '30') { await this.auth(auth); return this.admin.analytics(Number(days)); }
}
