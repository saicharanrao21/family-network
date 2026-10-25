# Project Phase Plan — Evidence-Based Status

Source presence is not equivalent to complete acceptance. The current release gate is **BLOCKED**; see [FINAL-STATUS.md](FINAL-STATUS.md).

1. Foundation and architecture — backend builds and Nest DI bootstrap passes; complete architecture/product acceptance remains outstanding.
2. Authentication and identity — registration/login, OTP, session rotation/revocation, and access guards passed database-backed tests; provider identity delivery and full mobile recovery remain open.
3. Family graph core — graph/path/privacy behavior and persistent branch connectivity passed integration tests; device-scale rendering remains unverified.
4. Relationship engine and explorer — server-side relationship ownership/privacy covered; on-device graph interactions and accessibility not tested.
5. Family builder and branch connection — family spaces, invitations, revocation, human-reviewed candidate handling, and separate branches passed API/database acceptance; UI interaction remains unverified.
6. Search and discovery — alternate-name/search behavior exists; private profile/relationship discovery and surname suggestions received integration assertions; broad discovery quality remains unverified.
7. Memories, stories, events, archive — owner isolation and private-person association tested; storage provider and all archive workflows remain unverified.
8. Admin, moderation, analytics, graph health — admin API allowlist/session checks and persisted report resolution tested; static console browser interaction remains open.
9. Subscriptions and monetization — local signed Stripe/Razorpay webhook events exercise signatures, duplicates, retry, payment failure, and Stripe cancellation; sandbox checkout and Razorpay recurring lifecycle remain open.
10. Notifications and provider integrations — source adapters exist; delivery is not verified against sandbox providers/devices.
11. Privacy, security, and data rights — selected privacy boundaries and audit behavior tested; complete route review, export/deletion fulfilment, retention, and external security testing remain open.
12. Testing, performance, accessibility, reliability — backend/mobile checks and graph microbenchmark pass; CI, device, accessibility, provider, and restore checks remain open.
13. Production release — clean disposable migration and local APK build pass; CI, iOS, staging, operational drills, and release approval remain open.
