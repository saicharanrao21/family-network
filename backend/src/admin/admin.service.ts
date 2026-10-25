import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async assertAdmin(auth?: string): Promise<string> {
    const token = auth?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Admin authentication required');
    try {
      const payload = await this.jwt.verifyAsync<any>(token, { secret: process.env.JWT_ACCESS_SECRET || (() => { throw new UnauthorizedException('Authentication is not configured'); })() });
      const ids = (process.env.ADMIN_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
      if (!payload.sub || ids.length === 0 || !ids.includes(payload.sub)) throw new UnauthorizedException('Admin access denied');
      return payload.sub;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  async overview() {
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [users, people, relationships, parents, unions, families, activeSubscriptions, openAnomalies, openReports, dau, mau] = await Promise.all([
      this.prisma.user.count(), this.prisma.person.count(), this.prisma.relationship.count(), this.prisma.parentChildRelationship.count(),
      this.prisma.union.count(), this.prisma.familySpace.count(), this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.graphAnomaly.count({ where: { status: 'OPEN' } }), this.prisma.moderationReport.count({ where: { status: 'OPEN' } }),
      this.prisma.analyticsEvent.findMany({ where: { occurredAt: { gte: day }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
      this.prisma.analyticsEvent.findMany({ where: { occurredAt: { gte: month }, userId: { not: null } }, distinct: ['userId'], select: { userId: true } }),
    ]);
    return { users, people, relationships, parents, unions, families, activeSubscriptions, openAnomalies, openReports, dau: dau.length, mau: mau.length, generatedAt: now.toISOString() };
  }

  async anomalies(status = 'OPEN', limit = 100) {
    return this.prisma.graphAnomaly.findMany({ where: { status }, orderBy: { detectedAt: 'desc' }, take: Math.min(limit, 500), include: { person: { include: { names: true } }, relationship: true, parentChild: true, union: true } });
  }

  async resolveAnomaly(id: string, adminUserId: string) {
    return this.prisma.graphAnomaly.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedByUserId: adminUserId } });
  }

  async reports(status = 'OPEN', limit = 100) {
    return this.prisma.moderationReport.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 500) });
  }

  async resolveReport(id: string, adminUserId: string, status: 'RESOLVED' | 'DISMISSED') {
    return this.prisma.moderationReport.update({ where: { id }, data: { status, resolvedAt: new Date(), resolvedByUserId: adminUserId } });
  }

  async audit(limit = 200) {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 500) });
  }

  async analytics(days = 30) {
    const since = new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 24 * 60 * 60 * 1000);
    const events = await this.prisma.analyticsEvent.findMany({ where: { occurredAt: { gte: since } }, orderBy: { occurredAt: 'asc' }, select: { eventName: true, platform: true, occurredAt: true, userId: true } });
    const byEvent: Record<string, number> = {};
    const byDay: Record<string, Set<string>> = {};
    for (const e of events) {
      byEvent[e.eventName] = (byEvent[e.eventName] || 0) + 1;
      if (e.userId) { const key = e.occurredAt.toISOString().slice(0, 10); byDay[key] ||= new Set<string>(); byDay[key].add(e.userId); }
    }
    return { since: since.toISOString(), totalEvents: events.length, eventsByName: byEvent, activeUsersByDay: Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, v.size])) };
  }

  async scanGraph() {
    const findings: any[] = [];
    const [parentEdges, relationships, unions] = await Promise.all([
      this.prisma.parentChildRelationship.findMany({ where: { status: 'CONFIRMED' } }),
      this.prisma.relationship.findMany({ where: { status: 'CONFIRMED' } }),
      this.prisma.union.findMany(),
    ]);
    for (const e of parentEdges) if (e.parentId === e.childId) findings.push({ code: 'SELF_PARENT', severity: 'CRITICAL', parentChildId: e.id, personId: e.parentId, details: { parentId: e.parentId, childId: e.childId } });
    for (const r of relationships) if (r.personAId === r.personBId) findings.push({ code: 'SELF_RELATIONSHIP', severity: 'CRITICAL', relationshipId: r.id, personId: r.personAId, details: { type: r.type } });
    const seenRel = new Set<string>();
    for (const r of relationships) { const key = [r.personAId, r.personBId, r.type].sort().join('|'); if (seenRel.has(key)) findings.push({ code: 'DUPLICATE_RELATIONSHIP', severity: 'HIGH', relationshipId: r.id, details: { key } }); else seenRel.add(key); }
    const seenUnion = new Set<string>();
    for (const u of unions) { if (u.partnerAId === u.partnerBId) findings.push({ code: 'SELF_UNION', severity: 'CRITICAL', unionId: u.id, personId: u.partnerAId }); const key = [u.partnerAId, u.partnerBId, u.type, u.startDate?.toISOString().slice(0,10) || ''].sort().join('|'); if (seenUnion.has(key)) findings.push({ code: 'DUPLICATE_UNION', severity: 'MEDIUM', unionId: u.id, details: { key } }); else seenUnion.add(key); }
    const children = new Map<string, string[]>();
    for (const e of parentEdges) { const arr = children.get(e.parentId) || []; arr.push(e.childId); children.set(e.parentId, arr); }
    const visiting = new Set<string>(); const visited = new Set<string>();
    const dfs = (node: string, path: string[]) => { if (visiting.has(node)) { findings.push({ code: 'PARENT_CHILD_CYCLE', severity: 'CRITICAL', personId: node, details: { path: [...path, node] } }); return; } if (visited.has(node)) return; visiting.add(node); for (const next of children.get(node) || []) dfs(next, [...path, node]); visiting.delete(node); visited.add(node); };
    for (const node of children.keys()) dfs(node, []);
    let created = 0;
    for (const f of findings) {
      const exists = await this.prisma.graphAnomaly.findFirst({ where: { code: f.code, status: 'OPEN', personId: f.personId ?? null, relationshipId: f.relationshipId ?? null, parentChildId: f.parentChildId ?? null, unionId: f.unionId ?? null } });
      if (!exists) { await this.prisma.graphAnomaly.create({ data: f }); created++; }
    }
    return { findings: findings.length, newAnomalies: created };
  }
}
