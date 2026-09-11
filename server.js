"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

function loadDemoSecret() {
  if (process.env.DEMO_ACCESS_SECRET) return process.env.DEMO_ACCESS_SECRET.trim();
  const file = path.join(__dirname, ".demo-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
}

const DEMO_ACCESS_SECRET = loadDemoSecret();
if (!DEMO_ACCESS_SECRET) {
  console.warn("WARNING: no DEMO_ACCESS_SECRET / .demo-secret — board stays locked.");
}

const feedback = [];
const MAX_FEEDBACK = 200;
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

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many unlock attempts." },
});

function cookieSecure(req) {
  if (process.env.NODE_ENV === "production") return true;
  const xf = (req.get("x-forwarded-proto") || "").split(",")[0].trim();
  return xf === "https";
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
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

function hasDemoAccess(req) {
  if (!DEMO_ACCESS_SECRET) return false;
  const cookieOk =
    req.signedCookies.demo_access &&
    timingSafeEqualStr(req.signedCookies.demo_access, DEMO_ACCESS_SECRET);
  if (cookieOk) return true;
  const auth = req.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && timingSafeEqualStr(m[1].trim(), DEMO_ACCESS_SECRET)) return true;
  return false;
}

function requireDemoAccess(req, res, next) {
  if (hasDemoAccess(req)) return next();
  return res.status(401).json({ error: "Demo access required.", code: "DEMO_LOCKED" });
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
  const unlocked = hasDemoAccess(req);
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Nerdy Tutors — Session Feedback (Demo)</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="wrap">
    <header>
      <p class="eyebrow">Demo · not production</p>
      <h1>Tutoring session feedback</h1>
      <p class="lede">Share how a Nerdy Tutors session went. Do not enter student names, emails, account IDs, or other personal identifiers.</p>
    </header>

    <section id="saved-panel" class="saved" hidden>
      <h2>Feedback saved</h2>
      <p id="saved-summary" class="lede"></p>
      <button type="button" id="submit-another">Submit another response</button>
    </section>

    <form id="feedback-form" method="post" action="/api/feedback" novalidate>
      <input type="hidden" name="_csrf" id="csrf" value="${escapeHtml(token)}" />
      <label>
        Session label <span class="hint">(generic only, e.g. “math practice — week 3”)</span>
        <input name="sessionLabel" maxlength="80" required placeholder="math practice — week 3" autocomplete="off" />
      </label>
      <fieldset>
        <legend>Overall rating</legend>
        <label class="radio"><input type="radio" name="rating" value="5" required /> 5 — excellent</label>
        <label class="radio"><input type="radio" name="rating" value="4" /> 4 — good</label>
        <label class="radio"><input type="radio" name="rating" value="3" /> 3 — okay</label>
        <label class="radio"><input type="radio" name="rating" value="2" /> 2 — needs work</label>
        <label class="radio"><input type="radio" name="rating" value="1" /> 1 — poor</label>
      </fieldset>
      <fieldset>
        <legend>Would you recommend this session? <span class="hint">(optional)</span></legend>
        <label class="radio"><input type="radio" name="wouldRecommend" value="yes" /> Yes</label>
        <label class="radio"><input type="radio" name="wouldRecommend" value="no" /> No</label>
        <label class="radio"><input type="radio" name="wouldRecommend" value="skip" checked /> Prefer not to say</label>
      </fieldset>
      <label>
        What went well
        <textarea name="whatWentWell" maxlength="1000" rows="4" required placeholder="Topics covered, pacing, clarity…"></textarea>
      </label>
      <label>
        What could improve
        <textarea name="whatCouldImprove" maxlength="1000" rows="4" required placeholder="Gaps, confusion, UX friction…"></textarea>
      </label>
      <p class="privacy">No names, emails, phone numbers, or account IDs. This demo stores feedback in memory only and clears on restart.</p>
      <button type="submit">Submit feedback</button>
      <p id="status" role="status" aria-live="polite"></p>
    </form>

    <details class="staff" id="staff-board" ${unlocked ? "open" : ""}>
      <summary>Staff only — recent submissions board</summary>
      <p class="hint">Students do not need this. Staff unlock with the shared demo secret to review synthetic submissions.</p>
      <div id="unlock-wrap" ${unlocked ? "hidden" : ""}>
        <form id="unlock-form">
          <label>
            Staff demo access secret
            <input type="password" name="secret" id="demo-secret" required autocomplete="off" />
          </label>
          <button type="submit">Unlock staff board</button>
          <p id="unlock-status" role="status" aria-live="polite"></p>
        </form>
      </div>
      <div id="list">${unlocked ? "Loading…" : '<p class="empty">Board locked.</p>'}</div>
    </details>
  </main>
  <script src="/app.js"></script>
</body>
</html>`);
});

app.get("/api/csrf", (req, res) => {
  const token = issueCsrf(req, res);
  res.json({ csrf: token });
});

app.post("/api/unlock", unlockLimiter, (req, res) => {
  if (!DEMO_ACCESS_SECRET) {
    return res.status(503).json({ error: "Demo access not configured." });
  }
  const provided = (req.body && (req.body.secret || req.body.access)) || "";
  if (!timingSafeEqualStr(String(provided || ""), DEMO_ACCESS_SECRET)) {
    return res.status(401).json({ error: "Invalid demo access secret." });
  }
  res.cookie("demo_access", DEMO_ACCESS_SECRET, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(req),
    signed: true,
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.get("/api/feedback", requireDemoAccess, (req, res) => {
  res.json({
    count: feedback.length,
    items: feedback.slice(-25).reverse(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "nerdy-feedback-demo",
    boardGated: true,
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
  if (!sessionLabel || !whatWentWell || !whatCouldImprove) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1–5." });
  }

  const blob = `${sessionLabel}\n${whatWentWell}\n${whatCouldImprove}`;
  if (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob) ||
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(blob)
  ) {
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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`nerdy-feedback-demo listening on http://127.0.0.1:${PORT}`);
});
