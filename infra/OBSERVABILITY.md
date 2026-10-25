# Observability & Family Graph Health

## Product analytics
Track activation, relationship creation, invites, claims, confirmations, discovery, retention and subscriptions.

## Technical metrics
API latency, HTTP 4xx/5xx, DB latency, Redis health, queue depth/failures, media failures, webhook failures, auth failures.

## Error tracking
Sentry captures crashes/exceptions with release/version/environment and correlation IDs.

## Family graph anomaly checks
1. Self-loop relationship.
2. Duplicate identical relationship edge.
3. Parent-child cycle.
4. Impossible date ordering (child born before parent by an unreasonable threshold; flag, don't auto-delete).
5. Union with same person on both sides.
6. Rapid mass creation of relationships by one account.
7. Sudden graph growth far above normal account behavior.
8. Repeated identity merge/unmerge.
9. High rejection rate for one account's relationship proposals.
10. Privacy-sensitive access spikes.

Anomaly = alert/review item, not automatic family-data mutation.
