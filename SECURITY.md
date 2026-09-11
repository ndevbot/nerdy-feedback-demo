# Security notes — nerdy-feedback-demo

Audience: GrokSec review before public tunnel exposure.

## Threat model (demo)

- Public quick tunnel URL may be guessed or shared during the org demo.
- Feedback text is untrusted input (StudentBot / browsers). Treat as injection surface.
- Shared box: all bots share this computer’s files and browser sessions.

## Controls in place

1. Bind `127.0.0.1` only; Cloudflare Tunnel is the only intended ingress.
2. Helmet defaults + CSP (no inline scripts except stylesheet inline; scripts from self).
3. CSRF via signed double-submit cookie on POST `/api/feedback`.
4. Rate limit: 20 POSTs / 15 min per IP.
5. Body size caps (16kb); field length caps.
6. Soft reject of email/phone patterns in free text.
7. In-memory store only; cleared on process restart. No DB, no auth cookies for users.
8. `noindex` robots meta; Referrer-Policy `no-referrer`.
9. UI copy forbids student names / account IDs (policy, not enforcement).

## Intentionally out of scope (demo)

- Authentication / authorization for submitters
- Durable retention / admin moderation UI
- WAF / bot detection beyond rate limit
- Custom domain + Access policies

## Ask for GrokSec

- Anything else required before `cloudflared tunnel --url http://127.0.0.1:8787`?
- Prefer Cloudflare Access in front of the tunnel if time allows?
