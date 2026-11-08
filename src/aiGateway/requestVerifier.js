'use strict';

/**
 * Verify an incoming submission against its permit (M0 addendum B). Pure and
 * deterministic: every input, including the time, is passed in.
 *
 * request: { host, method, path, headers (lower-case names), callerClass
 *            (the socket it arrived on), secret, body: { sha256, bytes, json? } }
 * Returns { ok: true, operation, params, forwardHeaders } or { ok: false, code }.
 *
 * The permit's phase (single use) is enforced by the ledger's dispatch step,
 * not here; this function checks that the request is exactly the one the
 * permit authorized.
 */

const { canonicalJson, sha256Hex, hexEqual } = require('./canonical');
const { resolveOperation } = require('./operationCatalog');

// Caller-supplied authentication is always removed; the gateway injects keys.
const STRIPPED_HEADERS = new Set(['authorization', 'x-api-key', 'xi-api-key', 'api-key', 'proxy-authorization', 'cookie']);
// Headers that may pass through unchanged.
const PASSTHROUGH_HEADERS = new Set(['content-type', 'content-length', 'accept', 'user-agent']);
// The gateway's own request headers; consumed, never forwarded.
const GATEWAY_HEADER_PREFIX = 'x-aigw-';

function refuse(code) {
  return { ok: false, code };
}

function verifyAgainstPermit(permit, request, { now } = {}) {
  if (!permit) return refuse('PERMIT_UNKNOWN');
  if (!Number.isFinite(now)) return refuse('CLOCK_UNAVAILABLE');
  if (now >= permit.expiresAt) return refuse('PERMIT_EXPIRED');
  if (!request || typeof request.secret !== 'string' || !hexEqual(sha256Hex(request.secret), permit.secretHash)) {
    return refuse('PERMIT_SECRET_MISMATCH');
  }
  if (request.callerClass !== permit.callerClass) return refuse('CALLER_MISMATCH');

  const resolved = resolveOperation(request);
  if (!resolved) return refuse('NOT_ALLOWLISTED');
  const { operation, params } = resolved;
  if (operation.cls !== 'submission') return refuse('NOT_A_SUBMISSION');
  if (operation.id !== permit.operation || operation.provider !== permit.provider) return refuse('OPERATION_MISMATCH');

  const body = request.body || {};
  if (body.bytes !== permit.body.bytes) return refuse('BODY_LENGTH_MISMATCH');
  if (!hexEqual(body.sha256 || '', permit.body.sha256)) return refuse('BODY_HASH_MISMATCH');

  if (operation.bodyKind === 'json') {
    if (!body.json || typeof body.json !== 'object') return refuse('BODY_NOT_JSON');
    const fields = operation.billingFields(body.json, params);
    if (fields.model !== permit.model) return refuse('MODEL_MISMATCH');
    if (canonicalJson(fields) !== permit.billingFields) return refuse('BILLING_FIELDS_MISMATCH');
  }

  const headers = request.headers || {};
  const billingHeaders = new Set(operation.billingHeaders || []);
  const forwardHeaders = {};
  for (const [rawName, value] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    if (STRIPPED_HEADERS.has(name) || name.startsWith(GATEWAY_HEADER_PREFIX)) continue;
    if (billingHeaders.has(name)) continue; // checked below
    if (!PASSTHROUGH_HEADERS.has(name)) return refuse('HEADER_NOT_ALLOWED');
    forwardHeaders[name] = value;
  }
  for (const name of billingHeaders) {
    const got = Object.prototype.hasOwnProperty.call(headers, name) ? String(headers[name]) : undefined;
    const want = Object.prototype.hasOwnProperty.call(permit.billingHeaders, name) ? String(permit.billingHeaders[name]) : undefined;
    if (got !== want) return refuse('BILLING_HEADER_MISMATCH');
    if (got !== undefined) forwardHeaders[name] = got;
  }
  for (const name of Object.keys(permit.billingHeaders)) {
    if (!billingHeaders.has(name)) return refuse('BILLING_HEADER_MISMATCH');
  }

  return { ok: true, operation, params, forwardHeaders };
}

module.exports = { verifyAgainstPermit, STRIPPED_HEADERS, PASSTHROUGH_HEADERS };
