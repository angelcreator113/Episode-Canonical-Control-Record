'use strict';

/**
 * Shared pieces for the rate limiters (Evoni, 2026-10-23: locked out of
 * sign-in twice in a day, and the login page said "Too many attempts" for
 * every kind of refusal, so neither of us could tell which limit it was).
 *
 * - refusedBy(): each limiter answers with its own code and wording, how
 *   long to wait, and a log line naming the limit, so a lockout can be traced.
 * - markSignedIn(): marks a request that carries a valid sign-in token, so
 *   the site-wide request limit counts only signed-out traffic. Pages make
 *   many reads at once (the episode page about 30 per open), and a busy hour
 *   of her own work could reach 500 and refuse even the sign-in request.
 *   It sets req.rateLimitUser only, never req.user: it gives no identity to a
 *   route (F-AUTH-1 FD-67 removed the global optionalAuth on purpose).
 */

const { verifyToken } = require('./auth');

function minutesLeft(req) {
  const reset = req.rateLimit && req.rateLimit.resetTime;
  if (!reset) return null;
  const ms = new Date(reset).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 1;
}

/**
 * A limiter's `handler`: logs the refusal and answers in the shape the login
 * page reads (`message` is shown as written).
 * @param {string} limit   short name of the limit ('sign-in', 'site', 'writes')
 * @param {string} code    machine code for the response
 * @param {(mins: number|null) => string} wording  the message shown to the person
 */
function refusedBy(limit, code, wording) {
  return (req, res, _next, options) => {
    const mins = minutesLeft(req);
    console.warn(`[rate-limit] ${limit} limit refused ${req.method} ${req.originalUrl} ip=${req.ip}${mins ? ` resets in ${mins} min` : ''}`);
    res.status(options.statusCode).json({
      error: 'Too Many Requests',
      code,
      limit,
      message: wording(mins),
      retry_after_minutes: mins,
    });
  };
}

async function markSignedIn(req, _res, next) {
  const header = req.headers.authorization || '';
  const match = /^bearer\s+(\S+)$/i.exec(header);
  if (!match) return next();
  try {
    const { payload } = await verifyToken(match[1]);
    req.rateLimitUser = (payload && payload.sub) || null;
  } catch (err) { // silent-ok: an expired or bad token is simply counted like a signed-out request; the route's own auth reports it
    req.rateLimitUser = null;
  }
  return next();
}

const waitText = (mins) => (mins ? `about ${mins} minute${mins === 1 ? '' : 's'}` : 'a few minutes');

module.exports = { refusedBy, markSignedIn, waitText };
