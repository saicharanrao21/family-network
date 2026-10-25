import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';

class TrackDto {
  @IsString()
  @MaxLength(100)
  eventName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  platform?: string;

  @IsOptional()
  @IsObject()
  properties?: Prisma.InputJsonObject;
}

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private prisma: PrismaService) {}

  @Post('events')
  track(@CurrentUserId() userId: string, @Body() dto: TrackDto) {
    return this.prisma.analyticsEvent.create({
      data: {
        userId,
        eventName: dto.eventName,
        platform: dto.platform,
        properties: dto.properties,
      },
    });
  }
}
