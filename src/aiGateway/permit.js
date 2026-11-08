'use strict';

/**
 * Single-use permits (M0 addendum A). A permit is the ledger row created by
 * the Authorize step. It binds the exact caller, provider, operation, model,
 * job, budget reservation, expiry and request characteristics (body hash and
 * length, billing fields, billing headers).
 *
 * The permit secret is returned once, to the authorizing caller; only its
 * SHA-256 is stored. Randomness is injected so tests are deterministic.
 */

const crypto = require('crypto');
const { canonicalJson, sha256Hex } = require('./canonical');
const { operationById } = require('./operationCatalog');

const CALLER_CLASSES = Object.freeze(['api', 'worker', 'script']);

function issuePermitSecret(randomBytes = crypto.randomBytes) {
  const raw = randomBytes(32);
  if (!Buffer.isBuffer(raw) || raw.length !== 32) throw new Error('aiGateway: permit secret must be 32 random bytes');
  const secret = raw.toString('hex');
  return { secret, secretHash: sha256Hex(secret) };
}

function required(cond, field) {
  if (!cond) throw new Error(`aiGateway: permit field "${field}" is missing or invalid`);
}

/**
 * Validate and freeze permit fields. Throws on anything missing: a permit
 * that does not bind every characteristic is never created.
 */
function buildPermit(f = {}) {
  required(typeof f.id === 'string' && f.id.length > 0, 'id');
  required(CALLER_CLASSES.includes(f.callerClass), 'callerClass');
  required(typeof f.callerInstance === 'string' && f.callerInstance.length > 0, 'callerInstance');
  required(/^[0-9a-f]{64}$/.test(f.secretHash || ''), 'secretHash');
  const op = operationById(f.operation);
  required(op && op.cls === 'submission', 'operation');
  required(f.provider === op.provider, 'provider');
  required(typeof f.model === 'string' && f.model.length > 0, 'model');
  required(f.job && typeof f.job.logicalKey === 'string' && Number.isInteger(f.job.attempt) && f.job.attempt >= 1, 'job');
  required(f.reservation && Number.isInteger(f.reservation.estimateMicros) && f.reservation.estimateMicros >= 0, 'reservation.estimateMicros');
  required(f.reservation && typeof f.reservation.day === 'string', 'reservation.day');
  required(Number.isFinite(f.expiresAt), 'expiresAt');
  required(f.body && /^[0-9a-f]{64}$/.test(f.body.sha256 || '') && Number.isInteger(f.body.bytes) && f.body.bytes >= 0, 'body');
  if (op.bodyKind === 'json') required(f.billingFields && typeof f.billingFields === 'object', 'billingFields');
  return Object.freeze({
    id: f.id,
    callerClass: f.callerClass,
    callerInstance: f.callerInstance,
    secretHash: f.secretHash,
    provider: f.provider,
    operation: f.operation,
    service: op.service,
    model: f.model,
    job: Object.freeze({ type: f.job.type || null, id: f.job.id || null, logicalKey: f.job.logicalKey, attempt: f.job.attempt }),
    reservation: Object.freeze({
      estimateMicros: f.reservation.estimateMicros,
      priceCatalogId: f.reservation.priceCatalogId || null,
      strict: f.reservation.strict === true,
      unpriced: f.reservation.unpriced === true,
      day: f.reservation.day,
      sessionId: f.reservation.sessionId || null,
      activationId: f.reservation.activationId || null,
    }),
    expiresAt: f.expiresAt,
    body: Object.freeze({ sha256: f.body.sha256, bytes: f.body.bytes }),
    billingFields: op.bodyKind === 'json' ? canonicalJson(f.billingFields) : null,
    billingHeaders: Object.freeze({ ...(f.billingHeaders || {}) }),
  });
}

module.exports = { CALLER_CLASSES, issuePermitSecret, buildPermit };
