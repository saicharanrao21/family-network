# Phase 11 — Privacy, Security & Data Rights

Implemented on the consolidated Phase 1–10 baseline.

## Included
- Per-person privacy controls for discovery/profile/relationship/location visibility.
- Privacy summary API.
- Session inventory and explicit session revocation.
- Portable account-data export request and export endpoint.
- Account deletion request with a 7-day recovery window.
- Deletion cancellation endpoint.
- Privacy audit events.
- Flutter privacy/security screen.
- Prisma migration for privacy requests.

## Safety boundaries
- Privacy settings never automatically alter family relationships.
- Data export is authenticated and scoped to the requesting account and linked family identity.
- Deletion is scheduled rather than destructive immediately, allowing recovery during the grace period.
- Credentials and provider secrets remain excluded.

## Verification note
Static TypeScript validation can be performed where the local toolchain is available. Full Prisma/Flutter dependency-backed validation remains environment-dependent and is documented rather than claimed.
