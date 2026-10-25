import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const personSelect = { id:true, names:{where:{isPrimary:true},take:1,select:{fullName:true}}, status:true } as const;

@Injectable()
export class ArchiveService {
  constructor(private prisma:PrismaService) {}

  private async root(userId:string){
    const claim=await this.prisma.personClaim.findFirst({where:{userId,status:'VERIFIED'},select:{personId:true}});
    if(!claim) throw new ForbiddenException('No verified family identity found');
    return claim.personId;
  }
  private async accessibleIds(userId:string){
    const root=await this.root(userId); const seen=new Set([root]); let frontier=[root];
    while(frontier.length){
      const [a,b,p,c,ua,ub]=await Promise.all([
        this.prisma.relationship.findMany({where:{personAId:{in:frontier},status:'CONFIRMED'},select:{personBId:true}}),
        this.prisma.relationship.findMany({where:{personBId:{in:frontier},status:'CONFIRMED'},select:{personAId:true}}),
        this.prisma.parentChildRelationship.findMany({where:{parentId:{in:frontier},status:'CONFIRMED'},select:{childId:true}}),
        this.prisma.parentChildRelationship.findMany({where:{childId:{in:frontier},status:'CONFIRMED'},select:{parentId:true}}),
        this.prisma.union.findMany({where:{partnerAId:{in:frontier},status:{in:['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED']}},select:{partnerBId:true}}),
        this.prisma.union.findMany({where:{partnerBId:{in:frontier},status:{in:['ACTIVE','ENDED','DIVORCED','SEPARATED','WIDOWED']}},select:{partnerAId:true}}),
      ]);
      const next:string[]=[];
      for(const id of [...a.map(x=>x.personBId),...b.map(x=>x.personAId),...p.map(x=>x.childId),...c.map(x=>x.parentId),...ua.map(x=>x.partnerBId),...ub.map(x=>x.partnerAId)]) if(!seen.has(id)){seen.add(id);next.push(id);}
      frontier=next; if(seen.size>100000) break;
    }
    return seen;
  }
  private async assertPeople(userId:string, ids:string[]){
    const unique=[...new Set(ids.filter(Boolean))]; if(!unique.length) return [];
    const allowed=await this.accessibleIds(userId); const invalid=unique.find(id=>!allowed.has(id));
    if(invalid) throw new ForbiddenException('Person is outside your verified family graph');
    return unique;
  }
  private date(value:any){ if(value===undefined||value===null||value==='') return undefined; const d=new Date(value); if(Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date'); return d; }
  private limit(n:number){ return Math.min(Math.max(Number.isFinite(n)?n:50,1),100); }

  async timeline(userId:string, limit:number){
    const ids=await this.accessibleIds(userId); const take=this.limit(limit);
    const [memories,stories,events]=await Promise.all([
      this.prisma.memory.findMany({where:{createdById:userId,people:{some:{personId:{in:[...ids]}}}},orderBy:{capturedAt:'desc'},take,select:{id:true,title:true,description:true,type:true,capturedAt:true,createdAt:true}}),
      this.prisma.familyStory.findMany({where:{createdById:userId},orderBy:{createdAt:'desc'},take,select:{id:true,title:true,body:true,createdAt:true}}),
      this.prisma.familyEvent.findMany({where:{createdById:userId},orderBy:{startsAt:'desc'},take,select:{id:true,title:true,description:true,type:true,startsAt:true}}),
    ]);
    return [...memories.map(x=>({kind:'MEMORY',date:x.capturedAt||x.createdAt,...x})),...stories.map(x=>({kind:'STORY',date:x.createdAt,...x})),...events.map(x=>({kind:'EVENT',date:x.startsAt,...x}))].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,take);
  }

  async overview(userId:string){
    const ids=await this.accessibleIds(userId); const where={createdById:userId};
    const [memories,stories,events,documents]=await Promise.all([
      this.prisma.memory.count({where}),this.prisma.familyStory.count({where}),this.prisma.familyEvent.count({where}),this.prisma.archiveDocument.count({where})
    ]);
    return {connectedPeople:ids.size, memories, stories, events, documents};
  }

  async listMemories(userId:string, limit:number){
    const ids=await this.accessibleIds(userId); const rows=await this.prisma.memory.findMany({where:{createdById:userId,visibility:{in:['PRIVATE','FAMILY']},people:{some:{personId:{in:[...ids]}}}},orderBy:{createdAt:'desc'},take:this.limit(limit),include:{people:{include:{person:{select:personSelect}}},assets:true}}); return rows;
  }
  async createMemory(userId:string,b:any){
    if(!b?.title?.trim()) throw new BadRequestException('Memory title is required');
    const people=await this.assertPeople(userId,b.personIds||[]);
    return this.prisma.memory.create({data:{title:b.title.trim(),description:b.description?.trim()||null,type:b.type||'TEXT',capturedAt:this.date(b.capturedAt),visibility:b.visibility||'FAMILY',createdById:userId,people:{create:people.map(personId=>({personId}))}} ,include:{people:{include:{person:{select:personSelect}}},assets:true}});
  }
  async updateMemory(userId:string,id:string,b:any){
    const existing=await this.prisma.memory.findFirst({where:{id,createdById:userId}}); if(!existing) throw new NotFoundException('Memory not found');
    if(b.personIds){const people=await this.assertPeople(userId,b.personIds); await this.prisma.memoryPerson.deleteMany({where:{memoryId:id}}); await this.prisma.memoryPerson.createMany({data:people.map(personId=>({memoryId:id,personId})),skipDuplicates:true});}
    return this.prisma.memory.update({where:{id},data:{title:b.title?.trim(),description:b.description?.trim(),type:b.type,capturedAt:b.capturedAt===null?null:this.date(b.capturedAt),visibility:b.visibility},include:{people:{include:{person:{select:personSelect}}},assets:true}});
  }
  async deleteMemory(userId:string,id:string){const r=await this.prisma.memory.deleteMany({where:{id,createdById:userId}}); if(!r.count) throw new NotFoundException('Memory not found'); return {deleted:true};}
  async addAsset(userId:string,memoryId:string,b:any){
    const memory=await this.prisma.memory.findFirst({where:{id:memoryId,createdById:userId}}); if(!memory) throw new NotFoundException('Memory not found');
    if(!b?.storageKey||!b?.mimeType) throw new BadRequestException('storageKey and mimeType are required');
    return this.prisma.mediaAsset.create({data:{memoryId,storageKey:String(b.storageKey),mimeType:String(b.mimeType),originalName:b.originalName,sizeBytes:b.sizeBytes,width:b.width,height:b.height,durationSeconds:b.durationSeconds,checksum:b.checksum}});
  }

  async listStories(userId:string,limit:number){return this.prisma.familyStory.findMany({where:{createdById:userId},orderBy:{createdAt:'desc'},take:this.limit(limit),include:{people:{include:{person:{select:personSelect}}}}});}
  async createStory(userId:string,b:any){if(!b?.title?.trim()||!b?.body?.trim()) throw new BadRequestException('Story title and body are required'); const people=await this.assertPeople(userId,b.personIds||[]); return this.prisma.familyStory.create({data:{title:b.title.trim(),body:b.body.trim(),coverAssetId:b.coverAssetId||null,visibility:b.visibility||'FAMILY',createdById:userId,people:{create:people.map(personId=>({personId}))}},include:{people:{include:{person:{select:personSelect}}}}});}
  async updateStory(userId:string,id:string,b:any){const old=await this.prisma.familyStory.findFirst({where:{id,createdById:userId}});if(!old)throw new NotFoundException('Story not found');if(b.personIds){const people=await this.assertPeople(userId,b.personIds);await this.prisma.storyPerson.deleteMany({where:{storyId:id}});await this.prisma.storyPerson.createMany({data:people.map(personId=>({storyId:id,personId})),skipDuplicates:true});}return this.prisma.familyStory.update({where:{id},data:{title:b.title?.trim(),body:b.body?.trim(),coverAssetId:b.coverAssetId,visibility:b.visibility},include:{people:{include:{person:{select:personSelect}}}}});}
  async deleteStory(userId:string,id:string){const r=await this.prisma.familyStory.deleteMany({where:{id,createdById:userId}});if(!r.count)throw new NotFoundException('Story not found');return {deleted:true};}

  async listEvents(userId:string,from?:string,to?:string){return this.prisma.familyEvent.findMany({where:{createdById:userId,startsAt:{gte:from?this.date(from):undefined,lte:to?this.date(to):undefined}},orderBy:{startsAt:'asc'},include:{people:{include:{person:{select:personSelect}}}}});}
  async createEvent(userId:string,b:any){if(!b?.title?.trim()||!b?.startsAt)throw new BadRequestException('Event title and start time are required');const people=await this.assertPeople(userId,b.personIds||[]);return this.prisma.familyEvent.create({data:{title:b.title.trim(),description:b.description?.trim()||null,type:b.type||'OTHER',startsAt:this.date(b.startsAt)!,endsAt:this.date(b.endsAt),location:b.location?.trim()||null,visibility:b.visibility||'FAMILY',createdById:userId,people:{create:people.map(personId=>({personId}))}},include:{people:{include:{person:{select:personSelect}}}}});}
  async updateEvent(userId:string,id:string,b:any){const old=await this.prisma.familyEvent.findFirst({where:{id,createdById:userId}});if(!old)throw new NotFoundException('Event not found');if(b.personIds){const people=await this.assertPeople(userId,b.personIds);await this.prisma.eventPerson.deleteMany({where:{eventId:id}});await this.prisma.eventPerson.createMany({data:people.map(personId=>({eventId:id,personId})),skipDuplicates:true});}return this.prisma.familyEvent.update({where:{id},data:{title:b.title?.trim(),description:b.description?.trim(),type:b.type,startsAt:b.startsAt?this.date(b.startsAt):undefined,endsAt:b.endsAt===null?null:this.date(b.endsAt),location:b.location?.trim(),visibility:b.visibility},include:{people:{include:{person:{select:personSelect}}}}});}
  async deleteEvent(userId:string,id:string){const r=await this.prisma.familyEvent.deleteMany({where:{id,createdById:userId}});if(!r.count)throw new NotFoundException('Event not found');return {deleted:true};}

  async listDocuments(userId:string,limit:number){const ids=await this.accessibleIds(userId);return this.prisma.archiveDocument.findMany({where:{createdById:userId,people:{some:{personId:{in:[...ids]}}}},orderBy:{createdAt:'desc'},take:this.limit(limit),include:{people:{include:{person:{select:personSelect}}}}});}
  async createDocument(userId:string,b:any){if(!b?.title?.trim()||!b?.storageKey||!b?.mimeType)throw new BadRequestException('Document title, storageKey and mimeType are required');const people=await this.assertPeople(userId,b.personIds||[]);return this.prisma.archiveDocument.create({data:{title:b.title.trim(),type:b.type||'OTHER',description:b.description?.trim()||null,storageKey:String(b.storageKey),mimeType:String(b.mimeType),checksum:b.checksum,visibility:b.visibility||'FAMILY',createdById:userId,people:{create:people.map(personId=>({personId}))}},include:{people:{include:{person:{select:personSelect}}}}});}
  async deleteDocument(userId:string,id:string){const r=await this.prisma.archiveDocument.deleteMany({where:{id,createdById:userId}});if(!r.count)throw new NotFoundException('Document not found');return {deleted:true};}
}
