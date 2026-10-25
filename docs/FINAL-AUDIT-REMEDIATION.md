# Audit Remediation and Current Verification

## Status

The earlier source-level compile blockers have been addressed. This document does not certify the product as secure or production-ready. Current executable evidence and outstanding release risks are tracked in [FINAL-STATUS.md](FINAL-STATUS.md).

## Remediations applied

- Normalized and validated the Prisma schema, and generated the Prisma client.
- Replaced unverified JWT payload decoding in person routes with the shared `AuthGuard`.
- Centralized `PrismaService`, `JwtService`, and `AuthGuard` in global Nest modules so feature modules resolve the same dependencies.
- Added a Nest application module-bootstrap test with Prisma isolated from a live database.
- Prevented direct cross-account links to claimed people, enforced family-space invitation permissions and verified destination matching, and made invitation consumption/connection atomic.
- Corrected match-candidate authorization when canonical person ID ordering differs from the party that owns the candidate.
- Made match merges record the candidate ID in the merge audit rather than attempting to update a candidate that is removed by the duplicate-person cascade.
- Corrected backend Prisma JSON/nullability typing and Flutter parsing, API prefix, and compile/analyzer issues.
- Added backend and Flutter dependency lockfiles and updated CI to use reproducible installs.

## Verification

The current checks are listed with exact scope in [TEST-RESULTS.md](TEST-RESULTS.md). They cover compilation, type checking, selected unit/widget tests, module dependency injection, a synthetic graph benchmark, and a source-secret scan. They do not cover a live database, migration replay, full API authorization, provider integrations, the independent-branch acceptance flow, or store builds.

## Security boundary

Only targeted security-related issues were corrected. No comprehensive security review or privacy acceptance audit has been completed. See [SECURITY-STATUS.md](SECURITY-STATUS.md).
