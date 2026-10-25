# End-to-End Acceptance Status

**Status: DATABASE-BACKED ACCEPTANCE NOT RUN.** No valid database-backed test environment or live API was available. The release-smoke attempt could not connect because no API server was listening. Mock-based service tests exercise invitation acceptance and key ownership/destination checks, but do not verify persisted graph state or the complete independent-branch workflow.

## Required independent-branch scenario

1. Create two separate accounts with independently built family branches and no shared graph records.
2. Create and confirm appropriate identities/relationships on each branch without merging canonical people automatically.
3. Submit a possible-match or invitation flow between the branches.
4. Require authorized human review before confirming an identity match or cross-branch connection.
5. Confirm the connection and verify that shortest paths and bounded graph traversal now reach both branches.
6. Verify that private profiles, fields, relationships, archive items, and account claims remain inaccessible to unauthorized users before and after connection.
7. Verify duplicate submissions, expired/revoked invitations, rejection, and retry behavior do not corrupt or silently merge the graph.

## Acceptance evidence required

Run this scenario against disposable PostgreSQL after the initial migration has been replayed and schema-checked. Capture automated test output and verify both database state and API responses. Add negative authorization/privacy cases; a visually connected graph alone is not sufficient acceptance.
