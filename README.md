# Family Network

A privacy-first, living family network for discovering, connecting and preserving family relationships across generations.

## Current status
**Engineering verification in progress — not release certified.**

### Core experience
- Build from yourself and expand indefinitely.
- Search any person or relationship path.
- Connect independent family branches when people independently join.
- Support different surnames, name variants, maiden/married names and transliterations.
- Support multiple marriages, half-siblings, adoption, step-family and guardianship.
- Explore the graph with a movable, zoomable family universe.

### Repository
- `apps/mobile` — Flutter client
- `backend` — NestJS + Prisma API
- `docs` — product, architecture, UX and release documents
- `infra` — Docker, messaging, subscriptions and observability notes

## Run backend
```bash
cd backend
npm ci
npx prisma generate
npm run build
npm run start:dev
```

## Run Flutter
Requires Flutter 3.33+.
```bash
cd apps/mobile
flutter pub get
flutter run
```

## Important
No production credentials are included. Configure `.env` from `.env.example` and provider credentials in the deployment secret manager. The checked-in Prisma migration history, clean-database setup, live API, independent-branch acceptance flow, and mobile release artifacts still require verification; see the status documents below.

See `docs/FINAL-ARCHITECTURE.md` and `docs/FINAL-RELEASE-CHECKLIST.md`.

## Verification status

Backend and Flutter static checks and automated tests have passed in the current workspace. That does not establish deployment readiness: a disposable PostgreSQL migration run, live API smoke, independent-branch end-to-end acceptance, and store release builds are still outstanding.

See [docs/FINAL-STATUS.md](docs/FINAL-STATUS.md), [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md), [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md), and [docs/FINAL-RELEASE-RUNBOOK.md](docs/FINAL-RELEASE-RUNBOOK.md).
