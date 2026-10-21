'use strict';

/**
 * How an AI route answers when its AI call fails (the profile audit,
 * 2026-10-19; the rule pictureSuggestions' fallback set, #3413):
 *
 *   a budget refusal (aiCostTracker / imageCostService, code
 *   AI_BUDGET_EXCEEDED)          429 with its own message
 *   the AI unreachable, overloaded or without a key
 *                                502 "The AI could not be reached; nothing
 *                                was spent." never the SDK's raw text
 *   anything else                not this helper's: the route answers it
 *
 *   aiFailure(res, err)  → the response sent, or null when err is neither
 *   plainAiErrors        router middleware: a route's raw 5xx AI failure → 429 / 502
 *   isAiUnreachable(err), UNREACHABLE
 */

const UNREACHABLE = 'The AI could not be reached; nothing was spent.';

// The SDK's own error classes for a call that never produced an answer.
const SDK_FAILURES = new Set([
  'APIConnectionError', 'APIConnectionTimeoutError', 'AuthenticationError', 'PermissionDeniedError',
  'InternalServerError', 'RateLimitError', 'OverloadedError',
]);
// The SDK's plain Errors (no key) and the network's own.
const UNREACHABLE_TEXT = /authentication method|apiKey or authToken|api[_ ]?key|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed|Connection error|overloaded/i;

function isBudgetRefusal(err) {
  return err?.code === 'AI_BUDGET_EXCEEDED';
}

function isAiUnreachable(err) {
  if (!err || isBudgetRefusal(err)) return false;
  if (err.code === 'AI_UNAVAILABLE') return true;
  if (SDK_FAILURES.has(err.constructor?.name) || SDK_FAILURES.has(err.name)) return true;
  if (Number(err.status) === 529) return true;
  return UNREACHABLE_TEXT.test(String(err.message || ''));
}

/** Answers a budget refusal (429) or an unreachable AI (502); null for any other error. */
function aiFailure(res, err) {
  if (isBudgetRefusal(err)) return res.status(429).json({ success: false, code: err.code, error: err.message });
  if (isAiUnreachable(err)) return res.status(502).json({ success: false, code: 'AI_UNREACHABLE', error: UNREACHABLE });
  return null;
}

// The two budget refusals' own wording (aiCostTracker, imageCostService),
// for routes that pass only err.message along.
const BUDGET_TEXT = /AI daily budget exceeded|Image generation is paused until tomorrow/i;

/**
 * Router middleware for routes that answer an AI failure with a raw 5xx
 * (the AI writing hub, routes/memories: the book side check, 2026-10-20).
 * When such a route sends a 5xx JSON whose error text is a budget refusal
 * it becomes a 429 with that reason; when it is the AI being unreachable it
 * becomes a 502 with the plain message, never the SDK's raw text. Every
 * other answer passes untouched.
 */
function plainAiErrors(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object') {
      const text = [body.error, body.details, body.message].filter((v) => typeof v === 'string').join(' ');
      if (BUDGET_TEXT.test(text)) {
        res.status(429);
        return json({ success: false, code: 'AI_BUDGET_EXCEEDED', error: [body.details, body.error, body.message].find((v) => typeof v === 'string' && BUDGET_TEXT.test(v)) });
      }
      if (UNREACHABLE_TEXT.test(text)) {
        res.status(502);
        return json({ success: false, code: 'AI_UNREACHABLE', error: UNREACHABLE });
      }
    }
    return json(body);
  };
  next();
}

module.exports = { aiFailure, plainAiErrors, isAiUnreachable, isBudgetRefusal, UNREACHABLE };
