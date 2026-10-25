# TRD — Technical Requirements & Architecture

## Stack
- Flutter mobile/web shell
- NestJS API
- PostgreSQL + Prisma
- Redis + BullMQ
- S3-compatible object storage
- FCM push
- Email provider (SES/SendGrid/etc.)
- SMS/WhatsApp provider through official APIs
- Razorpay + Stripe
- Sentry + structured logs
- PostHog/Firebase Analytics

## Architecture
Start as a modular monolith with strict domain boundaries. Split services only after measured scaling needs.

## Core modules
Auth, Users, Persons, Names, Relationships, Unions, ParentChild, FamilySpaces, Branches, Claims, Identity, Graph, RelationshipEngine, Discovery, Search, Memories, Events, Documents, Evidence, Privacy, Notifications, Subscriptions, Admin, Audit, Health.

## Identity model
User ≠ Person ≠ FamilySpace. person_id is immutable. Names and surnames are attributes.

## Graph model
Canonical edges are stored; derived labels such as cousin/uncle are calculated by RelationshipEngine. Unions model marriage/partnership. Parent-child records support biological/legal/adoptive/step/guardian semantics.

## API principles
- REST first
- DTO validation
- object-level authorization
- pagination and depth limits
- idempotency for writes/webhooks
- correlation IDs
- versioned API
- audit important mutations

## Performance
Never fetch the entire family graph for a screen. Query an authorized subgraph by focus person and depth. Cache expensive relationship/discovery computations. Queue non-critical work.

## Integrity/anomaly detection
Continuous checks:
- impossible self-relationships
- duplicate edges
- contradictory union states
- parent/child date anomalies
- circular parent-child paths
- accidental mass-link creation
- sudden graph expansion
- high duplicate-match rate
- repeated merge/unmerge events
- unauthorized access attempts

Anomalies create admin alerts and preserve evidence; they do not silently modify family data.

## Observability
Sentry for crashes/exceptions, structured application logs, metrics for API latency/error rates/queue depth, product analytics for funnels, audit logs for sensitive mutations.

## Admin counts
Admin dashboard reads from operational metrics plus a daily/hourly aggregate layer. Important counters: total users, active users, claimed people, people, relationships, family spaces, invitations, confirmed connections, subscriptions, MRR, storage, errors, anomaly alerts.

## Messaging
Authentication and transactional messaging only by default. No private inbox synchronization. Providers should be abstracted behind NotificationService with EmailProvider, SmsProvider and WhatsAppProvider adapters.

## Payments
Create subscription order → provider checkout → webhook signature verification → idempotent entitlement update → receipt → audit. Never trust client-side payment success alone.

## Security
JWT + refresh tokens, OTP throttling, RBAC, object authorization, signed media URLs, encryption, audit logs, rate limits, abuse controls, backup/restore and deletion/export workflows.
