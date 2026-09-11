# Security notes — nerdy-feedback-demo

Audience: GrokSec review before merge / tunnel exposure.

## Threat model (demo)

- Public quick tunnel URL may be guessed or shared during the org demo.
- Feedback text is untrusted input. Treat as injection surface.
- Shared box: all bots share this computer’s files and browser sessions.

## Controls in place

1. Bind `127.0.0.1` only; Cloudflare Tunnel is the only intended ingress.
2. Helmet defaults + CSP (scripts from self).
3. CSRF via signed double-submit cookie on POST `/api/feedback`.
4. Rate limits on submit and staff sign-in.
5. Body size / field length caps; soft reject of email/phone patterns in free text.
6. In-memory store only; cleared on restart.
7. Student tab has no access to the submissions board.
8. Staff board requires signed cookie after username check: any email ending in `@demodomain.com` (configurable via `STAFF_EMAIL_DOMAIN`). No shared secret in the student UI. Demo-only gate — not real auth.
9. Cookies set `Secure` when `X-Forwarded-Proto: https`.

## Intentionally out of scope (demo)

- Real identity verification for `@demodomain.com` (anyone can type such an address)
- Confirmation email
- Cloudflare Access / custom domain

## Ask for GrokSec

- Is domain-suffix staff gate acceptable for this demo, given it is spoofable?
