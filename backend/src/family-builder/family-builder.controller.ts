import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { FamilyBuilderService } from './family-builder.service';

@Controller('family-builder')
@UseGuards(AuthGuard)
export class FamilyBuilderController {
  constructor(private service: FamilyBuilderService) {}
  @Post('relative') addRelative(@Req() req:any, @Body() body:any) { return this.service.addRelative(req.user.userId, body); }
  @Post('connect') connect(@Req() req:any, @Body() body:any) { return this.service.connectExisting(req.user.userId, body); }
  @Post('family-spaces') createFamilySpace(@Req() req:any, @Body() body:any) { return this.service.createFamilySpace(req.user.userId, body); }
  @Get('family-spaces') familySpaces(@Req() req:any) { return this.service.listFamilySpaces(req.user.userId); }
  @Post('invite') invite(@Req() req:any, @Body() body:any) { return this.service.createInvitation(req.user.userId, body); }
  @Get('invitations') invitations(@Req() req:any) { return this.service.listInvitations(req.user.userId); }
  @Post('invitations/accept') accept(@Req() req:any, @Body() body:any) { return this.service.acceptInvitation(req.user.userId, String(body.token || '')); }
  @Post('invitations/:id/revoke') revoke(@Req() req:any, @Param('id') id:string) { return this.service.revokeInvitation(req.user.userId, id); }
  @Post('matches') createMatch(@Req() req:any, @Body() body:any) { return this.service.createMatchCandidate(req.user.userId, body); }
  @Get('matches') matches(@Req() req:any, @Query('personId') personId:string) { return this.service.listMatchCandidates(req.user.userId, personId); }
  @Post('matches/:id/resolve') resolve(@Req() req:any, @Param('id') id:string, @Body() body:any) { return this.service.resolveMatch(req.user.userId, id, String(body.action || 'DISMISS').toUpperCase() as any); }
}
