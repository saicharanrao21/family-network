import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId:string) {
    const claim = await this.prisma.personClaim.findFirst({where:{userId,status:'VERIFIED'}, orderBy:{verifiedAt:'asc'}});
    if (!claim) throw new NotFoundException('No verified family identity is linked to this account');
    return this.prisma.privacySetting.upsert({where:{personId:claim.personId}, create:{personId:claim.personId}, update:{}});
  }

  async updateSettings(userId:string, input:any) {
    const current = await this.getSettings(userId);
    const allowed = ['discoverable','profileVisibility','relationshipVisibility','locationVisibility'];
    const data:any = {};
    for (const key of allowed) if (input?.[key] !== undefined) data[key] = input[key];
    if (data.profileVisibility && !['PRIVATE','FAMILY_ONLY','FAMILY'].includes(data.profileVisibility)) throw new BadRequestException('Invalid profile visibility');
    if (data.relationshipVisibility && !['PRIVATE','FAMILY_ONLY','FAMILY'].includes(data.relationshipVisibility)) throw new BadRequestException('Invalid relationship visibility');
    if (data.locationVisibility && !['PRIVATE','FAMILY_ONLY','FAMILY'].includes(data.locationVisibility)) throw new BadRequestException('Invalid location visibility');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.privacySetting.update({where:{id:current.id}, data});
      await tx.auditLog.create({data:{actorUserId:userId, action:'PRIVACY_SETTINGS_UPDATED', entityType:'PrivacySetting', entityId:updated.id, metadata:data}});
      return updated;
    });
  }

  async sessions(userId:string) {
    return this.prisma.session.findMany({where:{userId}, select:{id:true,status:true,createdAt:true,lastUsedAt:true,expiresAt:true,revokedAt:true}, orderBy:{createdAt:'desc'}});
  }

  async revokeSession(userId:string, sessionId:string) {
    const session = await this.prisma.session.findFirst({where:{id:sessionId,userId}});
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.session.update({where:{id:sessionId}, data:{status:'REVOKED',revokedAt:new Date()}});
    await this.prisma.auditLog.create({data:{actorUserId:userId,action:'SESSION_REVOKED',entityType:'Session',entityId:sessionId}});
    return {ok:true};
  }

  async requestExport(userId:string) {
    const existing = await this.prisma.privacyRequest.findFirst({where:{userId,type:'EXPORT',status:{in:['PENDING','PROCESSING']}}});
    if (existing) return existing;
    return this.prisma.privacyRequest.create({data:{userId,type:'EXPORT'}});
  }

  async exportData(userId:string) {
    const user = await this.prisma.user.findUnique({where:{id:userId}, select:{id:true,email:true,phone:true,emailVerifiedAt:true,phoneVerifiedAt:true,createdAt:true,updatedAt:true}});
    if (!user) throw new NotFoundException('User not found');
    const [claims, names, relationshipsA, relationshipsB, parents, children, unionsA, unionsB, families, memories, stories, events, documents, notifications] = await Promise.all([
      this.prisma.personClaim.findMany({where:{userId}}),
      this.prisma.personName.findMany({where:{person:{claims:{some:{userId}}}}}),
      this.prisma.relationship.findMany({where:{personA:{claims:{some:{userId}}}}}),
      this.prisma.relationship.findMany({where:{personB:{claims:{some:{userId}}}}}),
      this.prisma.parentChildRelationship.findMany({where:{parent:{claims:{some:{userId}}}}}),
      this.prisma.parentChildRelationship.findMany({where:{child:{claims:{some:{userId}}}}}),
      this.prisma.union.findMany({where:{partnerA:{claims:{some:{userId}}}}}),
      this.prisma.union.findMany({where:{partnerB:{claims:{some:{userId}}}}}),
      this.prisma.familySpaceMember.findMany({where:{userId}}),
      this.prisma.memory.findMany({where:{createdById:userId}}),
      this.prisma.familyStory.findMany({where:{createdById:userId}}),
      this.prisma.familyEvent.findMany({where:{createdById:userId}}),
      this.prisma.archiveDocument.findMany({where:{createdById:userId}}),
      this.prisma.notification.findMany({where:{userId}, take:1000, orderBy:{createdAt:'desc'}}),
    ]);
    return {exportVersion:'1.0', exportedAt:new Date().toISOString(), user, claims, names, relationshipsA, relationshipsB, parents, children, unionsA, unionsB, families, memories, stories, events, documents, notifications};
  }

  async requestDeletion(userId:string) {
    const existing = await this.prisma.privacyRequest.findFirst({where:{userId,type:'DELETE',status:{in:['PENDING','PROCESSING']}}});
    if (existing) return existing;
    const scheduledFor = new Date(Date.now()+7*24*60*60*1000);
    const result = await this.prisma.privacyRequest.create({data:{userId,type:'DELETE',scheduledFor}});
    await this.prisma.auditLog.create({data:{actorUserId:userId,action:'ACCOUNT_DELETION_REQUESTED',entityType:'User',entityId:userId,metadata:{scheduledFor}}});
    return result;
  }

  async cancelDeletion(userId:string) {
    const existing = await this.prisma.privacyRequest.findFirst({where:{userId,type:'DELETE',status:'PENDING'},orderBy:{requestedAt:'desc'}});
    if (!existing) throw new ConflictException('No pending deletion request');
    return this.prisma.privacyRequest.update({where:{id:existing.id},data:{status:'CANCELED'}});
  }

  async privacySummary(userId:string) {
    const [settings, sessions, deletion] = await Promise.all([this.getSettings(userId), this.sessions(userId), this.prisma.privacyRequest.findFirst({where:{userId,type:'DELETE',status:{in:['PENDING','PROCESSING']}}})]);
    return {settings, sessions, deletionRequest:deletion};
  }
}
