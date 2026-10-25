# Family Network 1.0 — Release Runbook

> **Release gate: BLOCKED.** This runbook has not been executed against staging or production. Do not deploy publicly or publish an app-store release without explicit release-owner approval.

## 0. Verify evidence and blockers

Review [FINAL-STATUS.md](FINAL-STATUS.md), [FINAL-RELEASE-CHECKLIST.md](FINAL-RELEASE-CHECKLIST.md), [KNOWN-ISSUES.md](KNOWN-ISSUES.md), and [SECURITY-STATUS.md](SECURITY-STATUS.md). The clean migration replay and API acceptance have passed on a disposable local database; provider sandboxes, devices, CI, staging operations, backup/restore, and iOS remain outstanding.

## 1. Repeat the isolated database acceptance locally

Use a new disposable PostgreSQL database and test-only credentials. Never point this test at production or at a database containing valuable data.

```powershell
Set-Location backend
$env:DATABASE_URL = '<loopback disposable database URL with database name family_network_test>'
npx prisma migrate deploy
npx prisma migrate status
npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script --exit-code
$env:JWT_ACCESS_SECRET = '<ephemeral test-only secret>'
npm run build
npm run test:integration
```

The integration test intentionally rejects non-loopback hosts and any database name other than `family_network_test`.

## 2. Provision staging

1. Create isolated PostgreSQL and Redis resources and verify connectivity.
2. Create object storage with least-privilege upload/download policies.
3. Configure sandbox accounts for OAuth, email/SMS, push, Stripe, and Razorpay.
4. Create Android/iOS signing assets.
5. Store secrets in the deployment secret manager only; never add credentials to Git, client builds, or static admin files.

## 3. Configure and migrate staging

Configure all required settings from `backend/.env.production.example`; set exact CORS origins, strong independent JWT secrets, provider webhook secrets, and production URLs. Review environment values with a second operator.

Before migrations, take a restorable backup and rehearse recovery in a separate environment. Apply migrations with the deployment identity:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Verify migration status and readiness before routing traffic.

## 4. Deploy and smoke-test staging

Use the reviewed deployment pipeline and immutable image, not an unreviewed local build. Example compose invocation:

```bash
docker compose -f infra/docker-compose.production.yml up -d --build
```

Check:

```bash
curl -f https://api.example.com/api/v1/health/live
curl -f https://api.example.com/api/v1/health/ready
```

Then test registration/login/refresh/revocation, relationships and invitations, private profile controls, archive permissions, admin moderation, sandbox billing webhooks, notifications, export/deletion, and recovery from provider/network failures.

## 5. Mobile and admin verification

Install the signed Android and iOS release builds on supported devices. Verify authentication recovery, critical navigation/forms, accessibility/text scaling, family graph performance, and offline/network error recovery. Exercise the static admin console behind HTTPS and a restricted network boundary; verify admin allowlisting and audit trails.

## 6. Operations and rollback

Before launch, complete a restore drill, validate migration rollback strategy, confirm monitoring and alert delivery, and record named on-call ownership. On an incident:

1. Stop or shift traffic away from the affected release.
2. Roll back to the previous immutable API/mobile artifact where supported.
3. Restore a database backup only if the approved recovery plan requires it; account for irreversible schema/data changes.
4. Re-run readiness, smoke, and data-integrity checks before restoring traffic.

No deployment, backup/restore, rollback, or public release has been executed in this sprint.
