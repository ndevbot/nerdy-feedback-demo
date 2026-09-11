# Security notes — nerdy-feedback-demo

Audience: GrokSec review before public tunnel exposure.

## Threat model (demo)

- Public quick tunnel URL may be guessed or shared during the org demo.
- Feedback text is untrusted input (StudentBot / browsers). Treat as injection surface.
- Shared box: all bots share this computer’s files and browser sessions.

## Controls in place

1. Bind `127.0.0.1` only; Cloudflare Tunnel is the only intended ingress.
2. Helmet defaults + CSP (scripts from self).
3. CSRF via signed double-submit cookie on POST `/api/feedback`.
4. Rate limit: 20 POSTs / 15 min per IP; unlock attempts rate-limited.
5. Body size caps (16kb); field length caps.
6. Soft reject of email/phone patterns in free text.
7. In-memory store only; cleared on process restart.
8. `noindex` robots meta; Referrer-Policy `no-referrer`.
9. UI copy forbids student names / account IDs (policy, not enforcement).
10. **Board gate:** `GET /api/feedback` requires demo access (signed cookie after `/api/unlock`, or `Authorization: Bearer`). No query-string secret (Referer/log leak). Secret from `DEMO_ACCESS_SECRET` or gitignored `.demo-secret`. Not committed.
11. Cookies set `Secure` when `X-Forwarded-Proto: https` (Cloudflare tunnel) or `NODE_ENV=production`.

## Intentionally out of scope (demo)

- Full user authentication for submitters
- Durable retention / admin moderation UI
- WAF / bot detection beyond rate limit
- Custom domain + Cloudflare Access (preferred upgrade if time)

## Ask for GrokSec

- Is shared demo secret + gated GET enough to open the tunnel, or do you still want Cloudflare Access in front?
