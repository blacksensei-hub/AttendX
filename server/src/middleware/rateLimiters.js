// server/src/middleware/rateLimiters.js
//
// Rate limiters for AttendX.
//
// IMPORTANT — Railway (and any reverse proxy) deployment note:
// These limiters key off the client IP. Behind Railway's proxy the raw
// socket IP is the proxy's, not the student's, so app.js MUST set
// `app.set('trust proxy', 1)` — otherwise express-rate-limit sees one IP
// for everyone and would lock out your entire user base at once (and it
// will throw a validation error on boot). See app.js.
//
// Design choice: we deliberately DO NOT hard-limit the attendance-marking
// endpoint by IP. A whole class shares one classroom WiFi IP, so a per-IP
// cap there would block legitimate students in large classes. Proxy-marking
// abuse is handled separately by *detection* (flagging one IP that marks
// many distinct students), not by blocking — see the attendance controller.

const rateLimit = require('express-rate-limit');

// ─── Login limiter ────────────────────────────────────────────
// Strict, but keyed by EMAIL + IP rather than IP alone.
//
// Keying by IP alone breaks on shared classroom WiFi: 40 students all
// logging in at the start of a lecture would burn through a per-IP budget
// and lock out the rest of the class. Combining the submitted email with
// the IP gives each account its own bucket, so:
//   • a class logging in simultaneously is fine (different emails), but
//   • 10 failed attempts against ONE account from one IP still trips —
//     which is exactly the brute-force / credential-stuffing pattern, and
//     the "log in as my friends to mark their attendance" pattern too.
//
// Falls back to IP alone if no email was supplied (malformed request).
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,             // 10 attempts per email+IP per window
  standardHeaders: true,           // RateLimit-* headers
  legacyHeaders:   false,
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? '').toLowerCase().trim();
    return email ? `${req.ip}:${email}` : req.ip;
  },
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in a few minutes.',
  },
});

// ─── Global API limiter ───────────────────────────────────────
// Loose catch-all, per IP. Never trips for normal use; just stops a script
// hammering the API. Generous enough that a class refreshing dashboards and
// polling for sessions stays well under it.
const apiLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             120,       // 120 requests per IP per minute
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

module.exports = { loginLimiter, apiLimiter };