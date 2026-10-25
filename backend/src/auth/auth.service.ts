import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
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
    const existing = await this.prisma.user.findFirst({ where:{ OR:[...(email?[{email}]:[]), ...(phone?[{phone}]:[])] } });
    if (existing) throw new BadRequestException('An account already exists for these credentials');
    const user = await this.prisma.user.create({ data:{ email, phone, passwordHash: input.password ? await bcrypt.hash(input.password,12) : undefined } });
    const person = await this.prisma.person.create({ data:{ names:{create:{fullName:input.name.trim(),nameType:'CURRENT',isPrimary:true}}, privacy:{create:{}} } });
    await this.prisma.personClaim.create({ data:{personId:person.id,userId:user.id,status:'VERIFIED',verificationMethod:'ACCOUNT_CREATED',verifiedAt:new Date()} });
    return this.issueTokens(user.id, person.id);
  }

  async login(input:{email?:string; phone?:string; password?:string}) {
    const user = await this.prisma.user.findFirst({where: input.email ? {email:input.email.trim().toLowerCase()} : {phone:input.phone?.trim()}});
    if (!user || !user.passwordHash || !input.password || !(await bcrypt.compare(input.password,user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    const claim = await this.prisma.personClaim.findFirst({where:{userId:user.id,status:'VERIFIED'}});
    return this.issueTokens(user.id, claim?.personId);
  }

  async requestOtp(destination:string, purpose:'LOGIN'|'SIGNUP'|'RECOVERY') {
    const code = String(Math.floor(100000 + Math.random()*900000));
    const hash = await bcrypt.hash(code,10);
    const expiresAt = new Date(Date.now()+5*60*1000);
    const user = await this.prisma.user.findFirst({where: destination.includes('@') ? {email:destination.toLowerCase()} : {phone:destination}});
    await this.prisma.otpChallenge.create({data:{destination, purpose, codeHash:hash, expiresAt, userId:user?.id}});
    const response:any = {message:'OTP generated. Deliver through the configured SMS/WhatsApp/email provider.'};
    if (destination.includes('@')) {
      if (user) await this.notifications.send({userId:user.id,type:'OTP',title:'Your Family Network verification code',body:`Your verification code is ${code}. It expires in 5 minutes.`,channels:['EMAIL']});
    } else if (user) {
      const channel = process.env.OTP_CHANNEL === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';
      await this.notifications.send({userId:user.id,type:'OTP',title:'Family Network verification code',body:`Your verification code is ${code}. It expires in 5 minutes.`,channels:[channel as any]});
    }
    if (process.env.NODE_ENV !== 'production') response.developmentCode = code;
    return response;
  }

  async verifyOtp(destination:string, code:string, purpose:'LOGIN'|'SIGNUP'|'RECOVERY') {
    const challenge = await this.prisma.otpChallenge.findFirst({where:{destination,purpose,consumedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:'desc'}});
    if (!challenge || challenge.attempts >= 5 || !(await bcrypt.compare(code,challenge.codeHash))) {
      if (challenge) await this.prisma.otpChallenge.update({where:{id:challenge.id},data:{attempts:{increment:1}}});
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.prisma.otpChallenge.update({where:{id:challenge.id},data:{consumedAt:new Date()}});
    let user = challenge.userId ? await this.prisma.user.findUnique({where:{id:challenge.userId}}) : null;
    if (!user && purpose === 'SIGNUP') user = await this.prisma.user.create({data: destination.includes('@') ? {email:destination,emailVerifiedAt:new Date()} : {phone:destination,phoneVerifiedAt:new Date()}});
    if (!user) throw new UnauthorizedException('Account not found');
    if (destination.includes('@')) await this.prisma.user.update({where:{id:user.id},data:{emailVerifiedAt:new Date()}}); else await this.prisma.user.update({where:{id:user.id},data:{phoneVerifiedAt:new Date()}});
    const claim = await this.prisma.personClaim.findFirst({where:{userId:user.id,status:'VERIFIED'}});
    return this.issueTokens(user.id, claim?.personId);
  }

  async issueTokens(userId:string, personId?:string) {
    const accessToken = await this.jwt.signAsync({sub:userId,personId}, {secret:this.accessSecret,expiresIn:'15m'});
    const rawRefresh = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(rawRefresh,10);
    const expiresAt = new Date(Date.now()+this.refreshDays*86400000);
    await this.prisma.session.create({data:{userId,refreshTokenHash,expiresAt,lastUsedAt:new Date()}});
    return {accessToken,refreshToken:rawRefresh,expiresAt:expiresAt.toISOString(),userId,personId};
  }

  async refresh(refreshToken:string) {
    const sessions = await this.prisma.session.findMany({where:{status:'ACTIVE',expiresAt:{gt:new Date()}}});
    for (const session of sessions) if (await bcrypt.compare(refreshToken,session.refreshTokenHash)) {
      const claim = await this.prisma.personClaim.findFirst({where:{userId:session.userId,status:'VERIFIED'}});
      await this.prisma.session.update({where:{id:session.id},data:{lastUsedAt:new Date()}});
      return this.issueTokens(session.userId,claim?.personId);
    }
    throw new UnauthorizedException('Invalid refresh token');
  }

  async meFromAccessToken(token:string) { const payload:any = await this.jwt.verifyAsync(token,{secret:this.accessSecret}); return this.me(payload.sub); }

  async me(userId:string) {
    return this.prisma.user.findUnique({where:{id:userId},include:{claims:{where:{status:'VERIFIED'},include:{person:{include:{names:true,privacy:true}}}}}});
  }
}
