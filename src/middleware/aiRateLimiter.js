/**
 * aiRateLimiter — per-IP rate limiter for endpoints that hit Claude /
 * other paid LLM APIs. Mounted on routes whose unbounded use would
 * directly translate to API spend (script generation, beat outlines,
 * deep profiles, etc.). Defaults: 30 requests / 5 minutes / IP.
 *
 * Tunable via env: AI_RATE_LIMIT_PER_IP, AI_RATE_LIMIT_WINDOW_MS.
 *
 * Distinct middleware (not the global one) so legitimate UI traffic on
 * non-AI endpoints doesn't share a budget with code that calls an LLM
 * for every hit.
 */
const rateLimit = require('express-rate-limit');

const aiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '300000', 10), // 5 min
  max: parseInt(process.env.AI_RATE_LIMIT_PER_IP || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI rate limit exceeded',
    message: 'Too many AI generation requests from this address. Try again in a few minutes.',
    code: 'AI_RATE_LIMITED',
  },
  // Identify by user when authed (so a logged-in creator on a shared
  // network isn't blocked by a roommate's traffic), fall back to IP.
  keyGenerator: (req) => req.user?.id || req.ip,
});

module.exports = { aiRateLimiter };
