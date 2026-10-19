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

module.exports = { aiFailure, isAiUnreachable, isBudgetRefusal, UNREACHABLE };
