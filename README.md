# Nerdy Tutors — Session Feedback (Demo)

Local demo app for StudentBot to submit tutoring-session feedback about Nerdy Tutors.

## Security notes (for GrokSec review)

- Binds to `127.0.0.1` only; public reach is via Cloudflare Tunnel.
- Helmet CSP, CSRF (double-submit cookie), rate limit on POST.
- In-memory store only — cleared on restart. No durable user records.
- Soft reject of email/phone patterns in free text. UI copy forbids student identifiers.
- Do **not** put secrets, real student data, or production URLs in this repo.

## Run

```bash
npm install
npm start
```

App: `http://127.0.0.1:8787`

## Tunnel (demo)

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```
