# Backend Schema — Canonical Domain Model

## Core entities
users
persons
person_names
relationships
unions
parent_child_relationships
family_spaces
family_space_members
family_branches
person_claims
facts
sources
evidence
discovery_matches
connection_requests
memories
memory_people
events
event_people
places
documents
privacy_settings
subscriptions
subscription_events
audit_logs

## Key invariants
- persons.id is immutable.
- users can claim at most one active person identity unless a controlled multi-profile case exists.
- surname is never a primary identity key.
- relationship edges must be authorized and auditable.
- union is the entity for marriage/partnership history.
- derived relationships are calculated.
- merge/unmerge operations are auditable.
- living-person visibility is privacy-filtered.

## Subscription model
subscriptions stores provider, customer reference, plan, status, period, renewal/cancel state. subscription_events stores raw provider event IDs, signatures/verification status, event type and processing status for idempotency.

## Health model
System health is derived from logs/metrics, while graph health is derived from integrity scans. Store anomaly records separately from family facts.

## Future entities
relationship_paths (cache only), gedcom_imports, ai_extractions, family_books, storage_usage, admin_alerts, feature_flags.
