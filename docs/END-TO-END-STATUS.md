# End-to-End Acceptance Status

**Database-backed branch acceptance: PASS for the automated API scenario. Full release acceptance: INCOMPLETE.**

The test is `backend/test/api.integration.test.cjs`. It starts the Nest application and calls its HTTP routes while Prisma assertions inspect persisted PostgreSQL state. It is restricted to a loopback database named exactly `family_network_test`.

## Verified in the automated scenario

1. Separate accounts create and persist their own people and branch records.
2. No cross-branch path exists before a connection is accepted.
3. Direct cross-owner relationship, parent-child, and union writes are rejected.
4. A match candidate cannot be resolved by an unrelated account; resolution remains an explicit human action.
5. Invitation acceptance records the destination account and family-space membership, connects the branches, and makes the expected graph path reachable without merging distinct people.
6. Private graph nodes and paths are hidden; people search, relationship-target search, surname suggestions, archive reads, and attempts to tag a private person are checked.
7. Family-space owner authorization, invitation revocation, expiry, replay, and retry are checked against persisted records.
8. Session refresh replay/revocation and OTP replay/attempt limits are exercised.
9. Admin access is limited to the configured admin user and active session; moderation resolution is persisted with its reviewer.
10. Local signed webhook events cover Razorpay/Stripe signatures, duplicates, recoverable processing failures, failed-payment status, and Stripe cancellation.

Run locally only with the dedicated disposable database:

```powershell
$env:DATABASE_URL = 'postgresql://family_network_test@127.0.0.1:55432/family_network_test?schema=public'
$env:JWT_ACCESS_SECRET = 'integration-only-secret-not-used-outside-the-test-process'
Set-Location backend
npm run test:integration
```

Migration replay/status/schema diff passed separately on that disposable cluster. No production data or credentials were used.

## Acceptance not covered

The scenario does not constitute a full mobile/browser/UI acceptance test, a provider sandbox test, a complete route-by-route security review, or an operational staging deployment. See [TEST-RESULTS.md](TEST-RESULTS.md) and [KNOWN-ISSUES.md](KNOWN-ISSUES.md).
