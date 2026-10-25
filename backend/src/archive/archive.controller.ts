import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ArchiveService } from './archive.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';

@Controller('archive')
@UseGuards(AuthGuard)
export class ArchiveController {
  constructor(private service: ArchiveService) {}
  @Get('timeline') timeline(@CurrentUserId() userId:string,@Query('limit') limit?:string){ return this.service.timeline(userId,Number(limit)||100); }
  @Get('overview') overview(@CurrentUserId() userId:string){ return this.service.overview(userId); }
  @Get('memories') memories(@CurrentUserId() userId:string,@Query('limit') limit?:string){ return this.service.listMemories(userId, Number(limit)||50); }
  @Post('memories') createMemory(@CurrentUserId() userId:string,@Body() body:any){ return this.service.createMemory(userId,body); }
  @Put('memories/:id') updateMemory(@CurrentUserId() userId:string,@Param('id') id:string,@Body() body:any){ return this.service.updateMemory(userId,id,body); }
  @Delete('memories/:id') deleteMemory(@CurrentUserId() userId:string,@Param('id') id:string){ return this.service.deleteMemory(userId,id); }
  @Post('memories/:id/assets') addAsset(@CurrentUserId() userId:string,@Param('id') id:string,@Body() body:any){ return this.service.addAsset(userId,id,body); }
  @Get('stories') stories(@CurrentUserId() userId:string,@Query('limit') limit?:string){ return this.service.listStories(userId,Number(limit)||50); }
  @Post('stories') createStory(@CurrentUserId() userId:string,@Body() body:any){ return this.service.createStory(userId,body); }
  @Put('stories/:id') updateStory(@CurrentUserId() userId:string,@Param('id') id:string,@Body() body:any){ return this.service.updateStory(userId,id,body); }
  @Delete('stories/:id') deleteStory(@CurrentUserId() userId:string,@Param('id') id:string){ return this.service.deleteStory(userId,id); }
  @Get('events') events(@CurrentUserId() userId:string,@Query('from') from?:string,@Query('to') to?:string){ return this.service.listEvents(userId,from,to); }
  @Post('events') createEvent(@CurrentUserId() userId:string,@Body() body:any){ return this.service.createEvent(userId,body); }
  @Put('events/:id') updateEvent(@CurrentUserId() userId:string,@Param('id') id:string,@Body() body:any){ return this.service.updateEvent(userId,id,body); }
  @Delete('events/:id') deleteEvent(@CurrentUserId() userId:string,@Param('id') id:string){ return this.service.deleteEvent(userId,id); }
  @Get('documents') documents(@CurrentUserId() userId:string,@Query('limit') limit?:string){ return this.service.listDocuments(userId,Number(limit)||50); }
  @Post('documents') createDocument(@CurrentUserId() userId:string,@Body() body:any){ return this.service.createDocument(userId,body); }
  @Delete('documents/:id') deleteDocument(@CurrentUserId() userId:string,@Param('id') id:string){ return this.service.deleteDocument(userId,id); }
}
