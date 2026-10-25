# Family Network — Final Architecture

## Product principle
The product is a living, privacy-first family graph. A User account is separate from a canonical Person. A family connection is represented by a typed, auditable edge; marriages/unions are first-class objects so multiple marriages and half-siblings remain structurally correct.

## Graph model
- Person: identity, names, dates, privacy.
- ParentChildRelationship: parent -> child with biological/adoptive/legal/step/guardian semantics.
- Union: marriage/partnership/historical union; children attach to people, not directly to a visual line.
- Relationship: supplemental typed edges.
- PersonClaim: account-to-person ownership/claim workflow.
- FamilySpace: shared family membership and permissions.

## Explorer UX
- Pan and pinch-to-zoom canvas.
- Focus person and branch expansion.
- Search-to-person navigation.
- Relationship-path highlighting.
- Minimap and viewport culling are planned as renderer optimizations for large graphs.
- The renderer never owns graph truth; backend graph APIs are authoritative.

## Integrity
Before a relationship is confirmed, validate identity existence, self-link prevention, duplicates, date consistency, permission, and cycle constraints for parent-child edges. Suspicious graph behavior is logged for admin review rather than silently changing family data.

## Privacy
Family graphs are private/invite-only by default. Discoverability is explicit. Personal SMS/email/WhatsApp conversations are never silently synchronized. Providers are used for OTP, invitations and transactional notifications; any future message import must be an explicit OAuth/permissioned feature.

## Monetization
Free core graph and invitations. Paid tiers monetize storage, advanced exploration, family history/AI, exports, and large-family administration. Ads are limited to free-tier surfaces and can be disabled by paid plans.

## Production integrations
Provider adapters are configuration-driven: email, SMS/WhatsApp OTP, Razorpay/Stripe billing, Google/Apple sign-in, push notifications, object storage, crash/error telemetry. Credentials remain environment secrets and are never committed.
