# Phase 2 Change Log — Auth + Identity

Implemented:
- Email/password registration and login APIs.
- Short-lived JWT access tokens.
- Hashed refresh-token sessions.
- OTP challenge persistence with expiry and attempt tracking.
- OTP purpose separation: LOGIN, SIGNUP, RECOVERY.
- Provider identity model for PASSWORD, PHONE_OTP, GOOGLE, APPLE.
- Canonical Person creation during signup.
- Verified PersonClaim linking the account to the canonical person.
- Person name variants endpoint.
- Person claim endpoint for future identity-resolution workflows.
- Authenticated Flutter login/register shell.
- Shared API client and persisted token foundation.
- Updated Prisma schema and migration note.

Not yet production-complete:
- Real SMS/WhatsApp/email provider delivery.
- Google/Apple OAuth callback implementation.
- Device/session management UI.
- Full JWT guard/interceptor across every protected endpoint.
- Flutter SDK build in this environment.
- Automated backend dependency installation/build because the environment timed out while installing packages.
