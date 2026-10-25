# Phase 13 — Production Release

Status: **NOT RELEASE VERIFIED**

The repository contains production-oriented configuration and release procedures, but source presence is not equivalent to a deployable, tested release. The release gate is blocked by the items below.

## Implemented source/configuration (not a deployment claim)

- Backend production Docker and Compose definitions
- Production environment template and CORS/JWT startup checks
- Health endpoints and release source scan
- Payment webhook and provider adapter boundaries
- GitHub Actions workflows for backend and mobile checks
- PostgreSQL backup/restore scripts and operational runbook

## Outstanding release evidence

- A single initial migration has been generated from the current Prisma schema, but it has not been replayed against an empty PostgreSQL database or compared with the resulting schema.
- No test database migration or database-backed API smoke was completed.
- No independent-branch connection acceptance test was completed.
- Android APK was produced locally after disabling Kotlin incremental compilation and parallel Gradle compilation; the same settings are now applied by the release workflow. CI has not run and the APK has not been installed/device-tested. iOS build was not attempted on macOS.
- Provider sandboxes and production deployment, monitoring, backup/restore, signing, and rollback were not exercised.

The credentials listed in the deployment environment template remain external and must be supplied through secret management. See [FINAL-STATUS.md](FINAL-STATUS.md) and [FINAL-RELEASE-CHECKLIST.md](FINAL-RELEASE-CHECKLIST.md).
