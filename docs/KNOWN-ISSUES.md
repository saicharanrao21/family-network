# Known Issues and Release Blockers

## 1. Initial migration not replay-tested

The incomplete incremental migration history was replaced with a single initial migration generated from the current Prisma schema. It contains the current schema's 35 tables and 25 enum types, and Prisma schema validation/client generation pass. The migration has not been applied to PostgreSQL or compared against the resulting database schema because no usable disposable instance and valid test credentials were available; Docker and PostgreSQL client tools are not installed in this workspace.

**Required resolution:** apply the baseline to an empty disposable PostgreSQL database, then compare that database to `schema.prisma` and check `prisma migrate status`. Do not mark migrations applied against a real database.

## 2. No database-backed API verification

No valid test database credentials were provided. Migration status failed with P1000 using deliberately invalid test credentials; no migrations were applied. The API health, auth, and data routes therefore have not been verified against PostgreSQL.

## 3. Branch-connection acceptance is unverified

No database-backed end-to-end test demonstrates two independently created branches being connected through a reviewed identity match while preserving both branches and honoring privacy controls. The current suite includes mock-based checks for invitation acceptance, foreign-owner link denial, family-space authorization, destination binding, and match-candidate ownership; graph state and persistence are not exercised against PostgreSQL.

## 4. Android artifact needs CI/device verification

The default Android build failed in Kotlin incremental-cache handling in `shared_preferences_android`. A local build succeeded after disabling Kotlin incremental compilation and Gradle parallelism and using the in-process compiler. These settings are now in the release workflow, but CI has not yet run and the APK has not been installed or device-tested.

## 5. iOS and external providers unverified

iOS builds require macOS and were not run. Payment, OAuth, email/SMS/WhatsApp, push, and object-storage adapters have not been validated against sandbox accounts.

## 6. Security/privacy acceptance incomplete

Targeted authorization and dependency-injection remediations are in place, but route-by-route object authorization, privacy-field filtering, export/delete completion, and full security testing are not demonstrated. Do not interpret the source-secret scan as a vulnerability assessment.

See [TEST-RESULTS.md](TEST-RESULTS.md), [END-TO-END-STATUS.md](END-TO-END-STATUS.md), and [SECURITY-STATUS.md](SECURITY-STATUS.md).
