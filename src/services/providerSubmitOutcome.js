'use strict';

/**
 * How a failed paid provider submission ended, and the error for an outcome
 * that cannot be known (Evoni, AI Operations Center review, 2026-11-07, Q7):
 * a request is sent again automatically only when it provably never reached
 * the provider. A timeout, a reset, a 408, a 429, a 5xx or a success without
 * its result may have been accepted (and billed), so it is never resubmitted.
 *
 * Used by sceneGenerationService.startTextToImage (fal still images).
 */

// Raised while resolving the host or opening the connection, before a single
// request byte is written: proof that the provider never received it.
const NOT_SENT_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED']);

class ProviderOutcomeUnknownError extends Error {
  constructor(message, { provider = null, cause = null } = {}) {
    super(message);
    this.name = 'ProviderOutcomeUnknownError';
    this.code = 'PROVIDER_OUTCOME_UNKNOWN';
    this.status = 502;
    this.statusCode = 502;
    this.provider = provider;
    if (cause) this.cause = cause;
  }
}

// 4xx answers that do not prove the request was refused before it ran:
// 408 Request Timeout (the provider or a proxy gave up waiting, possibly
// after work had started) and 429 Too Many Requests. No provider
// documentation recorded in this repository establishes that either means
// no paid execution happened (Evoni, 2026-11-08: 408 is unknown unless there
// is authoritative evidence otherwise).
const AMBIGUOUS_4XX = new Set([408, 429]);

/**
 * 'not_sent'  never reached the provider (NOT_SENT_ERROR_CODES, no response);
 * 'failed'    the provider answered a 4xx not in AMBIGUOUS_4XX: a definitive
 *             refusal;
 * 'unknown'   anything else: a timeout, reset, 408, 429, 5xx, or an error
 *             with no response and no pre-send code (e.g. a 2xx without a
 *             result).
 */
function classifySubmitError(err) {
  const status = err && err.response ? err.response.status : undefined;
  if (status === undefined) return NOT_SENT_ERROR_CODES.has(err && err.code) ? 'not_sent' : 'unknown';
  if (AMBIGUOUS_4XX.has(status)) return 'unknown';
  if (status >= 400 && status < 500) return 'failed';
  return 'unknown';
}

module.exports = { NOT_SENT_ERROR_CODES, AMBIGUOUS_4XX, ProviderOutcomeUnknownError, classifySubmitError };
