# Phase 5 — Family Builder & Branch Connection

## Status
**COMPLETED** (source implementation complete; external provider credentials intentionally excluded).

## Implemented

### Family builder
- Add a parent, child, sibling, spouse/partner from the user's claimed canonical person.
- Supports biological, adoptive, legal, step and guardian parent types.
- Multiple unions are represented by the existing `Union` model rather than flattening marriages into a person-to-person tree edge.
- New relative records start with their own canonical `Person` identity and privacy settings.

### Independent branch connection
- Shareable invitation tokens with hashed storage and expiration.
- Optional email/phone destination and relationship hint.
- Accepting an invitation connects the invitee's existing canonical person to the inviter's target person.
- Invitations are auditable and have explicit lifecycle status.
- The design allows a spouse's sibling, an independently registered parent, or another family branch to join without creating a second canonical person for the same relationship target.

### Duplicate-person review
- `PersonMatchCandidate` records possible duplicate identities without silently merging them.
- A user can dismiss a candidate.
- A user may merge an unclaimed duplicate into the canonical person they control.
- A duplicate with another verified user claim is blocked from automatic merge and requires ownership review.
- Merge operation re-points relationships, parent/child edges, unions, family memberships and invitations while avoiding obvious duplicate edges.
- Merge is audited.

### Flutter
- New Family Builder screen.
- Add-relative bottom sheet.
- Invite-relative flow.
- Accept-invite flow.
- Pending duplicate-review surface.
- Entry point from the Family tab.

### Backend
- New `/family-builder/*` protected API surface.
- Prisma schema additions for invitations and match candidates.
- Phase 5 SQL migration included.

## Deliberate boundaries
- Email/SMS/WhatsApp delivery is not implemented as a provider integration in this phase; invitations are generated as tokens and can be delivered by the Phase 10 notification layer.
- Automated surname/name matching is Phase 6. Phase 5 only provides the safe review/merge mechanism.
- Production credentials are excluded.
