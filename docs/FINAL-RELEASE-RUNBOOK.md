# Family Network 1.0 — Release Runbook

> **Release gate:** This runbook has not been executed against a deployment. The release is currently blocked. Do not run database deployment commands against production until the migration chain has been reviewed, replayed successfully against a disposable database, and approved with a recovery plan.

## 0. Verify the release gate

Review `FINAL-STATUS.md`, `KNOWN-ISSUES.md`, and `FINAL-RELEASE-CHECKLIST.md`. In particular, replay the checked-in initial migration against an empty disposable PostgreSQL database and verify the resulting schema before provisioning production. That replay has not yet been performed.

## 1. Provision

1. Create production PostgreSQL and Redis.
2. Create object storage for archive media.
3. Create provider accounts for email/SMS/WhatsApp/push and billing.
4. Create Google/Apple OAuth applications.
5. Create Android/iOS signing assets.
6. Put secrets in the deployment secret manager, never in Git.

## 2. Configure

Copy `backend/.env.production.example` to the deployment environment and set every required value. Set `CORS_ORIGINS` to the exact production web origins.

## 3. Database

Only after the release gate above is cleared, run Prisma migrations before starting the new API version:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Take a backup before migrations and verify restore procedures periodically using `scripts/backup/`.

## 4. Deploy API

```bash
docker compose -f infra/docker-compose.production.yml up -d --build
```

Check:

```bash
curl -f https://api.example.com/api/v1/health/live
curl -f https://api.example.com/api/v1/health/ready
```

## 5. Deploy mobile

The GitHub release workflow builds Android and an unsigned iOS release. Inject signing credentials only in CI secret storage.

## 6. Verify

- Register/login/refresh
- Add and confirm relationships
- Search alternate names
- Expand and navigate a large family graph
- Upload/archive flows with production object storage
- Notification delivery
- Billing checkout and signed webhooks
- Privacy export/delete requests
- Admin graph scan/moderation
- Backup and restore drill
- Crash/health alerts

## 7. Rollback

1. Stop traffic to the new API.
2. Roll back to the previous immutable image.
3. Restore the database only if a migration/data change requires it and the rollback plan has been validated.
4. Re-run liveness/readiness and smoke checks.
