import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const INVITE_DAYS = 14;
const ACTIVE_UNION_STATUSES = ['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED'] as const;

@Injectable()
export class FamilyBuilderService {
  constructor(private prisma: PrismaService) {}

  private async assertOwn(userId: string, personId: string) {
    if (typeof personId !== 'string' || !personId.trim()) {
      throw new BadRequestException('A person ID is required');
    }
    const claim = await this.prisma.personClaim.findFirst({ where: { userId, personId, status: 'VERIFIED' } });
    if (!claim) throw new ForbiddenException('You do not control this person');
  }

  private async exists(personId: string) {
    if (typeof personId !== 'string' || !personId.trim()) {
      throw new BadRequestException('A person ID is required');
    }
    const p = await this.prisma.person.findUnique({ where: { id: personId }, include: { names: { where: { isPrimary: true }, take: 1 } } });
    if (!p) throw new NotFoundException('Person not found');
    return p;
  }

  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  private async attachRelationship(
    userId: string,
    selfId: string,
    otherId: string,
    relationshipType: string,
    options: any = {},
    prisma: Pick<PrismaService, 'union' | 'parentChildRelationship' | 'relationship'> = this.prisma,
  ) {
    if (selfId === otherId) throw new BadRequestException('A person cannot be connected to themselves');
    if (relationshipType === 'SPOUSE') {
      const existing = await prisma.union.findFirst({ where: { OR: [{ partnerAId: selfId, partnerBId: otherId }, { partnerAId: otherId, partnerBId: selfId }], status: { in: [...ACTIVE_UNION_STATUSES] } } });
      if (existing) return { kind: 'UNION', record: existing, status: existing.status };
      const union = await prisma.union.create({ data: { partnerAId: selfId, partnerBId: otherId, type: options.unionType || 'MARRIAGE', status: options.status || 'ACTIVE', startDate: options.startDate ? new Date(options.startDate) : undefined, endDate: options.endDate ? new Date(options.endDate) : undefined, createdById: userId } });
      return { kind: 'UNION', record: union, status: union.status };
    }
    if (relationshipType === 'PARENT' || relationshipType === 'CHILD') {
      const parentId = relationshipType === 'PARENT' ? otherId : selfId;
      const childId = relationshipType === 'PARENT' ? selfId : otherId;
      if (parentId === childId) throw new BadRequestException('A person cannot be their own parent');
      const existing = await prisma.parentChildRelationship.findFirst({ where: { parentId, childId, parentType: options.parentType || 'BIOLOGICAL', status: { not: 'REJECTED' } } });
      if (existing) return { kind: 'PARENT_CHILD', record: existing, status: existing.status };
      const row = await prisma.parentChildRelationship.create({ data: { parentId, childId, parentType: options.parentType || 'BIOLOGICAL', basis: options.basis || 'BIOLOGICAL', status: 'CONFIRMED', createdById: userId } });
      return { kind: 'PARENT_CHILD', record: row, status: row.status };
    }
    if (relationshipType === 'SIBLING') {
      const existing = await prisma.relationship.findFirst({ where: { OR: [{ personAId: selfId, personBId: otherId, type: 'SIBLING' }, { personAId: otherId, personBId: selfId, type: 'SIBLING' }], status: { not: 'REJECTED' } } });
      if (existing) return { kind: 'RELATIONSHIP', record: existing, status: existing.status };
      const row = await prisma.relationship.create({ data: { personAId: selfId, personBId: otherId, type: 'SIBLING', basis: options.basis || 'BIOLOGICAL', status: 'CONFIRMED', createdById: userId, verifiedById: userId } });
      return { kind: 'RELATIONSHIP', record: row, status: row.status };
    }
    throw new BadRequestException('Unsupported family relationship');
  }

  async addRelative(userId: string, input: any) {
    const selfId = input.selfPersonId;
    await this.assertOwn(userId, selfId);
    const name = String(input.name || '').trim();
    if (!name) throw new BadRequestException('Name is required');
    const person = await this.prisma.person.create({ data: { gender: input.gender || undefined, birthDate: input.birthDate ? new Date(input.birthDate) : undefined, status: input.status || 'UNKNOWN', names: { create: { fullName: name, nameType: input.nameType || 'CURRENT', isPrimary: true } }, privacy: { create: { discoverable: false } } } });
    const connection = await this.attachRelationship(userId, selfId, person.id, String(input.relationshipType || '').toUpperCase(), input);
    await this.prisma.auditLog.create({ data: { actorUserId: userId, action: 'FAMILY_BUILDER_ADD_RELATIVE', entityType: 'PERSON', entityId: person.id, metadata: { selfPersonId: selfId, relationshipType: input.relationshipType } } });
    return { person, connection };
  }

  async connectExisting(userId: string, input: any) {
    const selfId = input.selfPersonId;
    await this.assertOwn(userId, selfId);
    await this.exists(input.otherPersonId);
    const otherOwner = await this.prisma.personClaim.findFirst({
      where: { personId: input.otherPersonId, status: 'VERIFIED', userId: { not: userId } },
    });
    if (otherOwner) {
      throw new ForbiddenException('Use a family invitation to connect to a profile claimed by another account');
    }
    const connection = await this.attachRelationship(userId, selfId, input.otherPersonId, String(input.relationshipType || '').toUpperCase(), input);
    await this.prisma.auditLog.create({ data: { actorUserId: userId, action: 'FAMILY_BUILDER_CONNECT_EXISTING', entityType: 'PERSON', entityId: input.otherPersonId, metadata: { selfPersonId: selfId, relationshipType: input.relationshipType } } });
    return connection;
  }

  async createInvitation(userId: string, input: any) {
    const inviterPersonId = input.inviterPersonId;
    await this.assertOwn(userId, inviterPersonId);
    const targetPersonId = input.targetPersonId || inviterPersonId;
    if (input.targetPersonId) await this.exists(targetPersonId);
    const targetOwner = await this.prisma.personClaim.findFirst({
      where: { personId: targetPersonId, status: 'VERIFIED', userId: { not: userId } },
    });
    if (targetOwner) {
      throw new ForbiddenException('Only the verified profile owner may invite others to connect to this person');
    }
    if (!input.relationshipType) throw new BadRequestException('relationshipType is required');
    const relationshipType = String(input.relationshipType).toUpperCase();
    if (!['PARENT', 'CHILD', 'SIBLING', 'SPOUSE'].includes(relationshipType)) {
      throw new BadRequestException('Unsupported family relationship');
    }
    if (input.destination != null && typeof input.destination !== 'string') {
      throw new BadRequestException('destination must be a string');
    }
    const familySpaceId = input.familySpaceId || undefined;
    if (familySpaceId) {
      const membership = await this.prisma.familySpaceMember.findUnique({
        where: { familySpaceId_personId: { familySpaceId, personId: inviterPersonId } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('You must be an active member of this family space to invite someone');
      }
      if (targetPersonId !== inviterPersonId) {
        const targetMembership = await this.prisma.familySpaceMember.findUnique({
          where: { familySpaceId_personId: { familySpaceId, personId: targetPersonId } },
        });
        if (!targetMembership || targetMembership.status !== 'ACTIVE') {
          throw new ForbiddenException('The invitation target is not an active member of this family space');
        }
      }
    }
    const token = randomBytes(32).toString('base64url');
    const inviteeDestination = input.destination?.trim().toLowerCase() || undefined;
    const invitation = await this.prisma.familyInvitation.create({ data: { inviterUserId: userId, familySpaceId, targetPersonId, inviteeDestination, relationHint: input.relationHint || undefined, relationshipType, tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000) } });
    await this.prisma.auditLog.create({ data: { actorUserId: userId, action: 'FAMILY_INVITE_CREATED', entityType: 'FAMILY_INVITATION', entityId: invitation.id, metadata: { relationshipType: invitation.relationshipType, targetPersonId: invitation.targetPersonId } } });
    return { invitation, token, shareText: `Join my family network and connect as ${input.relationHint || String(input.relationshipType).toLowerCase()}. Invite token: ${token}` };
  }

  async listInvitations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true },
    });
    const verifiedContacts = [
      user?.emailVerifiedAt ? user.email?.trim().toLowerCase() : undefined,
      user?.phoneVerifiedAt ? user.phone?.trim().toLowerCase() : undefined,
    ].filter((contact): contact is string => Boolean(contact));
    const include = { targetPerson: { include: { names: { where: { isPrimary: true }, take: 1 } } } };
    const [sent, incoming] = await Promise.all([
      this.prisma.familyInvitation.findMany({ where: { inviterUserId: userId }, orderBy: { createdAt: 'desc' }, take: 100, include }),
      verifiedContacts.length
        ? this.prisma.familyInvitation.findMany({
            where: {
              inviteeDestination: { in: verifiedContacts },
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include,
          })
        : Promise.resolve([]),
    ]);
    return { sent, incoming };
  }

  async acceptInvitation(userId: string, token: string) {
    const invitation = await this.prisma.familyInvitation.findUnique({ where: { tokenHash: this.hashToken(token) }, include: { targetPerson: true } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) throw new BadRequestException('Invitation is no longer active');
    if (!invitation.targetPersonId) throw new BadRequestException('Invitation has no target person');
    if (invitation.inviteeDestination) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true },
      });
      const verifiedContacts = [
        user?.emailVerifiedAt ? user.email?.trim().toLowerCase() : undefined,
        user?.phoneVerifiedAt ? user.phone?.trim().toLowerCase() : undefined,
      ].filter((contact): contact is string => Boolean(contact));
      if (!verifiedContacts.includes(invitation.inviteeDestination.trim().toLowerCase())) {
        throw new ForbiddenException('This invitation is restricted to a different verified contact');
      }
    }
    const otherTargetOwner = await this.prisma.personClaim.findFirst({
      where: {
        personId: invitation.targetPersonId,
        status: 'VERIFIED',
        userId: { not: invitation.inviterUserId },
      },
    });
    if (otherTargetOwner) {
      throw new ForbiddenException('The invitation target is now claimed by another account');
    }
    const claim = await this.prisma.personClaim.findFirst({ where: { userId, status: 'VERIFIED' } });
    if (!claim) throw new BadRequestException('Create or claim your person profile before accepting a family invitation');
    if (invitation.familySpaceId) {
      const inviterMembership = await this.prisma.familySpaceMember.findUnique({
        where: { familySpaceId_personId: { familySpaceId: invitation.familySpaceId, personId: invitation.targetPersonId } },
      });
      if (!inviterMembership || inviterMembership.status !== 'ACTIVE') {
        throw new ForbiddenException('The invitation is no longer valid for this family space');
      }
    }
    const acceptedAt = new Date();
    const connection = await this.prisma.$transaction(async (tx) => {
      const accepted = await tx.familyInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: acceptedAt } },
        data: { status: 'ACCEPTED', acceptedByUserId: userId, acceptedAt },
      });
      if (accepted.count !== 1) throw new BadRequestException('Invitation is no longer active');
      const result = await this.attachRelationship(
        userId,
        invitation.targetPersonId!,
        claim.personId,
        invitation.relationshipType || '',
        {},
        tx,
      );
      if (invitation.familySpaceId) {
        await tx.familySpaceMember.upsert({
          where: { familySpaceId_personId: { familySpaceId: invitation.familySpaceId, personId: claim.personId } },
          create: { familySpaceId: invitation.familySpaceId, personId: claim.personId, userId },
          update: { status: 'ACTIVE' },
        });
      }
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'FAMILY_INVITE_ACCEPTED', entityType: 'FAMILY_INVITATION', entityId: invitation.id, metadata: { targetPersonId: invitation.targetPersonId, acceptedPersonId: claim.personId } } });
      return result;
    });
    return { invitationId: invitation.id, connection };
  }

  async createMatchCandidate(userId: string, input: any) {
    await this.assertOwn(userId, input.personAId);
    await this.exists(input.personBId);
    if (input.personAId === input.personBId) throw new BadRequestException('Cannot match a person with themselves');
    const [a,b] = [input.personAId,input.personBId].sort();
    const existing = await this.prisma.personMatchCandidate.findUnique({ where: { personAId_personBId: { personAId: a, personBId: b } } });
    if (existing) return existing;
    return this.prisma.personMatchCandidate.create({ data: { personAId: a, personBId: b, reason: String(input.reason || 'Possible duplicate person'), confidence: input.confidence == null ? undefined : Number(input.confidence), createdByUserId: userId } });
  }

  async listMatchCandidates(userId: string, personId: string) {
    await this.assertOwn(userId, personId);
    return this.prisma.personMatchCandidate.findMany({ where: { status: 'PENDING', OR: [{ personAId: personId }, { personBId: personId }] }, include: { personA: { include: { names: { where: { isPrimary: true }, take: 1 } } }, personB: { include: { names: { where: { isPrimary: true }, take: 1 } } } }, orderBy: { createdAt: 'desc' } });
  }

  async resolveMatch(userId: string, candidateId: string, action: 'DISMISS'|'MERGE_A'|'MERGE_B') {
    const candidate = await this.prisma.personMatchCandidate.findUnique({ where: { id: candidateId }, include: { personA: true, personB: true } });
    if (!candidate) throw new NotFoundException('Match candidate not found');
    if (!['DISMISS', 'MERGE_A', 'MERGE_B'].includes(action)) {
      throw new BadRequestException('Unsupported match resolution action');
    }
    const ownedCandidatePerson = await this.prisma.personClaim.findFirst({
      where: { userId, status: 'VERIFIED', personId: { in: [candidate.personAId, candidate.personBId] } },
    });
    if (!ownedCandidatePerson) throw new ForbiddenException('You do not control either person in this match');
    if (action === 'DISMISS') return this.prisma.personMatchCandidate.update({ where: { id: candidateId }, data: { status: 'DISMISSED', resolvedByUserId: userId, resolvedAt: new Date() } });
    const keepId = action === 'MERGE_A' ? candidate.personAId : candidate.personBId;
    const removeId = action === 'MERGE_A' ? candidate.personBId : candidate.personAId;
    await this.assertOwn(userId, keepId);
    const verifiedClaims = await this.prisma.personClaim.count({ where: { personId: removeId, status: 'VERIFIED' } });
    if (verifiedClaims > 0) throw new BadRequestException('The duplicate profile is claimed by another verified user. Do not merge it automatically; request an ownership review.');
    await this.mergePerson(userId, keepId, removeId, candidateId);
    return { status: 'MERGED', keptPersonId: keepId, removedPersonId: removeId };
  }

  private async mergePerson(userId: string, keepId: string, removeId: string, matchCandidateId: string) {
    const [relsA, relsB, parents, children, unionsA, unionsB, memberships, invitations, names] = await Promise.all([
      this.prisma.relationship.findMany({ where: { personAId: removeId } }), this.prisma.relationship.findMany({ where: { personBId: removeId } }),
      this.prisma.parentChildRelationship.findMany({ where: { parentId: removeId } }), this.prisma.parentChildRelationship.findMany({ where: { childId: removeId } }),
      this.prisma.union.findMany({ where: { partnerAId: removeId } }), this.prisma.union.findMany({ where: { partnerBId: removeId } }),
      this.prisma.familySpaceMember.findMany({ where: { personId: removeId } }), this.prisma.familyInvitation.findMany({ where: { targetPersonId: removeId } }),
      this.prisma.personName.findMany({ where: { personId: removeId } }),
    ]);
    await this.prisma.$transaction(async tx => {
      for (const n of names) await tx.personName.update({ where: { id: n.id }, data: { personId: keepId, isPrimary: false } });
      for (const r of relsA) { if (r.personBId !== keepId && !(await tx.relationship.findFirst({ where: { personAId: keepId, personBId: r.personBId, type: r.type, status: { not: 'REJECTED' } } }))) await tx.relationship.update({ where: { id: r.id }, data: { personAId: keepId } }); else await tx.relationship.delete({ where: { id: r.id } }); }
      for (const r of relsB) { if (r.personAId !== keepId && !(await tx.relationship.findFirst({ where: { personAId: r.personAId, personBId: keepId, type: r.type, status: { not: 'REJECTED' } } }))) await tx.relationship.update({ where: { id: r.id }, data: { personBId: keepId } }); else await tx.relationship.delete({ where: { id: r.id } }); }
      for (const r of parents) { if (r.childId !== keepId && !(await tx.parentChildRelationship.findFirst({ where: { parentId: keepId, childId: r.childId, status: { not: 'REJECTED' } } }))) await tx.parentChildRelationship.update({ where: { id: r.id }, data: { parentId: keepId } }); else await tx.parentChildRelationship.delete({ where: { id: r.id } }); }
      for (const r of children) { if (r.parentId !== keepId && !(await tx.parentChildRelationship.findFirst({ where: { parentId: r.parentId, childId: keepId, status: { not: 'REJECTED' } } }))) await tx.parentChildRelationship.update({ where: { id: r.id }, data: { childId: keepId } }); else await tx.parentChildRelationship.delete({ where: { id: r.id } }); }
      for (const u of unionsA) { if (u.partnerBId !== keepId && !(await tx.union.findFirst({ where: { OR: [{ partnerAId: keepId, partnerBId: u.partnerBId }, { partnerAId: u.partnerBId, partnerBId: keepId }], status: { in: [...ACTIVE_UNION_STATUSES] } } }))) await tx.union.update({ where: { id: u.id }, data: { partnerAId: keepId } }); else await tx.union.delete({ where: { id: u.id } }); }
      for (const u of unionsB) { if (u.partnerAId !== keepId && !(await tx.union.findFirst({ where: { OR: [{ partnerAId: keepId, partnerBId: u.partnerAId }, { partnerAId: u.partnerAId, partnerBId: keepId }], status: { in: [...ACTIVE_UNION_STATUSES] } } }))) await tx.union.update({ where: { id: u.id }, data: { partnerBId: keepId } }); else await tx.union.delete({ where: { id: u.id } }); }
      for (const m of memberships) { const existing = await tx.familySpaceMember.findUnique({ where: { familySpaceId_personId: { familySpaceId: m.familySpaceId, personId: keepId } } }); if (existing) await tx.familySpaceMember.delete({ where: { id: m.id } }); else await tx.familySpaceMember.update({ where: { id: m.id }, data: { personId: keepId } }); }
      for (const i of invitations) await tx.familyInvitation.update({ where: { id: i.id }, data: { targetPersonId: keepId } });
      await tx.person.delete({ where: { id: removeId } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'PERSON_MERGED', entityType: 'PERSON', entityId: keepId, metadata: { removedPersonId: removeId, matchCandidateId } } });
    });
  }
}
