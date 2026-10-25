import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
export const CurrentUserId = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  if (!req.user?.userId) throw new UnauthorizedException();
  return req.user.userId as string;
});
