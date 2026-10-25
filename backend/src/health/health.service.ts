import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  status() {
    return { status: 'ok', service: 'family-network-api', version: process.env.APP_VERSION || '1.0.0', timestamp: new Date().toISOString() };
  }

  async readiness() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', dependencies: { database: 'ok' }, latencyMs: Date.now() - started, timestamp: new Date().toISOString() };
    } catch {
      return { status: 'not_ready', dependencies: { database: 'unavailable' }, latencyMs: Date.now() - started, timestamp: new Date().toISOString() };
    }
  }
}
