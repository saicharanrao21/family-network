import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

class CheckoutDto { @IsString() planCode!: string; @IsIn(['razorpay','stripe']) provider!: string; }

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptions: SubscriptionsService) {}
  @Get('plans') plans(){ return this.subscriptions.plans(); }
  @UseGuards(AuthGuard)
  @Get('me') me(@CurrentUserId() userId:string){ return this.subscriptions.current(userId); }
  @UseGuards(AuthGuard)
  @Post('checkout') checkout(@CurrentUserId() userId:string,@Body() dto:CheckoutDto){ return this.subscriptions.checkout(userId,dto.planCode,dto.provider); }
  @UseGuards(AuthGuard)
  @Post('cancel') cancel(@CurrentUserId() userId:string){ return this.subscriptions.cancel(userId); }
  @Post('webhooks/:provider') webhook(@Param('provider') provider:string,@Headers('x-webhook-signature') signature:string|undefined,@Req() req:any){
    const body = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : (typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {}));
    return this.subscriptions.webhook(provider.toLowerCase(),signature,body);
  }
}
