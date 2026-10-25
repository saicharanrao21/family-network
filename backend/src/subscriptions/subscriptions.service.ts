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
    const params=new URLSearchParams(); params.set('mode','payment'); params.set('success_url',process.env.STRIPE_SUCCESS_URL||'https://app.example.com/subscription/success?session_id={CHECKOUT_SESSION_ID}'); params.set('cancel_url',process.env.STRIPE_CANCEL_URL||'https://app.example.com/subscription/cancelled'); params.set('line_items[0][price_data][currency]','inr'); params.set('line_items[0][price_data][product_data][name]',plan.name); params.set('line_items[0][price_data][unit_amount]',String(Math.round(plan.priceInr*100))); params.set('line_items[0][price_data][recurring][interval]','year'); params.set('line_items[0][quantity]','1'); params.set('metadata[userId]',userId); params.set('metadata[planCode]',plan.code); if(email) params.set('customer_email',email);
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()}); const body=await r.text(); if(!r.ok) throw new BadRequestException(`Stripe checkout creation failed: ${body.slice(0,300)}`); const session=JSON.parse(body); return {mode:'STRIPE_CHECKOUT',provider:'stripe',plan,sessionId:session.id,url:session.url};
  }

  async cancel(userId:string){const sub=await this.prisma.subscription.findFirst({where:{userId,status:{in:['TRIALING','ACTIVE','PAST_DUE']}},orderBy:{createdAt:'desc'}});if(!sub)throw new BadRequestException('No active subscription');return this.prisma.subscription.update({where:{id:sub.id},data:{cancelAtPeriodEnd:true}});}

  async webhook(provider:string, signature:string|undefined, rawBody:string){
    const secret=provider==='razorpay'?process.env.RAZORPAY_WEBHOOK_SECRET:provider==='stripe'?process.env.STRIPE_WEBHOOK_SECRET:undefined;
    if(!secret) throw new UnauthorizedException('Webhook secret is not configured');
    const expected=createHmac('sha256',secret).update(rawBody).digest('hex'); if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) throw new UnauthorizedException('Invalid webhook signature');
    const payload=JSON.parse(rawBody); const eventId=String(payload.id||payload.event_id||payload.eventId||''); if(!eventId)throw new BadRequestException('Webhook event id is required');
    const existing=await this.prisma.subscriptionEvent.findUnique({where:{externalEventId:eventId}}); if(existing)return {ok:true,duplicate:true,eventId};
    const event=await this.prisma.subscriptionEvent.create({data:{provider,eventType:String(payload.type||payload.event||'unknown'),externalEventId:eventId,verified:true,processed:false,payload}});
    await this.applyWebhook(provider,payload);
    await this.prisma.subscriptionEvent.update({where:{id:event.id},data:{processed:true}});
    return {ok:true,duplicate:false,eventId,processed:true};
  }

  private async applyWebhook(provider:string,p:any){
    if(provider==='stripe'){
      const type=String(p.type||''); const obj=p.data?.object; if(!obj)return;
      const userId=obj.metadata?.userId; const planCode=obj.metadata?.planCode as PlanCode|undefined; if(!userId||!planCode)return;
      if(['checkout.session.completed','invoice.paid','customer.subscription.updated'].includes(type)){
        const external=String(obj.subscription||obj.id); await this.upsertActive(userId,planCode,'stripe',external,obj.current_period_start?new Date(obj.current_period_start*1000):undefined,obj.current_period_end?new Date(obj.current_period_end*1000):undefined);
      } else if(type==='customer.subscription.deleted') await this.deactivateByExternal('stripe',String(obj.id));
    }
    if(provider==='razorpay'){
      const order=p.payload?.order?.entity||p.order?.entity; const payment=p.payload?.payment?.entity||p.payment?.entity; const notes=order?.notes||payment?.notes; const userId=notes?.userId; const planCode=notes?.planCode as PlanCode|undefined; if(!userId||!planCode)return;
      if(['order.paid','payment.captured','subscription.charged'].includes(String(p.event||p.type))) await this.upsertActive(userId,planCode,'razorpay',String(order?.id||payment?.id));
    }
  }
  private async upsertActive(userId:string,planCode:PlanCode,provider:string,externalSubscriptionId:string,start?:Date,end?:Date){const existing=await this.prisma.subscription.findFirst({where:{userId,provider,status:{in:['ACTIVE','TRIALING','PAST_DUE']}}}); const data={provider,externalSubscriptionId,planCode,status:'ACTIVE' as const,currentPeriodStart:start||new Date(),currentPeriodEnd:end,cancelAtPeriodEnd:false}; if(existing)return this.prisma.subscription.update({where:{id:existing.id},data}); return this.prisma.subscription.create({data:{userId,...data}});}
  private async deactivateByExternal(provider:string,externalSubscriptionId:string){return this.prisma.subscription.updateMany({where:{provider,externalSubscriptionId},data:{status:'CANCELED'}});}
}
