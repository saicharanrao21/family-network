import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    const token = header?.replace(/^Bearer\s+/i, '');
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new UnauthorizedException('Authentication is not configured');
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(token, { secret });
      if (!payload?.sub) throw new UnauthorizedException();
      req.user = { userId: payload.sub, personId: payload.personId };
      return true;
    } catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
}
