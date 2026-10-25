# Phase 9 — Subscriptions & Monetization

Implemented:
- Fixed plan catalog: FREE / PLUS / PRO / FAMILY.
- Server-side subscription lookup and entitlement calculation.
- Ad/no-ad entitlement.
- Family-space, people and storage limit definitions.
- Authenticated current-subscription endpoint.
- Checkout intent boundary for Razorpay and Stripe.
- Explicit provider-configuration state instead of fake checkout URLs.
- Cancellation-at-period-end endpoint.
- Signed webhook boundary with HMAC verification and idempotent SubscriptionEvent storage.
- Subscription indexes for account/status/period queries.
- Credentials remain deployment-only and are never stored in source.

Not falsely claimed:
- Live Razorpay/Stripe checkout creation requires deployment credentials and provider adapters.
- Live webhook processing requires provider credentials and provider-specific payload mapping.
