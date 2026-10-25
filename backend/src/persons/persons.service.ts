import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
@Injectable() export class PersonsService {
 constructor(private prisma:PrismaService){}
 async createSelf(userId:string, name:string){
   const existing=await this.prisma.personClaim.findFirst({where:{userId,status:'VERIFIED'}});
   if(existing) return this.prisma.person.findUnique({where:{id:existing.personId},include:{names:true}});
   const person=await this.prisma.person.create({data:{names:{create:{fullName:name.trim(),nameType:'CURRENT',isPrimary:true}},privacy:{create:{}}}});
   await this.prisma.personClaim.create({data:{personId:person.id,userId,status:'VERIFIED',verificationMethod:'ONBOARDING',verifiedAt:new Date()}});
   return person;
 }
 async addName(userId:string, personId:string, fullName:string, nameType:any){
   const claim=await this.prisma.personClaim.findFirst({where:{userId,personId,status:'VERIFIED'}}); if(!claim) throw new NotFoundException('Person is not claimed by this user');
   return this.prisma.personName.create({data:{personId,fullName:fullName.trim(),nameType}});
 }
 async claim(userId:string,personId:string){
   return this.prisma.personClaim.upsert({where:{personId_userId:{personId,userId}},create:{personId,userId,status:'PENDING',verificationMethod:'USER_CLAIM'},update:{status:'PENDING'}});
 }
}
