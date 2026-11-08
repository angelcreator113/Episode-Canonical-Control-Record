'use strict';

/**
 * Gateway-only classification of what happened to a dispatched submission
 * (M0 addendum F; Q7). Pure. This module is used only by the gateway's own
 * dispatcher; it does not replace or change any application code path.
 *
 * evidence:
 *   { kind: 'error', code, requestBytesWritten }   transport error
 *   { kind: 'response', status, resultPresent, taskId? }
 *   { kind: 'disconnect' }        caller went away
 *   { kind: 'upstream_closed' }   provider connection closed early
 *   { kind: 'stream_incomplete' } stream ended without its final usage event
 *
 * Result: { phase, retryAllowed }. Only a request that provably never left
 * (a pre-send transport error with no request bytes written) is 'not_sent',
 * and only 'not_sent' allows a new attempt. Everything ambiguous is
 * 'unknown': a 429, any 5xx, 408/409, a timeout, a reset, a disconnect, a
 * closed connection, an incomplete stream, or a 2xx without its result.
 */

// Raised before any request byte is written: name resolution, a refused
// connection, or a failed TLS handshake (certificate problems).
const PRE_SEND_ERROR_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
]);
const AMBIGUOUS_4XX = new Set([408, 409, 425, 429]);

function result(phase) {
  return Object.freeze({ phase, retryAllowed: phase === 'not_sent' });
}

function classifyOutcome(evidence = {}) {
  switch (evidence.kind) {
    case 'error':
      if (PRE_SEND_ERROR_CODES.has(evidence.code) && evidence.requestBytesWritten !== true) return result('not_sent');
      return result('unknown');
    case 'response': {
      const s = evidence.status;
      if (!Number.isInteger(s)) return result('unknown');
      if (s >= 200 && s < 300) {
        if (evidence.resultPresent !== true) return result('unknown');
        return result(evidence.taskId ? 'accepted' : 'provider_succeeded');
      }
      if (AMBIGUOUS_4XX.has(s) || s >= 500) return result('unknown');
      if (s >= 400 && s < 500) return result('failed_confirmed');
      return result('unknown');
    }
    case 'disconnect':
    case 'upstream_closed':
    case 'stream_incomplete':
    default:
      return result('unknown');
  }
}

module.exports = { classifyOutcome, PRE_SEND_ERROR_CODES };
