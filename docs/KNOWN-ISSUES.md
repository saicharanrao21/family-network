# Known Issues and Release Blockers

## Release remains blocked

The disposable-database replay, schema comparison, real API acceptance scenario, backend/mobile automated checks, local API readiness smoke, and Android release APK build now pass. These results are not a production deployment or full product release acceptance.

## Remaining blockers

1. **Platform acceptance:** no Android device/emulator was connected, and iOS requires a macOS build agent. Install/run the APK on supported Android devices; build, sign, install, and test iOS on macOS.
2. **CI workflow:** the PostgreSQL-backed GitHub Actions job was added but not executed on GitHub. Workflow parsing could not be automated because no YAML parser was installed. Run the workflow and resolve any CI-specific issues.
3. **Provider integrations:** no sandbox credentials were supplied. Exercise OAuth, email/SMS OTP delivery, notification/push, storage access/failure, billing checkout, and provider retries in their respective sandboxes. Stripe/Razorpay webhook HMAC, duplicate delivery, failed-payment status, and retry behavior were exercised using signed local test events only.
4. **Razorpay recurring plans:** checkout currently creates a one-time order for a yearly plan. Implement Razorpay subscription-plan creation and lifecycle mapping before selling a recurring yearly plan; verify it in sandbox.
5. **Operations:** no staging deployment, backup/restore, migration rollback, monitoring, alert delivery, or incident drill was executed. Follow [FINAL-RELEASE-RUNBOOK.md](FINAL-RELEASE-RUNBOOK.md) in a controlled staging environment and record restore/rollback evidence.
6. **Full product acceptance:** UI/browser/device interaction, accessibility, large graph rendering, network recovery across screens, route-wide authorization/privacy review, and data export/deletion fulfilment are not fully verified. Run the remaining checks in [FINAL-RELEASE-CHECKLIST.md](FINAL-RELEASE-CHECKLIST.md).

## Known implementation caveats

- The admin console now provides anomaly resolution and report resolve/dismiss controls, but those browser interactions have not been manually exercised; the underlying admin API permissions and persisted report resolution passed integration tests.
- Access-token refresh is covered by a Flutter test with concurrent unauthorized requests and a fake HTTP adapter. Live mobile-to-backend refresh, expired refresh-token recovery, and auth-state navigation after final session expiry still need device acceptance.
- The APK build reports that a Cupertino icon font was expected but not found; the release build still completes. Verify all referenced icon families on-device and include the correct asset/package if an icon is missing.

No production database, production credential, charge, message, deployment, or store submission was used.
