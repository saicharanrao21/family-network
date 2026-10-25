# Phase 8 — Admin, Moderation, Analytics & Graph Health

Implemented:
- Signed JWT verification for administrator access instead of decoding tokens without signature verification.
- Admin overview metrics: users, people, family spaces, relationships, parent-child links, unions, active subscriptions, open anomalies/reports, DAU and MAU.
- Graph health scanner for self-links, duplicate relationships/unions and confirmed parent-child cycles.
- Persistent `GraphAnomaly` queue with severity, status, evidence and resolution metadata.
- Moderation report storage and authenticated report submission.
- Admin moderation queue and resolution endpoints.
- Audit-log endpoint.
- Lightweight product analytics event collection and aggregation.
- Dependency-free admin console UI.
- Prisma migration for analytics, anomaly and moderation entities.

Safety principle: graph scans surface anomalies for review; they do not silently rewrite family history.
