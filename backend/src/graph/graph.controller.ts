import { Controller, Get, Query, UseGuards } from '@nestjs/common'; import { RelationshipsService } from '../relationships/relationships.service';
import { PrismaService } from '../common/prisma.service'; import { AuthGuard } from '../common/auth.guard'; import { CurrentUserId } from '../common/auth-user.decorator';
@Controller('graph') @UseGuards(AuthGuard) export class GraphController { constructor(private relationships: RelationshipsService, private prisma: PrismaService) {} @Get('search') async search(@CurrentUserId() u:string,@Query('q') q:string,@Query('depth') depth?:string){
  const term=(q||'').trim(); if(!term) return [];
  const claims=await this.prisma.personClaim.findMany({where:{userId:u,status:'VERIFIED'},select:{personId:true}});
  if(!claims.length) return [];
  const focus=claims[0].personId; const maxDepth=Math.min(Math.max(Number(depth)||5,1),7);
  const g=await this.relationships.graph(u,focus,maxDepth); const ids=g.nodes.map((x:any)=>x.id);
  return this.prisma.person.findMany({where:{id:{in:ids},names:{some:{fullName:{contains:term,mode:'insensitive'}}}},include:{names:{where:{isPrimary:true},take:1}},take:50});
 } @Get() get(@CurrentUserId() u:string,@Query('focus') focus:string,@Query('depth') depth?:string){ return this.relationships.graph(u,focus,Number(depth||2)); } }
