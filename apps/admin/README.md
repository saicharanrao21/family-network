# Family Network Admin Console

A dependency-free operational console for the Family Network API. It is intentionally small and deployable behind an authenticated reverse proxy or static host.

Set the API origin in the page deployment environment or replace the `base` constant during deployment. Admin access is enforced by the API using the JWT and `ADMIN_USER_IDS`; the browser token is never persisted.

Production hardening: serve over HTTPS, restrict access at the reverse proxy/VPN, and never embed provider credentials in this static application.
