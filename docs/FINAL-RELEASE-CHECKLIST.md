# Family Network — Release Gate Checklist

**Status: BLOCKED — do not deploy publicly or publish an app-store release.** Completed items are limited to evidence from this checkout and its disposable test database.

## Completed in this sprint

- [x] Replayed the initial Prisma migration on a clean, disposable PostgreSQL cluster.
- [x] `prisma migrate status` reports the database up to date; Prisma schema diff is empty.
- [x] Backend build, strict typecheck, and all 11 unit/mock tests pass.
- [x] Real HTTP/PostgreSQL two-account family-branch acceptance scenario passes.
- [x] Auth/session/OTP, cross-owner authorization, privacy, family-space/invitation, admin moderation, and signed webhook assertions pass.
- [x] Flutter formatter, analyzer, and all 7 unit/widget/client tests pass.
- [x] Android release APK builds locally.
- [x] API liveness/readiness smoke passes against the disposable database.
- [x] Graph benchmark and source-secret scan pass.

## Must complete before release

- [ ] Run and pass the GitHub Actions workflow, including the PostgreSQL integration job.
- [ ] Install and test the APK on supported Android devices/emulators; verify responsive layout, accessibility, text scale, graph interaction, and runtime errors.
- [ ] Build, sign, install, and test an iOS artifact on macOS.
- [ ] Manually exercise the admin console, including graph scan, anomaly resolution, moderation, and audit display.
- [ ] Validate OAuth, OTP delivery, push/notifications, object storage, and both billing providers in sandbox. Implement and validate Razorpay recurring subscriptions before offering a yearly recurring plan.
- [ ] Validate export/deletion fulfilment and account/session recovery on mobile.
- [ ] Deploy to staging and complete configuration/secrets review, migration rehearsal, backup/restore, rollback, monitoring, and alert-delivery drills.
- [ ] Have the release owner review privacy, security, support, and legal requirements and explicitly approve deployment.

Do not deploy or publish without explicit authorization. Detailed evidence and blockers are in [TEST-RESULTS.md](TEST-RESULTS.md), [KNOWN-ISSUES.md](KNOWN-ISSUES.md), and [FINAL-RELEASE-RUNBOOK.md](FINAL-RELEASE-RUNBOOK.md).
