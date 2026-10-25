# Phase 4 — Relationship Engine + Interactive Family Explorer

## Status
COMPLETED for this phase's defined scope.

## Delivered
- Derived kinship API (`GET /relationships/kinship`)
- Shortest verified relationship path with named people
- Parent / grandparent / great-grandparent derivation
- Child / grandchild derivation
- Full vs half sibling detection from confirmed shared parents
- Cousin degree and removal calculation
- Union-aware relationship navigation
- Accessible family graph search (not just the account's own person)
- Database uniqueness/index protection for parent-child edges
- Flutter graph models and API integration
- Dynamic graph loading from the authenticated person's canonical identity
- Pan and pinch zoom
- Zoom controls and reset
- Node selection
- Double-tap / Focus selected person
- Progressive graph depth expansion
- Search highlighting inside the loaded graph
- Anchored edge rendering based on node geometry
- Union edges with dedicated visual treatment
- Large-graph friendly progressive depth model

## Design rule
The backend stores people and relationships; Flutter owns presentation coordinates. Coordinates are never persisted as family truth.
