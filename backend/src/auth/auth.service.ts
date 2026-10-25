import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private notifications: NotificationsService) {}
  private get accessSecret() { const secret = process.env.JWT_ACCESS_SECRET; if (!secret) throw new UnauthorizedException('Authentication is not configured'); return secret; }
  private refreshDays = 30;

  async register(input:{email?:string; phone?:string; password?:string; name:string}) {
    if (!input.email && !input.phone) throw new BadRequestException('Email or phone is required');
    if (input.email && !input.password) throw new BadRequestException('Password is required for email registration');
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new BadRequestException('Name is required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('A valid email address is required');
    if (input.password && input.password.length < 8) throw new BadRequestException('Password must contain at least 8 characters');
    const existing = await this.prisma.user.findFirst({ where:{ OR:[...(email?[{email}]:[]), ...(phone?[{phone}]:[])] } });
    if (existing) throw new BadRequestException('An account already exists for these credentials');
    const passwordHash = input.password ? await bcrypt.hash(input.password,12) : undefined;
    const identity = await this.prisma.$transaction(async tx => {
      const user = await tx.user.create({ data:{ email, phone, passwordHash } });
      const person = await tx.person.create({ data:{ names:{create:{fullName:name,nameType:'CURRENT',isPrimary:true}}, privacy:{create:{}} } });
      await tx.personClaim.create({ data:{personId:person.id,userId:user.id,status:'VERIFIED',verificationMethod:'ACCOUNT_CREATED',verifiedAt:new Date()} });
      return { userId: user.id, personId: person.id };
    });
    return this.issueTokens(identity.userId, identity.personId);
  }

  async login(input:{email?:string; phone?:string; password?:string}) {
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    if ((!email && !phone) || (email && phone)) throw new UnauthorizedException('Invalid credentials');
    const user = await this.prisma.user.findFirst({where: email ? {email} : {phone}});
    if (!user || !user.passwordHash || !input.password || !(await bcrypt.compare(input.password,user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    const claim = await this.prisma.personClaim.findFirst({where:{userId:user.id,status:'VERIFIED'}});
    return this.issueTokens(user.id, claim?.personId);
  }

  async requestOtp(destination:string, purpose:'LOGIN'|'SIGNUP'|'RECOVERY') {
    const normalized = destination?.trim().includes('@') ? destination.trim().toLowerCase() : destination?.trim();
    if (!normalized) throw new BadRequestException('OTP destination is required');
    if (!['LOGIN','SIGNUP','RECOVERY'].includes(purpose)) throw new BadRequestException('Invalid OTP purpose');
    const code = String(randomInt(100000,1000000));
    const hash = await bcrypt.hash(code,10);
    const expiresAt = new Date(Date.now()+5*60*1000);
    const user = await this.prisma.user.findFirst({where: normalized.includes('@') ? {email:normalized} : {phone:normalized}});
    await this.prisma.otpChallenge.create({data:{destination:normalized, purpose, codeHash:hash, expiresAt, userId:user?.id}});
    const response:any = {message:'OTP generated. Deliver through the configured SMS/WhatsApp/email provider.'};
    if (normalized.includes('@')) {
      if (user) await this.notifications.send({userId:user.id,type:'OTP',title:'Your Family Network verification code',body:`Your verification code is ${code}. It expires in 5 minutes.`,channels:['EMAIL']});
    } else if (user) {
      const channel = process.env.OTP_CHANNEL === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';
      await this.notifications.send({userId:user.id,type:'OTP',title:'Family Network verification code',body:`Your verification code is ${code}. It expires in 5 minutes.`,channels:[channel as any]});
    }
    if (process.env.NODE_ENV !== 'production') response.developmentCode = code;
    return response;
  }

  async verifyOtp(destination:string, code:string, purpose:'LOGIN'|'SIGNUP'|'RECOVERY') {
    const normalized = destination?.trim().includes('@') ? destination.trim().toLowerCase() : destination?.trim();
    if (!normalized || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const challenge = await this.prisma.otpChallenge.findFirst({where:{destination:normalized,purpose,consumedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:'desc'}});
    if (!challenge) throw new UnauthorizedException('Invalid or expired OTP');
    const attempt = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count !== 1 || !(await bcrypt.compare(code,challenge.codeHash))) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('Invalid or expired OTP');
    let user = challenge.userId ? await this.prisma.user.findUnique({where:{id:challenge.userId}}) : null;
    if (!user && purpose === 'SIGNUP') user = await this.prisma.user.create({data: normalized.includes('@') ? {email:normalized,emailVerifiedAt:new Date()} : {phone:normalized,phoneVerifiedAt:new Date()}});
    if (!user) throw new UnauthorizedException('Account not found');
    if (normalized.includes('@')) await this.prisma.user.update({where:{id:user.id},data:{emailVerifiedAt:new Date()}}); else await this.prisma.user.update({where:{id:user.id},data:{phoneVerifiedAt:new Date()}});
    const claim = await this.prisma.personClaim.findFirst({where:{userId:user.id,status:'VERIFIED'}});
    return this.issueTokens(user.id, claim?.personId);
  }

  async issueTokens(userId:string, personId?:string) {
    const sessionId = randomBytes(24).toString('hex');
    const refreshToken = `${sessionId}.${randomBytes(48).toString('hex')}`;
    const refreshTokenHash = await bcrypt.hash(refreshToken,10);
    const expiresAt = new Date(Date.now()+this.refreshDays*86400000);
    const accessToken = await this.jwt.signAsync({sub:userId,personId,sid:sessionId}, {secret:this.accessSecret,expiresIn:'15m'});
    await this.prisma.session.create({data:{id:sessionId,userId,refreshTokenHash,expiresAt,lastUsedAt:new Date()}});
    return {accessToken,refreshToken,expiresAt:expiresAt.toISOString(),userId,personId};
  }

  async refresh(refreshToken:string) {
    const separator = typeof refreshToken === 'string' ? refreshToken.indexOf('.') : -1;
    if (separator <= 0 || separator === refreshToken.length - 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const sessionId = refreshToken.slice(0, separator);
    const now = new Date();
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, status: 'ACTIVE', expiresAt: { gt: now } },
    });
    if (!session || !(await bcrypt.compare(refreshToken, session.refreshTokenHash))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const claim = await this.prisma.personClaim.findFirst({where:{userId:session.userId,status:'VERIFIED'}});
    const nextSessionId = randomBytes(24).toString('hex');
    const nextRefreshToken = `${nextSessionId}.${randomBytes(48).toString('hex')}`;
    const nextRefreshTokenHash = await bcrypt.hash(nextRefreshToken,10);
    const expiresAt = new Date(Date.now()+this.refreshDays*86400000);
    const accessToken = await this.jwt.signAsync({sub:session.userId,personId:claim?.personId,sid:nextSessionId}, {secret:this.accessSecret,expiresIn:'15m'});
    await this.prisma.$transaction(async tx => {
      const revoked = await tx.session.updateMany({
        where: { id: session.id, status: 'ACTIVE', expiresAt: { gt: now } },
        data: { status: 'REVOKED', revokedAt: now, lastUsedAt: now },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Invalid refresh token');
      await tx.session.create({
        data: { id: nextSessionId, userId: session.userId, refreshTokenHash: nextRefreshTokenHash, expiresAt, lastUsedAt: now },
      });
    });
    return {accessToken,refreshToken:nextRefreshToken,expiresAt:expiresAt.toISOString(),userId:session.userId,personId:claim?.personId};
  }

  async meFromAccessToken(token:string) {
    let payload: { sub?: unknown; sid?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.accessSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw new UnauthorizedException('Invalid or expired access token');
    return this.me(payload.sub);
  }

  async me(userId:string) {
    return this.prisma.user.findUnique({where:{id:userId},include:{claims:{where:{status:'VERIFIED'},include:{person:{include:{names:true,privacy:true}}}}}});
  }
}
