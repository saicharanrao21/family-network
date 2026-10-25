import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export type PlanCode = 'FREE' | 'PLUS' | 'PRO' | 'FAMILY';
const CATALOG: Record<PlanCode, any> = {
  FREE: { code:'FREE', name:'Build Your Family', priceInr:0, billing:'FREE', ads:true, limits:{familySpaces:1, people:500, storageMb:250}, features:['CORE_GRAPH','PEOPLE_RELATIONSHIPS','INVITES','BASIC_SEARCH','BASIC_MEMORIES'] },
  PLUS: { code:'PLUS', name:'Preserve Your Family', priceInr:799, billing:'YEARLY', ads:false, limits:{familySpaces:3, people:5000, storageMb:5000}, features:['CORE_GRAPH','PEOPLE_RELATIONSHIPS','INVITES','ADVANCED_EXPLORATION','ADVANCED_SEARCH','EXPORTS','MORE_STORAGE','NO_ADS'] },
  PRO: { code:'PRO', name:'Preserve Family History', priceInr:1999, billing:'YEARLY', ads:false, limits:{familySpaces:10, people:25000, storageMb:25000}, features:['ALL_PLUS','AI_FAMILY_ASSISTANT','OCR_RESEARCH','GENEALOGY_TOOLS','EVIDENCE_SOURCES','FAMILY_ARCHIVE','NO_ADS'] },
  FAMILY: { code:'FAMILY', name:'Whole Family', priceInr:2999, billing:'YEARLY', ads:false, limits:{familySpaces:25, people:100000, storageMb:100000}, features:['ALL_PRO','SHARED_PREMIUM_FAMILY_SPACE','BRANCH_ADMINISTRATION','LARGE_STORAGE','FAMILY_MANAGEMENT','NO_ADS'] },
};

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}
  plans() { return Object.values(CATALOG); }
  private normalize(code:string):PlanCode { if (!(code in CATALOG)) throw new BadRequestException('Unknown subscription plan'); return code as PlanCode; }
  async current(userId:string) { const active=await this.prisma.subscription.findFirst({where:{userId,status:{in:['TRIALING','ACTIVE','PAST_DUE']}},orderBy:{createdAt:'desc'}}); const plan=active?CATALOG[this.normalize(active.planCode)]:CATALOG.FREE; return {subscription:active,plan,entitlements:this.entitlements(plan.code)}; }
  entitlements(code:PlanCode) { const plan=CATALOG[code]; return {ads:plan.ads,limits:plan.limits,features:plan.features}; }

  async checkout(userId:string, planCode:string, provider:string) {
    const plan=CATALOG[this.normalize(planCode)]; if(plan.code==='FREE') return {mode:'ACTIVE_FREE',plan,message:'Free plan requires no checkout.'};
    const p=provider.toLowerCase(); if(!['razorpay','stripe'].includes(p)) throw new BadRequestException('Provider must be razorpay or stripe');
    const user=await this.prisma.user.findUnique({where:{id:userId}}); if(!user) throw new BadRequestException('User not found');
    if(p==='razorpay') return this.razorpayCheckout(userId,user.email||undefined,plan);
    return this.stripeCheckout(userId,user.email||undefined,plan);
  }

  private async razorpayCheckout(userId:string,email:string|undefined,plan:any){
    const keyId=process.env.RAZORPAY_KEY_ID, secret=process.env.RAZORPAY_KEY_SECRET;
    if(!keyId||!secret) return {mode:'PROVIDER_CONFIGURATION_REQUIRED',provider:'razorpay',plan,message:'Razorpay credentials must be injected by the deployment secret manager.'};
    const r=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount:Math.round(plan.priceInr*100),currency:'INR',receipt:`fn_${userId}_${Date.now()}`,notes:{userId,planCode:plan.code},partial_payment:false})});
    const body=await r.text(); if(!r.ok) throw new BadRequestException(`Razorpay order creation failed: ${body.slice(0,300)}`); const order=JSON.parse(body);
    return {mode:'RAZORPAY_ORDER',provider:'razorpay',plan,keyId,orderId:order.id,amount:order.amount,currency:order.currency,prefill:{email:email||''}};
  }

  private async stripeCheckout(userId:string,email:string|undefined,plan:any){
    const secret=process.env.STRIPE_SECRET_KEY; if(!secret) return {mode:'PROVIDER_CONFIGURATION_REQUIRED',provider:'stripe',plan,message:'Stripe credentials must be injected by the deployment secret manager.'};
    const params=new URLSearchParams(); params.set('mode','subscription'); params.set('success_url',process.env.STRIPE_SUCCESS_URL||'https://app.example.com/subscription/success?session_id={CHECKOUT_SESSION_ID}'); params.set('cancel_url',process.env.STRIPE_CANCEL_URL||'https://app.example.com/subscription/cancelled'); params.set('line_items[0][price_data][currency]','inr'); params.set('line_items[0][price_data][product_data][name]',plan.name); params.set('line_items[0][price_data][unit_amount]',String(Math.round(plan.priceInr*100))); params.set('line_items[0][price_data][recurring][interval]','year'); params.set('line_items[0][quantity]','1'); params.set('metadata[userId]',userId); params.set('metadata[planCode]',plan.code); if(email) params.set('customer_email',email);
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()}); const body=await r.text(); if(!r.ok) throw new BadRequestException(`Stripe checkout creation failed: ${body.slice(0,300)}`); const session=JSON.parse(body); return {mode:'STRIPE_CHECKOUT',provider:'stripe',plan,sessionId:session.id,url:session.url};
  }

  async cancel(userId:string){const sub=await this.prisma.subscription.findFirst({where:{userId,status:{in:['TRIALING','ACTIVE','PAST_DUE']}},orderBy:{createdAt:'desc'}});if(!sub)throw new BadRequestException('No active subscription');return this.prisma.subscription.update({where:{id:sub.id},data:{cancelAtPeriodEnd:true}});}

  async webhook(provider:string, signature:string|undefined, rawBody:string){
    if (provider !== 'razorpay' && provider !== 'stripe') {
      throw new BadRequestException('Unsupported webhook provider');
    }
    const secret=provider==='razorpay'?process.env.RAZORPAY_WEBHOOK_SECRET:process.env.STRIPE_WEBHOOK_SECRET;
    if(!secret) throw new UnauthorizedException('Webhook secret is not configured');
    this.verifyWebhookSignature(provider, secret, signature, rawBody);
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Webhook body must contain valid JSON');
    }
    const eventId=String(payload.id||payload.event_id||payload.eventId||'');
    if(!eventId)throw new BadRequestException('Webhook event id is required');
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.subscriptionEvent.upsert({
        where: { externalEventId: eventId },
        create: {
          provider,
          eventType: String(payload.type || payload.event || 'unknown'),
          externalEventId: eventId,
          verified: true,
          processed: false,
          payload,
        },
        update: {},
      });
      if (event.processed) return { ok: true, duplicate: true, eventId };
      await this.applyWebhook(provider, payload, tx);
      await tx.subscriptionEvent.update({
        where: { id: event.id },
        data: { processed: true },
      });
      return { ok: true, duplicate: false, eventId, processed: true };
    });
  }

  private verifyWebhookSignature(provider: 'razorpay' | 'stripe', secret: string, signature: string | undefined, rawBody: string) {
    if (!signature) throw new UnauthorizedException('Invalid webhook signature');
    if (provider === 'razorpay') {
      const expected = createHmac('sha256', secret).update(rawBody).digest();
      if (!/^[\da-f]{64}$/i.test(signature)) throw new UnauthorizedException('Invalid webhook signature');
      const supplied = Buffer.from(signature, 'hex');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
      return;
    }

    const fields = signature.split(',').map((part) => part.split('=', 2));
    const timestamp = fields.find(([key]) => key === 't')?.[1];
    const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
    const timestampSeconds = Number(timestamp);
    if (
      !Number.isInteger(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > 300 ||
      !signatures.length
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest();
    const matches = signatures.some((value) => {
      if (!/^[\da-f]{64}$/i.test(value)) return false;
      const supplied = Buffer.from(value, 'hex');
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
    if (!matches) throw new UnauthorizedException('Invalid webhook signature');
  }

  private async applyWebhook(provider:string,p:any, prisma: Pick<PrismaService, 'subscription'> = this.prisma){
    if(provider==='stripe'){
      const type=String(p.type||''); const obj=p.data?.object; if(!obj)return;
      const metadata = obj.metadata || obj.subscription_details?.metadata || {};
      const externalId = String(obj.subscription || obj.id || '');
      if (type === 'invoice.payment_failed') {
        if (externalId) await this.updateStatus('stripe', externalId, 'PAST_DUE', prisma);
        return;
      }
      if (type === 'customer.subscription.deleted') {
        if (externalId) await this.deactivateByExternal('stripe', externalId, prisma);
        return;
      }
      if (type === 'customer.subscription.updated') {
        if (!externalId) return;
        const status = this.stripeStatus(obj.status);
        if (status) {
          await this.updateStatus('stripe', externalId, status, prisma, {
            cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
            ...(obj.current_period_end
              ? { currentPeriodEnd: new Date(obj.current_period_end * 1000) }
              : {}),
          });
        }
        return;
      }
      if (!['checkout.session.completed', 'invoice.paid'].includes(type)) return;
      const userId = metadata.userId;
      const rawPlanCode = metadata.planCode;
      if (typeof userId !== 'string' || !userId || typeof rawPlanCode !== 'string' || !rawPlanCode) return;
      const planCode = this.normalize(rawPlanCode);
      if (externalId) {
        await this.upsertActive(userId,planCode,'stripe',externalId,obj.current_period_start?new Date(obj.current_period_start*1000):undefined,obj.current_period_end?new Date(obj.current_period_end*1000):undefined,prisma);
      }
    }
    if(provider==='razorpay'){
      const order=p.payload?.order?.entity||p.order?.entity; const payment=p.payload?.payment?.entity||p.payment?.entity; const notes=order?.notes||payment?.notes; const userId=notes?.userId; const rawPlanCode=notes?.planCode; if(!userId||!rawPlanCode)return;
      const planCode=this.normalize(rawPlanCode);
      const eventType = String(p.event || p.type);
      if(['order.paid','payment.captured','subscription.charged'].includes(eventType)) {
        const externalId = String(order?.id||payment?.id||'');
        if (!externalId) throw new BadRequestException('Webhook payment/order ID is required');
        await this.upsertActive(userId,planCode,'razorpay',externalId,undefined,undefined,prisma);
      } else if (eventType === 'payment.failed') {
        const externalId = String(order?.id || payment?.order_id || '');
        if (externalId) await this.updateStatus('razorpay', externalId, 'PAST_DUE', prisma);
      }
    }
  }
  private stripeStatus(status: unknown): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | undefined {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'trialing': return 'TRIALING';
      case 'past_due':
      case 'unpaid': return 'PAST_DUE';
      case 'canceled': return 'CANCELED';
      case 'incomplete_expired': return 'EXPIRED';
      default: return undefined;
    }
  }
  private async updateStatus(provider:string,externalSubscriptionId:string,status:'ACTIVE'|'TRIALING'|'PAST_DUE'|'CANCELED'|'EXPIRED',prisma:Pick<PrismaService,'subscription'>=this.prisma, extra:Record<string,unknown>={}){return prisma.subscription.updateMany({where:{provider,externalSubscriptionId},data:{status,...extra}});}
  private async upsertActive(userId:string,planCode:PlanCode,provider:string,externalSubscriptionId:string,start?:Date,end?:Date,prisma: Pick<PrismaService, 'subscription'> = this.prisma){const existing=await prisma.subscription.findFirst({where:{userId,provider,status:{in:['ACTIVE','TRIALING','PAST_DUE']}}}); const data={provider,externalSubscriptionId,planCode,status:'ACTIVE' as const,currentPeriodStart:start||new Date(),currentPeriodEnd:end,cancelAtPeriodEnd:false}; if(existing)return prisma.subscription.update({where:{id:existing.id},data}); return prisma.subscription.create({data:{userId,...data}});}
  private async deactivateByExternal(provider:string,externalSubscriptionId:string,prisma: Pick<PrismaService, 'subscription'> = this.prisma){return prisma.subscription.updateMany({where:{provider,externalSubscriptionId},data:{status:'CANCELED'}});}
}
