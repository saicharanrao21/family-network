import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';
@Controller('relationships') @UseGuards(AuthGuard)
export class RelationshipsController {
 constructor(private service: RelationshipsService) {}
 @Post() create(@CurrentUserId() u:string,@Body() b:any){return this.service.createRelationship(u,b)}
 @Post('parent-child') parentChild(@CurrentUserId() u:string,@Body() b:any){return this.service.createParentChild(u,b)}
 @Post('union') union(@CurrentUserId() u:string,@Body() b:any){return this.service.createUnion(u,b)}
 @Post(':id/confirm') confirm(@CurrentUserId() u:string,@Param('id') id:string){return this.service.confirmRelationship(u,id)}
 @Post('parent-child/:id/confirm') confirmPC(@CurrentUserId() u:string,@Param('id') id:string){return this.service.confirmParentChild(u,id)}
 @Get('path') path(@CurrentUserId() u:string,@Query('from') a:string,@Query('to') b:string){return this.service.related(u,a,b)}
 @Get('kinship') kinship(@CurrentUserId() u:string,@Query('from') a:string,@Query('to') b:string){return this.service.kinship(u,a,b)}
}
