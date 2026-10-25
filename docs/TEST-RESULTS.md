# Test Results

## Passing checks

Executed in the current workspace:

- Backend: `npm ci`
- Prisma: `npx prisma validate` and `npx prisma generate`
- Migration: a single initial SQL migration was generated from the current Prisma schema, and a second Prisma diff produced byte-identical SQL; it has not been applied to a PostgreSQL instance.
- Backend: `npm run build` and `npm run build:strict`
- Backend: `npm test` — 11 passing tests covering graph algorithms, Nest application dependency injection, family invitation authorization/acceptance, and match-candidate behavior
- Backend: `npm run benchmark:graph` — 10,000-node synthetic graph
- Backend: `npm run release:check` — source-secret scan
- Flutter: `dart format --output=none --set-exit-if-changed .`
- Flutter: `flutter analyze`
- Flutter: `flutter test` — 5 passing API URL, graph parsing, and home screen widget tests

See the CI workflows for the corresponding automated checks. Passing these checks does not substitute for database-backed integration or product acceptance tests.

## Failed or blocked checks

- **Android release APK:** default builds failed while compiling `shared_preferences_android` with Kotlin incremental-cache closure/duplicate-registration errors. A clean build after `flutter clean` succeeded with `kotlin.incremental=false`, `kotlin.compiler.execution.strategy=in-process`, and `org.gradle.parallel=false`. The resulting APK is 52.1 MB (SHA-256: `807EC296F64F28B1E86F08D77B294FB4D50917B349962A96740E7ECBD68650E0`). These settings were added to the release workflow; CI has not yet confirmed that workflow, and the APK has not been installed or device-tested.
- **Migration status:** a local attempt with deliberately invalid placeholder test database credentials failed with PostgreSQL authentication error P1000. No migration was applied.
- **API smoke:** no API was listening on the expected local port during the earlier smoke attempt, so it failed to connect. It has not been repeated against a live test database.
- **iOS release:** not run; this workspace is Windows.

## Not run

- Migration replay and resulting-schema comparison against an empty disposable PostgreSQL database (no usable instance or valid test credentials; Docker and PostgreSQL client tools are unavailable)
- Database-backed service/controller tests
- Independent-family-branch connection acceptance
- Device-level Android/iOS, accessibility, and performance acceptance
- Payment, identity, notification, push, and object-storage provider sandbox tests
- Backup/restore and rollback drill

The full release decision is in [FINAL-STATUS.md](FINAL-STATUS.md).
