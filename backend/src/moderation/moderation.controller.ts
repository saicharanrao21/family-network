import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';
class ReportDto { @IsString() @MaxLength(40) targetType!: string; @IsString() @MaxLength(100) targetId!: string; @IsString() @MaxLength(100) reason!: string; @IsString() @MaxLength(2000) details!: string; }
@Controller('moderation')
@UseGuards(AuthGuard)
export class ModerationController { constructor(private prisma: PrismaService) {} @Post('reports') report(@CurrentUserId() reporterUserId: string, @Body() dto: ReportDto) { return this.prisma.moderationReport.create({ data: { reporterUserId, targetType: dto.targetType, targetId: dto.targetId, reason: dto.reason, details: dto.details } }); } }
