# Phase 2 — Authentication + Identity

## Delivered
- Email/password registration and login
- Phone/email OTP request + verification abstraction
- Google/Apple provider-ready AuthIdentity model
- Rotating refresh-session storage with hashed refresh tokens
- Canonical Person created during registration
- PersonClaim linking User ↔ Person
- Name variants and privacy foundation
- Authenticated person name/claim endpoints

## Security rules
- Access tokens are short lived.
- Refresh tokens are stored only as hashes.
- OTPs are stored only as hashes and expire after five minutes.
- OTP attempts are limited.
- Development builds may return an OTP code for local testing; production must deliver through a configured provider and never return it in an API response.
- Provider OAuth tokens are not stored as raw tokens in this phase.
