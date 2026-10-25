import { Body, Controller, Delete, Get, Param, Patch, Post, Res, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { PrivacyService } from './privacy.service';
import { CurrentUserId } from '../common/auth-user.decorator';
import { AuthGuard } from '../common/auth.guard';
import { UseGuards } from '@nestjs/common';

@Controller('privacy')
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(private privacy:PrivacyService) {}
  @Get('summary') summary(@CurrentUserId() userId:string){ return this.privacy.privacySummary(userId); }
  @Get('settings') settings(@CurrentUserId() userId:string){ return this.privacy.getSettings(userId); }
  @Patch('settings') update(@CurrentUserId() userId:string,@Body() body:any){ return this.privacy.updateSettings(userId,body); }
  @Get('sessions') sessions(@CurrentUserId() userId:string){ return this.privacy.sessions(userId); }
  @Post('sessions/:id/revoke') revoke(@CurrentUserId() userId:string,@Param('id') id:string){ return this.privacy.revokeSession(userId,id); }
  @Post('export/request') exportRequest(@CurrentUserId() userId:string){ return this.privacy.requestExport(userId); }
  @Get('export') async export(@CurrentUserId() userId:string,@Res({passthrough:true}) res:Response){ const data=await this.privacy.exportData(userId); res.setHeader('Content-Type','application/json'); res.setHeader('Content-Disposition','attachment; filename="family-network-export.json"'); return data; }
  @Post('deletion/request') deletion(@CurrentUserId() userId:string){ return this.privacy.requestDeletion(userId); }
  @Post('deletion/cancel') cancelDeletion(@CurrentUserId() userId:string){ return this.privacy.cancelDeletion(userId); }
}
