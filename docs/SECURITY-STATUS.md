# Security and Privacy Verification Status

## Status

Targeted security and privacy behavior listed below was exercised by automated tests against a disposable PostgreSQL database and real API routes. This is not a complete security review, penetration test, or declaration that the application is free of vulnerabilities. Release remains blocked; see [FINAL-RELEASE-CHECKLIST.md](FINAL-RELEASE-CHECKLIST.md).

## Verified protections

- The request guard verifies JWTs and requires their referenced database session to remain active and unexpired. The admin authorization path now applies the same active-session check in addition to the configured admin-user allowlist.
- Refresh-token rotation rejects reuse; revoked access sessions fail authorization. OTP codes are random, normalized to the destination, single-use, and attempt-limited.
- Direct API writes cannot attach a person claimed by another account. Branch connection requires the invitation/match workflow and an authorized action.
- Private profiles or private relationship settings are excluded from graph traversal and path/kinship access, search discovery surfaces, surname suggestions, and archive person association for other accounts.
- Archive records are owner-filtered; cross-account archive access and private-person association were tested.
- Invitation ownership/destination/revocation, match-review authorization, and admin moderation authorization are exercised.
- Stripe signature verification uses timestamped raw-body HMAC with a freshness window; Razorpay uses raw-body HMAC. Duplicate webhook events are idempotent and failed processing can be retried.
- The repository source-secret scan passed.

## Not comprehensively verified

- Every route, field, object identifier, role, and admin operation; race conditions beyond exercised refresh/webhook cases; rate limiting and abuse controls.
- Production CORS, secret rotation, token expiry on mobile devices, provider account configuration, upload/storage access controls, and data retention.
- Export/deletion fulfilment, legal retention handling, backup access controls, and restore procedures.
- Dependency and supply-chain review, external penetration testing, and production infrastructure configuration.

Use sandbox accounts and staging infrastructure for the remaining checks. Do not test against production data, charge real payment methods, or send production messages during verification.
