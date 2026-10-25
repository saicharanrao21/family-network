# Family Network — Release Gate Checklist

**Status: BLOCKED — do not publish or deploy.** A checked item means the check was executed successfully in this workspace; it is not a claim of production readiness.

## Completed checks

- [x] Prisma schema validation and client generation
- [x] Single initial migration generated from the current schema (clean replay still unverified)
- [x] Backend build and strict TypeScript check
- [x] Backend automated tests, including Nest module dependency-injection bootstrap
- [x] Mock-based invitation, ownership, destination, and match-candidate regression tests
- [x] Flutter format check and static analysis
- [x] Flutter unit and widget tests
- [x] Android release APK produced locally with stable Kotlin compiler settings
- [x] 10,000-node graph benchmark
- [x] Release source-secret scan
- [x] Credentials and signing keys excluded from repository

## Required before release

- [ ] Apply the initial migration to an empty disposable PostgreSQL database and verify the resulting schema matches Prisma.
- [ ] Confirm `prisma migrate status` reports no pending migrations on that database.
- [ ] Start the API against the test database and pass liveness, readiness, authentication, and authorization smoke tests.
- [ ] Run the two-independent-branches connection acceptance flow, including human review of match candidates and privacy checks.
- [ ] Add database-backed integration coverage for branch connection, invitation acceptance, authorization, and privacy boundaries.
- [ ] Verify Android release workflow in CI; inspect and install the APK on supported devices.
- [ ] Produce and inspect an iOS release artifact on macOS.
- [ ] Validate provider sandboxes, signed webhook handling, object storage, backup/restore, and operational alerts.
- [ ] Complete accessibility and device-level acceptance on supported screen sizes.
- [ ] Review deployment secrets, origin allowlists, signing, rollback, and restore procedures with the release owner.

Deployment procedures in [FINAL-RELEASE-RUNBOOK.md](FINAL-RELEASE-RUNBOOK.md) are instructions only; they have not been executed against production.
