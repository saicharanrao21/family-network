import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    const token = header?.replace(/^Bearer\s+/i, '');
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new UnauthorizedException('Authentication is not configured');
    if (!token) throw new UnauthorizedException();
    let payload: { sub?: unknown; sid?: unknown; personId?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, { secret });
    } catch { throw new UnauthorizedException('Invalid or expired access token'); }
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
    req.user = {
      userId: payload.sub,
      personId: typeof payload.personId === 'string' ? payload.personId : undefined,
    };
    return true;
  }
}
