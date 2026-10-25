# Phase 3 Changelog

Implemented the Family Graph Core on top of Phase 1 + Phase 2.

### API
- POST /api/v1/relationships
- POST /api/v1/relationships/parent-child
- POST /api/v1/relationships/union
- POST /api/v1/relationships/:id/confirm
- POST /api/v1/relationships/parent-child/:id/confirm
- GET /api/v1/relationships/path?from=&to=
- GET /api/v1/graph?focus=&depth=

### Integrity
- Authenticated user must control the source person.
- Self relationships are rejected.
- Missing people are rejected.
- Duplicate core relationship submissions return the existing edge.
- Union dates are validated.
- Traversal only expands confirmed relationship edges.
- Graph depth is capped at five per request to prevent accidental unbounded payloads.
