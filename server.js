"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

const PORT = process.env.PORT || 8787;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const STAFF_DOMAIN = (process.env.STAFF_EMAIL_DOMAIN || "demodomain.com").toLowerCase();

const feedback = [];
const MAX_FEEDBACK = 200;
const ops = {
  rateLimitedSubmits: 0,
  softPiiRejects: 0,
  staffSignins: 0,
  startedAt: new Date().toISOString(),
};
const SUBJECT_CHIPS = ["Math", "Science", "Writing", "Test prep"];
const MAX_LEN = {
  sessionLabel: 80,
  rating: 1,
  whatWentWell: 1000,
  whatCouldImprove: 1000,
};

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  })
);

app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, "public"), { index: false }));

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Try again later." },
});

const staffLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many staff sign-in attempts." },
});


function cookieSecure(req) {
  if (process.env.NODE_ENV === "production") return true;
  const xf = (req.get("x-forwarded-proto") || "").split(",")[0].trim();
  return xf === "https";
}

function issueCsrf(req, res) {
  const token = crypto.randomBytes(24).toString("hex");
  res.cookie("csrf", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(req),
    signed: true,
    maxAge: 60 * 60 * 1000,
  });
  return token;
}

function requireCsrf(req, res, next) {
  const cookieToken = req.signedCookies.csrf;
  const bodyToken = req.body && req.body._csrf;
  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  next();
}

function staffCookieOpts(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(req),
    signed: true,
    path: "/",
  };
}

function isStaffEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return email.endsWith("@" + STAFF_DOMAIN);
}

function hasStaffAccess(req) {
  const staff = req.signedCookies.staff_user;
  return typeof staff === "string" && isStaffEmail(staff);
}

function requireStaff(req, res, next) {
  if (hasStaffAccess(req)) return next();
  return res.status(401).json({ error: "Staff sign-in required.", code: "STAFF_LOCKED" });
}

function sanitizeText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

app.get("/", (req, res) => {
  const token = issueCsrf(req, res);
  const staff = hasStaffAccess(req);
  const staffUser = staff ? "Staff session" : "";
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Nerdy Tutors — Session Feedback (Demo)</title>
  <link rel="stylesheet" href="/styles.css?v=11" />
</head>
<body>
  <div class="shell">
    <header class="top">
      <div class="brand">
        <span class="logo" aria-hidden="true">N</span>
        <div>
          <p class="brand-name">Nerdy Tutors</p>
          <p class="brand-sub">Session feedback · demo</p>
        </div>
      </div>
      <nav class="tabs" role="tablist" aria-label="Main">
        <button type="button" class="tab active" role="tab" aria-selected="true" data-tab="student" id="tab-student">Leave feedback</button>
        <button type="button" class="tab" role="tab" aria-selected="false" data-tab="staff" id="tab-staff">Staff</button>
      </nav>
    </header>

    <main class="wrap">
      <section id="panel-student" class="panel" role="tabpanel" aria-labelledby="tab-student">
        <div class="hero">
          <p class="eyebrow">For students</p>
          <h1>How did your tutoring session go?</h1>
          <p class="lede">Get unstuck with a tutor — then tell us how it went. Takes about a minute, no account needed. Please skip real names, emails, and account IDs.</p>
          <p class="cta-row"><a class="cta" href="#feedback-form">Share session feedback</a></p>
          <ul class="hero-points">
            <li>Private to this demo — no login</li>
            <li>Focus on the session, not personal details</li>
            <li>Staff review lives on a separate tab</li>
          </ul>
        </div>

        <section id="saved-panel" class="saved" hidden>
          <h2>Feedback saved</h2>
          <p id="saved-summary" class="lede"></p>
          <div class="saved-actions">
            <button type="button" id="edit-saved">Edit this response</button>
            <button type="button" id="copy-receipt" class="secondary">Copy receipt</button>
            <button type="button" id="submit-another">Submit another response</button>
          </div>
        </section>

        <form id="feedback-form" method="post" action="/api/feedback" novalidate>
          <input type="hidden" name="_csrf" id="csrf" value="${escapeHtml(token)}" />
          <div class="chips" id="subject-chips" aria-label="Subject quick picks">
            <button type="button" class="chip" data-chip="Math">Math</button>
            <button type="button" class="chip" data-chip="Science">Science</button>
            <button type="button" class="chip" data-chip="Writing">Writing</button>
            <button type="button" class="chip" data-chip="Test prep">Test prep</button>
          </div>
          <label>
            Session label <span class="req" aria-hidden="true">*</span> <span class="hint">(generic only, e.g. “math practice — week 3”)</span>
            <input name="sessionLabel" id="sessionLabel" maxlength="80" required placeholder="math practice — week 3" autocomplete="off" aria-describedby="err-sessionLabel" />
            <p class="field-error" id="err-sessionLabel" hidden></p>
          </label>
          <fieldset id="rating-fieldset" aria-describedby="err-rating">
            <legend>Overall rating <span class="req" aria-hidden="true">*</span></legend>
            <label class="radio"><input type="radio" name="rating" value="5" required /> 5 — excellent</label>
            <label class="radio"><input type="radio" name="rating" value="4" /> 4 — good</label>
            <label class="radio"><input type="radio" name="rating" value="3" /> 3 — okay</label>
            <label class="radio"><input type="radio" name="rating" value="2" /> 2 — needs work</label>
            <label class="radio"><input type="radio" name="rating" value="1" /> 1 — poor</label>
            <p class="field-error" id="err-rating" hidden></p>
          </fieldset>
          <fieldset>
            <legend>Would you recommend this session? <span class="hint">(optional)</span></legend>
            <label class="radio"><input type="radio" name="wouldRecommend" value="yes" /> Yes</label>
            <label class="radio"><input type="radio" name="wouldRecommend" value="no" /> No</label>
            <label class="radio"><input type="radio" name="wouldRecommend" value="skip" checked /> Prefer not to say</label>
          </fieldset>
          <label>
            What went well <span class="req" aria-hidden="true">*</span>
            <textarea name="whatWentWell" id="whatWentWell" maxlength="1000" rows="3" required placeholder="Topics covered, pacing, clarity…" aria-describedby="err-whatWentWell whatWentWell-count"></textarea>
            <p class="count" id="whatWentWell-count">0 / 1000</p>
            <p class="field-error" id="err-whatWentWell" hidden></p>
          </label>
          <label>
            What could improve <span class="req" aria-hidden="true">*</span>
            <textarea name="whatCouldImprove" id="whatCouldImprove" maxlength="1000" rows="3" required placeholder="Gaps, confusion, UX friction…" aria-describedby="err-whatCouldImprove whatCouldImprove-count"></textarea>
            <p class="count" id="whatCouldImprove-count">0 / 1000 · short is fine</p>
            <p class="field-error" id="err-whatCouldImprove" hidden></p>
          </label>
          <p class="privacy">No names, emails, phone numbers, or account IDs. Demo stores feedback in memory only and clears on restart.</p>
          <div class="submit-bar">
            <button type="submit">Submit feedback</button>
            <p id="status" role="status" aria-live="polite"></p>
          </div>
        </form>
      </section>

      <section id="panel-staff" class="panel" role="tabpanel" aria-labelledby="tab-staff" hidden>
        <div class="hero">
          <p class="eyebrow">Staff / demo only</p>
          <h1>Recent submissions</h1>
          <p class="lede">Not for students. Sign in with any <code>@${escapeHtml(STAFF_DOMAIN)}</code> username to view the board. No password — demo gate only.</p>
        </div>

        <div id="staff-gate" ${staff ? "hidden" : ""}>
          <form id="staff-form">
            <input type="hidden" name="_csrf" id="staff-csrf" value="${escapeHtml(token)}" />
            <label>
              Username (email)
              <input type="email" name="username" id="staff-username" required placeholder="you@${escapeHtml(STAFF_DOMAIN)}" autocomplete="username" />
            </label>
            <p class="hint">Demo-only gate: any username ending in @${escapeHtml(STAFF_DOMAIN)}. Spoofable — accepted for this demo; not production auth. Staff cookie lasts 1 hour.</p>
            <button type="submit">View staff board</button>
            <p id="staff-status" role="status" aria-live="polite"></p>
          </form>
        </div>

        <div id="staff-board" ${staff ? "" : "hidden"}>
          <p class="hint">Signed in as <strong id="staff-who">${staffUser}</strong> · <button type="button" id="staff-signout" class="linkish">Sign out</button></p>
          <div id="metrics" class="metrics" aria-live="polite">${staff ? "Loading metrics…" : ""}</div>
          <h2 class="staff-list-title">Recent submissions <span class="hint">(aggregates / chip subject only — no free-text)</span></h2>
          <div id="list">${staff ? "Loading…" : ""}</div>
        </div>
      </section>
    </main>
  </div>
  <script src="/app.js?v=11"></script>
</body>
</html>`);
});

app.get("/api/csrf", (req, res) => {
  const token = issueCsrf(req, res);
  res.json({ csrf: token });
});

app.post("/api/staff/signin", staffLimiter, requireCsrf, (req, res) => {
  const username = sanitizeText(String((req.body && req.body.username) || ""), 120).toLowerCase();
  if (!isStaffEmail(username)) {
    return res.status(401).json({
      error: `Use a staff username ending in @${STAFF_DOMAIN}.`,
    });
  }
  // Demo-only: domain suffix gate is spoofable; residual risk accepted for this demo.
  ops.staffSignins += 1;
  const opts = { ...staffCookieOpts(req), maxAge: 60 * 60 * 1000 }; // ≤1h
  res.cookie("staff_user", username, opts);
  const csrf = issueCsrf(req, res);
  res.json({ ok: true, label: "Staff session", csrf });
});

app.post("/api/staff/signout", requireCsrf, (req, res) => {
  res.clearCookie("staff_user", staffCookieOpts(req));
  const csrf = issueCsrf(req, res);
  res.json({ ok: true, csrf });
});

function chipSubject(sessionLabel) {
  const label = String(sessionLabel || "");
  for (const chip of SUBJECT_CHIPS) {
    if (label === chip || label.startsWith(chip + " ")) return chip;
  }
  return "Other";
}

function buildMetrics() {
  const ratingHist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const recommend = { yes: 0, no: 0, skip: 0 };
  const subjects = { Math: 0, Science: 0, Writing: 0, "Test prep": 0, Other: 0 };
  let ratingSum = 0;
  let lastSubmitAt = null;
  for (const item of feedback) {
    const r = Number(item.rating);
    if (ratingHist[r] !== undefined) {
      ratingHist[r] += 1;
      ratingSum += r;
    }
    const rec = item.wouldRecommend || "skip";
    if (recommend[rec] !== undefined) recommend[rec] += 1;
    else recommend.skip += 1;
    const sub = chipSubject(item.sessionLabel);
    subjects[sub] = (subjects[sub] || 0) + 1;
    if (!lastSubmitAt || item.createdAt > lastSubmitAt) lastSubmitAt = item.createdAt;
  }
  const count = feedback.length;
  return {
    totalSubmissions: count,
    avgRating: count ? Math.round((ratingSum / count) * 10) / 10 : null,
    ratingHistogram: ratingHist,
    recommend,
    subjectMix: subjects,
    lastSubmitAt,
    processStartedAt: ops.startedAt,
    softPiiRejects: ops.softPiiRejects,
    staffSignins: ops.staffSignins,
    staffCookieTtlSeconds: 3600,
  };
}

app.get("/api/feedback", requireStaff, (req, res) => {
  // Staff list shows ratings/recommend/subject chip only — not free-text bodies (PII risk).
  const items = feedback.slice(-25).reverse().map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    rating: item.rating,
    wouldRecommend: item.wouldRecommend,
    subject: chipSubject(item.sessionLabel),
  }));
  res.json({
    count: feedback.length,
    metrics: buildMetrics(),
    items,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "nerdy-feedback-demo",
    boardGated: true,
    staffDomain: STAFF_DOMAIN,
    staffCookieTtlSeconds: 3600,
  });
});

app.post("/api/feedback", submitLimiter, requireCsrf, (req, res) => {
  const sessionLabel = sanitizeText(req.body.sessionLabel, MAX_LEN.sessionLabel);
  const ratingRaw = sanitizeText(String(req.body.rating || ""), 1);
  const whatWentWell = sanitizeText(req.body.whatWentWell, MAX_LEN.whatWentWell);
  const whatCouldImprove = sanitizeText(
    req.body.whatCouldImprove,
    MAX_LEN.whatCouldImprove
  );
  let wouldRecommend = sanitizeText(String(req.body.wouldRecommend || "skip"), 8);
  if (!["yes", "no", "skip"].includes(wouldRecommend)) wouldRecommend = "skip";

  const rating = Number(ratingRaw);
  const fieldErrors = {};
  if (!sessionLabel) fieldErrors.sessionLabel = "Add a session label.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fieldErrors.rating = "Choose a rating from 1 to 5.";
  }
  if (!whatWentWell) fieldErrors.whatWentWell = "Tell us what went well.";
  if (!whatCouldImprove) fieldErrors.whatCouldImprove = "Tell us what could improve.";
  if (Object.keys(fieldErrors).length) {
    return res.status(400).json({
      error: "Please fix the highlighted fields.",
      fieldErrors,
    });
  }

  const blob = `${sessionLabel}\n${whatWentWell}\n${whatCouldImprove}`;
  if (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob) ||
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(blob)
  ) {
    ops.softPiiRejects += 1;
    return res.status(400).json({
      error: "Remove personal contact details (email/phone) before submitting.",
    });
  }

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sessionLabel,
    rating,
    wouldRecommend,
    whatWentWell,
    whatCouldImprove,
  };

  feedback.push(entry);
  if (feedback.length > MAX_FEEDBACK) feedback.shift();

  const csrf = issueCsrf(req, res);
  res.status(201).json({
    ok: true,
    id: entry.id,
    csrf,
    entry: {
      sessionLabel: entry.sessionLabel,
      rating: entry.rating,
      wouldRecommend: entry.wouldRecommend,
      whatWentWell: entry.whatWentWell,
      whatCouldImprove: entry.whatCouldImprove,
      createdAt: entry.createdAt,
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

function seedSyntheticFeedback() {
  if (feedback.length) return;
  const samples = [
    { sessionLabel: "Math session", rating: 5, wouldRecommend: "yes", whatWentWell: "Clear pacing", whatCouldImprove: "More practice problems" },
    { sessionLabel: "Science session", rating: 4, wouldRecommend: "yes", whatWentWell: "Good visuals", whatCouldImprove: "Slower on formulas" },
    { sessionLabel: "Writing session", rating: 3, wouldRecommend: "skip", whatWentWell: "Outline help", whatCouldImprove: "More examples" },
    { sessionLabel: "Test prep session", rating: 5, wouldRecommend: "yes", whatWentWell: "Timed drills", whatCouldImprove: "Harder stretch questions" },
    { sessionLabel: "custom free text", rating: 2, wouldRecommend: "no", whatWentWell: "Tried hard", whatCouldImprove: "Different approach" },
  ];
  for (const s of samples) {
    feedback.push({
      id: crypto.randomUUID(),
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 3600_000)).toISOString(),
      ...s,
    });
  }
}

app.listen(PORT, "127.0.0.1", () => {
  seedSyntheticFeedback();
  console.log(`nerdy-feedback-demo listening on http://127.0.0.1:${PORT}`);
});
