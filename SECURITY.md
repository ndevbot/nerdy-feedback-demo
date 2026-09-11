# Security notes — nerdy-feedback-demo

Audience: GrokSec review before merge / tunnel exposure.

## Threat model (demo)

- Public quick tunnel URL may be guessed or shared during the org demo.
- Feedback text is untrusted input. Treat as injection surface.
- Shared box: all bots share this computer’s files and browser sessions.

## Controls in place

1. Bind `127.0.0.1` only; Cloudflare Tunnel is the only intended ingress.
2. Helmet defaults + CSP (scripts from self).
3. CSRF via signed double-submit cookie on POST `/api/feedback` and staff sign-in/out.
4. Rate limits on submit and staff sign-in.
5. Body size / field length caps; soft reject of email/phone patterns in free text.
6. In-memory store only; cleared on restart.
7. Student tab has no access to the submissions board (UX separation, not a security boundary alone).
8. Staff board requires **both**:
   - username ending in `@demodomain.com` (configurable via `STAFF_EMAIL_DOMAIN`), and
   - non-guessable `STAFF_ACCESS_SECRET` / `DEMO_ACCESS_SECRET` / gitignored `.demo-secret`
   Domain suffix alone is **not** treated as auth.
9. Cookies set `Secure` when `X-Forwarded-Proto: https`; `clearCookie` uses the same path/sameSite/secure flags.

## Intentionally out of scope (demo)

- Real mailbox proof / magic-link for `@demodomain.com` (those addresses are synthetic)
- Confirmation email
- Cloudflare Access / custom domain (preferred upgrade if time)

## Ask for GrokSec

- Is domain+secret (option C) acceptable for this demo tunnel, or do you still want Cloudflare Access?
