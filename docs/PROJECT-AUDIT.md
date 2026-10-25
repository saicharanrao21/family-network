# Source Audit — Family Network

**Audit scope:** current checkout at base commit `b729310` plus the implementation changes in this sprint. This is a source and test-evidence audit, not a complete security review or production certification.

## Architecture observed

- `backend/`: NestJS HTTP API, Prisma ORM, PostgreSQL schema/migration, module-level auth/family/relationships/archive/search/admin/subscription services.
- `apps/mobile/`: Flutter/Riverpod application with `go_router`, a Dio API client, graph explorer, family builder, archive, notifications, privacy, and subscription routes.
- `apps/admin/`: dependency-free static HTML operations console backed by authenticated admin API endpoints.
- `.github/workflows/`: backend, release, and mobile automation; a PostgreSQL-backed integration job was added during this sprint.

## High-priority findings resolved in this sprint

1. **Cross-owner relationship writes:** direct relationship, parent-child, and union endpoints could bypass the family-builder ownership gate. The service now rejects linking another account's claimed person; the database-backed API test checks all three routes.
2. **Private graph traversal:** private profile/relationship settings were not consistently enforced in graph/path/search/archive traversal. Private non-owned people now stop traversal and are excluded from discovery and archive person association; the API test checks response records and persisted behavior.
3. **Session handling:** access JWTs are session-bound and guarded against inactive/expired sessions; refresh tokens rotate once, with replay denied. The Flutter API client now shares a refresh across concurrent 401 requests and retries each request once.
4. **Family-space workflow gaps:** family-space creation/listing and invitation revocation were added and connected to the Flutter builder.
5. **Webhook verification/lifecycle:** Stripe validates timestamped raw-body signatures and freshness; Razorpay validates raw-body HMAC. Webhook processing is transactional and retryable; Stripe payment-failure and cancellation states are applied.
6. **Admin moderation:** active-session validation was added to admin authorization, moderation status errors are explicit HTTP 400 responses, and the static console now has resolve/dismiss actions. The API test verifies allowlisting and the persisted moderator identity.

## Evidence

The clean disposable PostgreSQL migration replay, schema parity, backend unit and HTTP integration tests, Flutter analyzer/tests, local Android release build, live API readiness smoke, graph benchmark, and source scan results are recorded in [TEST-RESULTS.md](TEST-RESULTS.md).

## Remaining audit limits

- No full route-by-route security review, external penetration test, device/browser acceptance, iOS build, provider sandbox exercise, or deployment/operations drill was completed.
- Razorpay yearly checkout remains one-time rather than recurring.
- Export/deletion implementation and fulfillment, storage-provider permissions, notification delivery, and complete admin-console operation still require verification.
- The static admin UI is not a substitute for a restricted network boundary, HTTPS, and operational admin account controls.

The current release decision is **BLOCKED**; see [KNOWN-ISSUES.md](KNOWN-ISSUES.md).
