import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string) { return normalize(value).split(' ').filter(Boolean); }
function surnameOf(value: string) { const t = tokens(value); return t.length ? t[t.length - 1] : ''; }

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  private async root(userId: string) {
    const claim = await this.prisma.personClaim.findFirst({ where: { userId, status: 'VERIFIED' }, select: { personId: true } });
    if (!claim) throw new ForbiddenException('No verified family identity found');
    return claim.personId;
  }

  private async restrictedPersonIds(userId: string, personIds: string[]) {
    const ids = [...new Set(personIds)];
    if (!ids.length) return new Set<string>();
    const [privateSettings, claims] = await Promise.all([
      this.prisma.privacySetting.findMany({
        where: {
          personId: { in: ids },
          OR: [
            { profileVisibility: 'PRIVATE' },
            { relationshipVisibility: 'PRIVATE' },
          ],
        },
        select: { personId: true },
      }),
      this.prisma.personClaim.findMany({
        where: { userId, status: 'VERIFIED', personId: { in: ids } },
        select: { personId: true },
      }),
    ]);
    const owned = new Set(claims.map((claim) => claim.personId));
    return new Set(
      privateSettings
        .map((setting) => setting.personId)
        .filter((personId) => !owned.has(personId)),
    );
  }

  /** Collect every verified connected person without imposing a fixed generation limit. */
  private async accessibleIds(userId: string) {
    const root = await this.root(userId);
    const seen = new Set<string>([root]);
    let frontier = [root];
    while (frontier.length) {
      const [relsA, relsB, parents, children, unionsA, unionsB] = await Promise.all([
        this.prisma.relationship.findMany({ where: { personAId: { in: frontier }, status: 'CONFIRMED' }, select: { personBId: true } }),
        this.prisma.relationship.findMany({ where: { personBId: { in: frontier }, status: 'CONFIRMED' }, select: { personAId: true } }),
        this.prisma.parentChildRelationship.findMany({ where: { parentId: { in: frontier }, status: 'CONFIRMED' }, select: { childId: true } }),
        this.prisma.parentChildRelationship.findMany({ where: { childId: { in: frontier }, status: 'CONFIRMED' }, select: { parentId: true } }),
        this.prisma.union.findMany({ where: { partnerAId: { in: frontier }, status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } }, select: { partnerBId: true } }),
        this.prisma.union.findMany({ where: { partnerBId: { in: frontier }, status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } }, select: { partnerAId: true } }),
      ]);
      const next = new Set<string>();
      const candidates = [...relsA.map(x => x.personBId), ...relsB.map(x => x.personAId), ...parents.map(x => x.childId), ...children.map(x => x.parentId), ...unionsA.map(x => x.partnerBId), ...unionsB.map(x => x.partnerAId)];
      const restricted = await this.restrictedPersonIds(userId, candidates);
      for (const id of candidates) {
        if (!restricted.has(id) && !seen.has(id)) { seen.add(id); next.add(id); }
      }
      frontier = [...next];
      if (seen.size > 100000) break;
    }
    return { root, ids: [...seen] };
  }

  async people(userId: string, q: string, limit = 50) {
    const term = normalize(q || '');
    if (!term) return { query: '', results: [] };
    const { ids, root } = await this.accessibleIds(userId);
    const people = await this.prisma.person.findMany({
      where: { id: { in: ids }, names: { some: {} } },
      include: { names: { select: { id: true, fullName: true, nameType: true, isPrimary: true, language: true, script: true } }, privacy: true },
      take: 10000,
    });
    const scored = people.flatMap(person => {
      const rows = person.names.map(n => ({ name: n, normalized: normalize(n.fullName) }));
      let best = -1; let reason = 'name variant';
      for (const row of rows) {
        const exact = row.normalized === term;
        const starts = row.normalized.startsWith(term);
        const contains = row.normalized.includes(term);
        const qTokens = tokens(term); const nTokens = tokens(row.name.fullName);
        const tokenHits = qTokens.filter(t => nTokens.some(n => n.startsWith(t) || n.includes(t))).length;
        const score = exact ? 100 : starts ? 80 : contains ? 65 : tokenHits ? 40 + tokenHits : -1;
        if (score > best) { best = score; reason = exact ? 'exact name' : starts ? 'name starts with query' : contains ? 'name contains query' : 'name variant'; }
      }
      if (best < 0) return [];
      if (person.id !== root && person.privacy?.profileVisibility === 'PRIVATE') return [];
      return [{ person, score: best, reason }];
    }).sort((a,b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 100));
    return {
      query: q,
      results: scored.map(x => ({
        personId: x.person.id,
        name: x.person.names.find(n => n.isPrimary)?.fullName ?? x.person.names[0]?.fullName ?? 'Unknown',
        names: x.person.names.map(n => ({ fullName: n.fullName, nameType: n.nameType, language: n.language, script: n.script })),
        status: x.person.status,
        score: x.score,
        reason: x.reason,
        discoverable: x.person.privacy?.discoverable ?? false,
      })),
    };
  }

  async surnameSuggestions(userId: string, personId: string, limit = 30) {
    const { ids, root } = await this.accessibleIds(userId);
    if (!ids.includes(personId)) throw new ForbiddenException('Person is outside your verified family graph');
    const people = await this.prisma.person.findMany({ where: { id: { in: ids } }, include: { names: true, privacy: true } });
    const selected = people.find(p => p.id === personId);
    if (!selected) return [];
    const sourceNames = selected.names.map(n => surnameOf(n.fullName)).filter(Boolean);
    const sourceSet = new Set(sourceNames);
    return people.flatMap(person => {
      if (person.id === personId) return [];
      if (person.id !== root && person.privacy?.profileVisibility === 'PRIVATE') return [];
      const matches = person.names.filter(n => sourceSet.has(surnameOf(n.fullName)));
      if (!matches.length) return [];
      const name = person.names.find(n => n.isPrimary)?.fullName ?? person.names[0]?.fullName ?? 'Unknown';
      return [{ personId: person.id, name, matchingSurnames: [...new Set(matches.map(n => surnameOf(n.fullName)))], nameVariants: person.names.map(n => n.fullName) }];
    }).slice(0, Math.min(Math.max(limit, 1), 100));
  }

  async relationshipSearch(userId: string, q: string) {
    const { ids, root } = await this.accessibleIds(userId);
    const term = normalize(q || '');
    const people = await this.prisma.person.findMany({ where: { id: { in: ids } }, include: { names: { where: { isPrimary: true }, take: 1 }, privacy: true } });
    const ranked = people.filter(p => p.id === root || p.privacy?.profileVisibility !== 'PRIVATE').map(p => ({ p, score: normalize(p.names[0]?.fullName ?? '').includes(term) ? 100 : 0 })).filter(x => x.score).sort((a,b) => b.score-a.score).slice(0, 10);
    return ranked.map(x => ({ personId: x.p.id, name: x.p.names[0]?.fullName ?? 'Unknown' }));
  }
}
