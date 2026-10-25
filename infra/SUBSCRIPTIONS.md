# Subscription Architecture

## Plans
FREE: core family graph, basic relationships, basic discovery, limited memory storage, ads.
PLUS: no ads, larger storage, advanced exploration/search/history/exports.
PRO: AI, OCR, genealogy, family vault, advanced history and research.
FAMILY: shared premium family space, branch management, larger storage and admin controls.

## Payment flow
1. User selects plan.
2. Server creates provider order/session.
3. Client opens checkout.
4. Provider sends signed webhook.
5. Server verifies signature and idempotency.
6. Subscription entitlement is updated.
7. Receipt/notification is sent.
8. Audit event recorded.

Never trust only the client-side checkout result.
