# Implementation Plan

## Phase 1 — Foundation (this ZIP)
1. Repository and documentation
2. Flutter app shell/navigation/theme
3. NestJS API shell
4. Prisma schema foundation
5. Health endpoint
6. Auth contract and provider abstraction
7. Admin/observability architecture
8. Subscription and messaging provider contracts
9. Graph integrity/anomaly contract
10. Docker/local infrastructure

## Phase 2 — Auth + Identity — IMPLEMENTED
- Email/password
- phone OTP
- Google/Apple
- refresh sessions
- create self
- person claim
- names and variants
- privacy

## Phase 3 — Graph Core
- parent/child
- siblings
- unions
- multiple marriages
- step/adoption/legal/guardian
- relationship engine

## Phase 4 — Graph UX
- tree
- network
- focus person
- progressive expansion
- relationship path UI

## Phase 5 — Identity Resolution
- candidate matching
- duplicate review
- merge/unmerge
- evidence

## Phase 6 — Family Spaces + Discovery
- invitations
- branches
- roles
- privacy-safe discovery

## Phase 7 — Memories + Events
- media
- timeline
- stories
- documents

## Phase 8 — Search + History
- fuzzy search
- relationship search
- sources/evidence
- map/timeline

## Phase 9 — Billing + Monetization
- Free/Plus/Pro/Family entitlements
- Razorpay
- Stripe
- webhooks
- invoices/receipts
- ads abstraction

## Phase 10 — AI/Genealogy
- OCR
- transcription
- AI assistant
- GEDCOM
- family book

## Phase 11 — Production Hardening
- load tests
- security tests
- graph integrity stress tests
- backup/restore
- observability dashboards
- app store release

## Definition of done per phase
- code implemented
- tests added
- migration updated
- API documented
- UI wired to real API where applicable
- error states handled
- audit/privacy reviewed
- build/CI passes in Flutter + Node environments
- consolidated ZIP produced
