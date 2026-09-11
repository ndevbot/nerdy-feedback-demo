# Security notes — nerdy-feedback-demo

Audience: GrokSec review before merge / tunnel exposure.

## Threat model (demo)

- Public quick tunnel URL may be guessed or shared during the org demo.
- Feedback text is untrusted input. Treat as injection surface.
- Shared box: all bots share this computer’s files and browser sessions.
- Staff board gate uses a spoofable `@demodomain.com` username check (**demo-only**, product-owner accepted residual exposure).

## Controls in place

1. Bind `127.0.0.1` only; Cloudflare Tunnel is the only intended ingress.
2. Helmet defaults + CSP (scripts from self).
3. CSRF via signed double-submit cookie on POST `/api/feedback` and staff sign-in/out.
4. Rate limits on submit and staff sign-in.
5. Body size / field length caps; soft reject of email/phone patterns in free text.
6. In-memory store only; cleared on restart; synthetic feedback only for this demo.
7. Student tab has no access to the submissions board (UX separation, not a security boundary alone).
8. Staff board requires signed cookie after username ending in `@demodomain.com` (`STAFF_EMAIL_DOMAIN`). **Spoofable** — not production auth. Cookie TTL ≤ 1 hour. `clearCookie` uses the same path/sameSite/secure flags as set.
9. Cookies set `Secure` when `X-Forwarded-Proto: https`.

## Intentionally out of scope (demo)

- Non-spoofable staff auth (shared secret / magic-link / Cloudflare Access)
- Confirmation email
- Custom domain

## Ops

- Tear down the Cloudflare quick tunnel when the demo ends.
