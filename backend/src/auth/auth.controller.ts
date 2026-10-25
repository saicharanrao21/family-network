import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
@Controller('auth')
export class AuthController {
  constructor(private auth:AuthService){}
  @Post('register') register(@Body() body:any){return this.auth.register(body)}
  @Post('login') login(@Body() body:any){return this.auth.login(body)}
  @Post('otp/request') request(@Body() body:any){return this.auth.requestOtp(body.destination,body.purpose||'LOGIN')}
  @Post('otp/verify') verify(@Body() body:any){return this.auth.verifyOtp(body.destination,body.code,body.purpose||'LOGIN')}
  @Post('refresh') refresh(@Body() body:any){return this.auth.refresh(body.refreshToken)}
  @Get('me') async me(@Headers('authorization') auth:string){ const token=auth?.replace(/^Bearer\s+/i,''); if(!token) throw new UnauthorizedException(); return this.auth.meFromAccessToken(token); }
}
