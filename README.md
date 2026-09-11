# Nerdy Tutors — Session Feedback (Demo)

Demo web app where students leave tutoring-session feedback. Built for the Nerdy org bot-fleet demo.

- **Student path:** Leave feedback (no account). Saved confirmation keeps a copy of what was submitted.
- **Staff path:** Separate tab. Demo gate = username ending in `@demodomain.com` (spoofable; accepted residual risk for this demo). Staff cookie TTL 1 hour.
- **Customer:** StudentBot (UX). **Security review:** GrokSec via PRs before merge.

Live demo (when tunnel is up): Cloudflare quick tunnel to `127.0.0.1:8787`.

Repo: https://github.com/ndevbot/nerdy-feedback-demo

## Features

- CSRF-protected feedback submit; field-level validation; soft reject of email/phone patterns
- Optional “would recommend?”
- Subject chips + free-text session label
- Character counts on text areas
- Field errors clear on input; summary “Please fix…” clears when all are fixed
- Staff board API gated behind staff cookie
- Staff UI labels the session as “Staff session” (no typed email on screen)
- Staff metrics: volume, avg rating, rating bars, recommend mix, subject mix (expanded synonym map: languages/reading/history → Writing, etc.), friendly timestamps; ops under Demo diagnostics; recent activity rating filters
- Student form nudges subject chips so Staff subject mix stays usable
- In-memory store only (clears on process restart)

## Run

```bash
npm install
npm start
```

App: `http://127.0.0.1:8787` (binds to localhost only)

## Tunnel (demo)

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Tear down the tunnel when the demo ends.

## Security

See [SECURITY.md](./SECURITY.md). Highlights:

- Helmet CSP, CSRF on feedback + staff sign-in/out, rate limits
- No durable PII; synthetic feedback only for this demo
- Staff `@demodomain.com` gate is **not** production auth
- Do not commit secrets, real student data, or production URLs

## Workflow

1. Branch off `main`
2. Update this README whenever product behavior changes
3. Open a PR and wait for **GrokSec** explicit ready-to-merge
4. Merge only after that OK

## Backlog (from StudentBot + DevBot review)

Prioritized student asks still open or in flight:

1. Mobile / fold — sticky submit, tap targets, hero length on small screens
2. Edit after save — edit once from the saved panel before “Submit another”
3. Soft success share — copy a receipt (session label + rating only)
4. Stronger nerdy.com visual parity (illustration / marketing chrome)
5. Confirmation email — deferred until a real mail path exists
6. ~~Widen subject synonyms (spanish / reading / AP History → Writing; confirm geometry/physics)~~ (PR #6)

DevBot hygiene / ops:

- Keep README and SECURITY.md in sync with every change
- Prefer Cloudflare Access if this demo stays public longer than a walkthrough
- Add basic automated tests for staff gate + validation

## Scripts

- `npm start` — run `server.js` on port `8787`
