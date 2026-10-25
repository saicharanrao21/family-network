# Test Results — 2026-10-25

## Environment and scope

Checks were run in the Windows checkout on branch `main`, based on `b729310`. Database testing used a disposable PostgreSQL 18 cluster created for this sprint, bound only to `127.0.0.1:55432`, with database `family_network_test`. No production database, data, credentials, charges, or messages were used.

## Passed

| Command/check | Result |
|---|---|
| `npm run build` (backend) | Pass |
| `npm run build:strict` | Pass |
| `npm test` | 11/11 passed: graph algorithms, Nest DI bootstrap, family-space/invitation authorization, and match-candidate cases |
| `npm run test:integration` with the disposable database and test-only JWT secret | 1/1 scenario passed against the real HTTP API and persisted PostgreSQL state |
| `npx prisma migrate deploy` against the empty disposable database | Initial migration applied successfully |
| `npx prisma migrate status` | Database up to date; one initial migration |
| `npx prisma migrate diff --from-url <test DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script --exit-code` | Empty diff |
| `npm run release:smoke` while the API was running | Liveness 200; readiness 200; database reported `ok` |
| `npm run release:check` | Source-secret scan passed |
| `npm run benchmark:graph` | 10,000 nodes; bounded traversal 11.3 ms; 10,000-node path 17.69 ms in the recorded run |
| `dart format --set-exit-if-changed lib/core/api_client.dart lib/features/family/family_builder.dart` | Pass; no changes needed after formatting |
| `flutter analyze` | No issues found |
| `flutter test` | 7/7 passed, including concurrent access-token refresh/retry, logout identity-cache clearing, graph model, API base URL, and home widget tests |
| `flutter build apk --release` | Pass; `apps/mobile/build/app/outputs/flutter-apk/app-release.apk`, 54,601,554 bytes |
| `node --check apps/admin/admin.js` | Pass |
| Admin page in browser | Static page and script loaded; unauthenticated admin request correctly returned 401. Authenticated button workflows were not browser-driven. |
| `git diff --check` | Pass; only Git line-ending notices were printed |

The database-backed scenario covers separate accounts and persisted branches, reviewed invitations and match candidates, graph reachability and non-merging, wrong-owner relationship attempts, private graph/search/archive behavior, family-space membership, invitation revoke/expiry/retry, session and OTP replay protections, admin authorization/moderation resolution, and signed/idempotent/retryable Stripe and Razorpay webhook flows.

## Failed attempts and tooling limitations

- `npm run test:integration` was once invoked without `DATABASE_URL`; it failed fast with the test's required-environment message. It passed when rerun with the disposable loopback URL and test-only JWT secret.
- `npm run release:smoke` was first run before the local API was started and could not connect. It passed after the API was launched against the disposable database.
- A workflow-YAML parse was attempted, but `ConvertFrom-Yaml`, Python, Ruby, and Node YAML packages were unavailable. The workflow was inspected manually; GitHub Actions has not run this workflow in this sprint.
- The APK build emitted a Cupertino icon font warning, but completed successfully. No Android device or emulator was connected, so installation and runtime behavior were not checked.

## Not verified

- iOS build/device acceptance (requires macOS).
- Android installation, responsive layouts, text scaling, accessibility, graph rendering/performance, and end-to-end mobile navigation on devices.
- Browser-executed admin console behavior; only its JavaScript syntax and backing admin API were tested.
- GitHub Actions execution, provider sandboxes, OAuth, OTP delivery, notifications/push, object storage, or real provider failure/retry behavior beyond mocked signed webhook requests.
- Razorpay recurring-subscription behavior; current checkout creates a one-time order for the yearly plan.
- Staging deployment, secret-manager configuration, backups/restores, rollback, monitoring, and operational alert delivery.

See [END-TO-END-STATUS.md](END-TO-END-STATUS.md), [SECURITY-STATUS.md](SECURITY-STATUS.md), and [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for release implications.
