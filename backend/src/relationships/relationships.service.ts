import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'} as Record<number,string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

@Injectable()
export class RelationshipsService {
  constructor(private prisma: PrismaService) {}

  private async assertCanEdit(userId: string, personId: string) {
    const claim = await this.prisma.personClaim.findFirst({ where: { userId, personId, status: 'VERIFIED' } });
    if (!claim) throw new ForbiddenException('You do not control this person');
  }
  private async assertNoOtherOwner(userId: string, personId: string) {
    const claim = await this.prisma.personClaim.findFirst({
      where: { userId: { not: userId }, personId, status: 'VERIFIED' },
      select: { id: true },
    });
    if (claim) {
      throw new ForbiddenException('Use a family invitation to connect to a profile claimed by another account');
    }
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
  private ensureDistinct(a: string, b: string) { if (a === b) throw new BadRequestException('A person cannot be related to themselves'); }
  private async peopleExist(ids: string[]) {
    const unique = [...new Set(ids)];
    const count = await this.prisma.person.count({ where: { id: { in: unique } } });
    if (count !== unique.length) throw new NotFoundException('One or more people do not exist');
  }

  async createRelationship(userId: string, input: any) {
    const { personAId, personBId, type, basis = 'UNKNOWN' } = input;
    this.ensureDistinct(personAId, personBId); await this.peopleExist([personAId, personBId]); await this.assertCanEdit(userId, personAId); await this.assertNoOtherOwner(userId, personBId);
    if (type === 'PARENT' || type === 'CHILD' || type === 'SIBLING') {
      const duplicate = await this.prisma.relationship.findFirst({ where: { personAId, personBId, type, status: { not: 'REJECTED' } } });
      if (duplicate) return duplicate;
    }
    return this.prisma.relationship.create({ data: { personAId, personBId, type, basis, status: 'PROPOSED', createdById: userId } });
  }

  async createParentChild(userId: string, input: any) {
    const { parentId, childId, parentType = 'BIOLOGICAL', basis = 'BIOLOGICAL' } = input;
    this.ensureDistinct(parentId, childId); await this.peopleExist([parentId, childId]); await this.assertCanEdit(userId, parentId); await this.assertNoOtherOwner(userId, childId);
    // Prevent a confirmed parent/child cycle: if child can already reach parent through parent edges, this edge would create a loop.
    const reachable = new Set<string>([childId]); const queue = [childId];
    while (queue.length) {
      const cur = queue.shift()!;
      const rows = await this.prisma.parentChildRelationship.findMany({ where: { parentId: cur, status: { not: 'REJECTED' } }, select: { childId: true } });
      for (const row of rows) if (!reachable.has(row.childId)) { reachable.add(row.childId); queue.push(row.childId); }
    }
    if (reachable.has(parentId)) throw new BadRequestException('This parent-child link would create a family graph cycle');
    const existing = await this.prisma.parentChildRelationship.findFirst({ where: { parentId, childId, parentType, status: { not: 'REJECTED' } } });
    if (existing) return existing;
    return this.prisma.parentChildRelationship.create({ data: { parentId, childId, parentType, basis, status: 'PROPOSED', createdById: userId } });
  }

  async createUnion(userId: string, input: any) {
    const { partnerAId, partnerBId, type = 'MARRIAGE', status = 'ACTIVE', startDate, endDate } = input;
    this.ensureDistinct(partnerAId, partnerBId); await this.peopleExist([partnerAId, partnerBId]); await this.assertCanEdit(userId, partnerAId); await this.assertNoOtherOwner(userId, partnerBId);
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) throw new BadRequestException('Union end date cannot precede start date');
    return this.prisma.union.create({ data: { partnerAId, partnerBId, type, status, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined, createdById: userId } });
  }

  async confirmRelationship(userId: string, id: string) {
    const r = await this.prisma.relationship.findUnique({ where: { id } }); if (!r) throw new NotFoundException();
    await this.assertCanEdit(userId, r.personAId);
    return this.prisma.relationship.update({ where: { id }, data: { status: 'CONFIRMED', verifiedById: userId } });
  }
  async confirmParentChild(userId: string, id: string) {
    const r = await this.prisma.parentChildRelationship.findUnique({ where: { id } }); if (!r) throw new NotFoundException();
    await this.assertCanEdit(userId, r.parentId);
    return this.prisma.parentChildRelationship.update({ where: { id }, data: { status: 'CONFIRMED' } });
  }

  async graph(userId: string, focusPersonId: string, depth = 2) {
    await this.assertCanEdit(userId, focusPersonId);
    const maxDepth = Math.min(Math.max(Number(depth) || 2, 1), 5);
    const seen = new Set<string>([focusPersonId]);
    let frontier = [focusPersonId];
    const edges: any[] = [];
    for (let d = 0; d < maxDepth; d++) {
      if (!frontier.length) break;
      const [relsA, relsB, pcsParent, pcsChild, unionsA, unionsB] = await Promise.all([
        this.prisma.relationship.findMany({ where: { personAId: { in: frontier }, status: 'CONFIRMED' } }),
        this.prisma.relationship.findMany({ where: { personBId: { in: frontier }, status: 'CONFIRMED' } }),
        this.prisma.parentChildRelationship.findMany({ where: { parentId: { in: frontier }, status: 'CONFIRMED' } }),
        this.prisma.parentChildRelationship.findMany({ where: { childId: { in: frontier }, status: 'CONFIRMED' } }),
        this.prisma.union.findMany({ where: { partnerAId: { in: frontier }, status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } } }),
        this.prisma.union.findMany({ where: { partnerBId: { in: frontier }, status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } } }),
      ]);
      const next: string[] = [];
      const layerEdges: { source: string; target: string; type: string; id: string }[] = [];
      const addEdge = (source: string, target: string, type: string, id: string) => {
        layerEdges.push({ id, source, target, type });
      };
      relsA.forEach(r => addEdge(r.personAId, r.personBId, r.type, r.id));
      relsB.forEach(r => addEdge(r.personBId, r.personAId, r.type, r.id));
      pcsParent.forEach(r => addEdge(r.parentId, r.childId, `PARENT_${r.parentType}`, r.id));
      pcsChild.forEach(r => addEdge(r.childId, r.parentId, `CHILD_${r.parentType}`, r.id));
      unionsA.forEach(r => addEdge(r.partnerAId, r.partnerBId, `UNION_${r.type}`, r.id));
      unionsB.forEach(r => addEdge(r.partnerBId, r.partnerAId, `UNION_${r.type}`, r.id));
      const restricted = await this.restrictedPersonIds(
        userId,
        layerEdges.map((edge) => edge.target),
      );
      for (const edge of layerEdges) {
        if (restricted.has(edge.target)) continue;
        edges.push(edge);
        if (!seen.has(edge.target)) {
          seen.add(edge.target);
          next.push(edge.target);
        }
      }
      frontier = next;
    }
    const people = await this.prisma.person.findMany({ where: { id: { in: [...seen] } }, include: { names: { where: { isPrimary: true }, take: 1 }, privacy: true } });
    const nodes = people.map(p => ({ id: p.id, name: p.id === focusPersonId || p.privacy?.profileVisibility !== 'PRIVATE' ? (p.names[0]?.fullName ?? 'Unknown') : 'Private family member', status: p.status }));
    return { focusPersonId, depth: maxDepth, nodes, edges };
  }

  async related(userId: string, a: string, b: string) {
    await this.assertCanEdit(userId, a); await this.peopleExist([a,b]);
    if ((await this.restrictedPersonIds(userId, [b])).has(b)) {
      throw new ForbiddenException('This family member has limited relationship visibility');
    }
    const queue: string[] = [a]; const prev = new Map<string, { from: string; label: string }>(); const seen = new Set([a]);
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === b) break;
      const [ra, rb, pa, pc, ua, ub] = await Promise.all([
        this.prisma.relationship.findMany({ where: { personAId: cur, status: 'CONFIRMED' } }), this.prisma.relationship.findMany({ where: { personBId: cur, status: 'CONFIRMED' } }),
        this.prisma.parentChildRelationship.findMany({ where: { parentId: cur, status: 'CONFIRMED' } }), this.prisma.parentChildRelationship.findMany({ where: { childId: cur, status: 'CONFIRMED' } }),
        this.prisma.union.findMany({ where: { partnerAId: cur, status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } } }), this.prisma.union.findMany({ where: { partnerBId: cur, status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } } })
      ]);
      const neighbors: [string,string][] = [];
      ra.forEach(r=>neighbors.push([r.personBId,r.type])); rb.forEach(r=>neighbors.push([r.personAId,r.type]));
      pa.forEach(r=>neighbors.push([r.childId,`PARENT_${r.parentType}`])); pc.forEach(r=>neighbors.push([r.parentId,`CHILD_${r.parentType}`]));
      ua.forEach(r=>neighbors.push([r.partnerBId,`UNION_${r.type}`])); ub.forEach(r=>neighbors.push([r.partnerAId,`UNION_${r.type}`]));
      const restricted = await this.restrictedPersonIds(
        userId,
        neighbors.map(([personId]) => personId),
      );
      for (const [n,label] of neighbors) if (!restricted.has(n) && !seen.has(n)) { seen.add(n); prev.set(n,{from:cur,label}); queue.push(n); }
    }
    if (!seen.has(b)) return { connected:false, path:[] };
    const path:any[] = []; let cur=b; while(cur!==a){ const p=prev.get(cur)!; path.push({personId:cur, via:p.label}); cur=p.from; } path.push({personId:a,via:'START'}); path.reverse();
    return { connected:true, path, hops:path.length-1 };
  }

  /**
   * Returns a human-readable kinship result and the shortest verified path.
   * The graph remains source-of-truth; kinship is derived, never persisted.
   */
  async kinship(userId: string, a: string, b: string) {
    await this.assertCanEdit(userId, a);
    await this.peopleExist([a, b]);
    const relatedPeople = await this.restrictedPersonIds(userId, [a, b]);
    if (relatedPeople.has(b) && a !== b) {
      throw new ForbiddenException('This family member has limited relationship visibility');
    }
    if (a === b) return { connected: true, relation: 'Self', path: [{ personId: a, via: 'START' }], hops: 0 };

    const [parents, unions] = await Promise.all([
      this.prisma.parentChildRelationship.findMany({ where: { status: 'CONFIRMED' }, select: { parentId: true, childId: true, parentType: true } }),
      this.prisma.union.findMany({ where: { status: { in: ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] } }, select: { partnerAId: true, partnerBId: true, type: true } }),
    ]);
    const hiddenRelationships = await this.restrictedPersonIds(userId, [
      ...parents.flatMap((r) => [r.parentId, r.childId]),
      ...unions.flatMap((u) => [u.partnerAId, u.partnerBId]),
    ]);

    const parentOf = new Map<string, { id: string; type: string }[]>();
    const childOf = new Map<string, { id: string; type: string }[]>();
    for (const r of parents) {
      if (hiddenRelationships.has(r.parentId) || hiddenRelationships.has(r.childId)) continue;
      if (!parentOf.has(r.parentId)) parentOf.set(r.parentId, []);
      if (!childOf.has(r.childId)) childOf.set(r.childId, []);
      parentOf.get(r.parentId)!.push({ id: r.childId, type: `PARENT_${r.parentType}` });
      childOf.get(r.childId)!.push({ id: r.parentId, type: `CHILD_${r.parentType}` });
    }
    const unionOf = new Map<string, { id: string; type: string }[]>();
    for (const u of unions) {
      if (hiddenRelationships.has(u.partnerAId) || hiddenRelationships.has(u.partnerBId)) continue;
      if (!unionOf.has(u.partnerAId)) unionOf.set(u.partnerAId, []);
      if (!unionOf.has(u.partnerBId)) unionOf.set(u.partnerBId, []);
      unionOf.get(u.partnerAId)!.push({ id: u.partnerBId, type: `UNION_${u.type}` });
      unionOf.get(u.partnerBId)!.push({ id: u.partnerAId, type: `UNION_${u.type}` });
    }

    // Shortest verified relationship path. Parent/child and union links are
    // deliberately undirected for navigation; their labels preserve direction.
    const queue = [a];
    const prev = new Map<string, { from: string; via: string }>();
    const seen = new Set([a]);
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === b) break;
      const neighbours = [
        ...(parentOf.get(cur) ?? []),
        ...(childOf.get(cur) ?? []),
        ...(unionOf.get(cur) ?? []),
      ];
      for (const n of neighbours) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        prev.set(n.id, { from: cur, via: n.type });
        queue.push(n.id);
      }
    }
    if (!seen.has(b)) return { connected: false, relation: null, path: [], hops: null };

    const path: { personId: string; via: string }[] = [];
    let cur = b;
    while (cur !== a) {
      const step = prev.get(cur)!;
      path.push({ personId: cur, via: step.via });
      cur = step.from;
    }
    path.push({ personId: a, via: 'START' });
    path.reverse();

    const ancestors = (start: string) => {
      const result = new Map<string, number>();
      const q: [string, number][] = [[start, 0]];
      const visited = new Set<string>([start]);
      while (q.length) {
        const [id, d] = q.shift()!;
        for (const p of childOf.get(id) ?? []) {
          if (visited.has(p.id)) continue;
          visited.add(p.id); result.set(p.id, d + 1); q.push([p.id, d + 1]);
        }
      }
      return result;
    };

    const aAnc = ancestors(a);
    const bAnc = ancestors(b);
    const directUp = aAnc.get(b);
    const directDown = bAnc.get(a);
    let relation = 'Connected relative';
    if (directUp !== undefined) {
      relation = directUp === 1 ? 'Parent' : `${'Great-'.repeat(Math.max(0, directUp - 2))}Grandparent`;
    } else if (directDown !== undefined) {
      relation = directDown === 1 ? 'Child' : `${'Great-'.repeat(Math.max(0, directDown - 2))}Grandchild`;
    } else {
      const common = [...aAnc.entries()]
        .filter(([id]) => bAnc.has(id))
        .sort((x, y) => (x[1] + (bAnc.get(x[0]) ?? 999)) - (y[1] + (bAnc.get(y[0]) ?? 999)))[0];
      if (common) {
        const da = common[1]; const db = bAnc.get(common[0])!;
        if (da === 1 && db === 1) {
          // Determine half vs full sibling by counting shared confirmed parents.
          const ap = new Set((childOf.get(a) ?? []).map(x => x.id));
          const shared = (childOf.get(b) ?? []).filter(x => ap.has(x.id)).length;
          relation = shared >= 2 ? 'Sibling' : 'Half-sibling';
        } else {
          const cousinDegree = Math.max(1, Math.min(da, db) - 1);
          const removal = Math.abs(da - db);
          relation = `${ordinal(cousinDegree)} cousin${removal ? ` ${removal}x removed` : ''}`;
        }
      }
      if (relation === 'Connected relative' && path.some(x => x.via.startsWith('UNION_'))) {
        const unionHops = path.filter(x => x.via.startsWith('UNION_')).length;
        if (unionHops === 1) relation = 'Spouse / in-law connection';
      }
    }
    const people = await this.prisma.person.findMany({ where: { id: { in: path.map(x => x.personId) } }, include: { names: { where: { isPrimary: true }, take: 1 } } });
    const names = new Map(people.map(p => [p.id, p.names[0]?.fullName ?? 'Unknown']));
    return {
      connected: true,
      relation,
      hops: path.length - 1,
      path: path.map(x => ({ ...x, name: names.get(x.personId) ?? 'Unknown' })),
    };
  }

}
