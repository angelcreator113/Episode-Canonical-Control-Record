'use strict';

/**
 * Ed25519 verification for local emergency commands (M0 addendum E, G3 E4).
 * Private keys are held off the server; only public keys are given here.
 *
 * A key set holds several active keys, each with roles:
 *   'control'  may sign stop and release
 *   'recover'  may sign RECOVER (state initialization or recovery)
 * Revoked keys are identified by fingerprint (first 16 hex characters of the
 * SHA-256 of the SPKI DER encoding). A signature by a revoked key is
 * reported as revoked and never as valid.
 */

const crypto = require('crypto');

const ROLES = new Set(['control', 'recover']);
const FINGERPRINT = /^[0-9a-f]{16}$/;

function loadPublicKey(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('aiGateway: emergency public key must be Ed25519');
  return key;
}

function fingerprintOf(key) {
  const der = key.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

/** Fingerprint of a PEM public key. */
function fingerprintPem(publicKeyPem) {
  return fingerprintOf(loadPublicKey(publicKeyPem));
}

/**
 * entries: [{ publicKeyPem, roles: ['control'|'recover', ...] }]
 * options: { revoked: [fingerprint, ...] }
 */
function createEd25519KeySet(entries, { revoked = [] } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('aiGateway: emergency key set needs at least one key');
  if (!Array.isArray(revoked) || !revoked.every((fp) => typeof fp === 'string' && FINGERPRINT.test(fp))) {
    throw new Error('aiGateway: revoked keys must be listed by fingerprint');
  }
  const revokedSet = new Set(revoked);
  const keys = [];
  const seen = new Set();
  for (const entry of entries) {
    const roles = entry && Array.isArray(entry.roles) ? [...new Set(entry.roles)] : [];
    if (roles.length === 0 || !roles.every((r) => ROLES.has(r))) throw new Error('aiGateway: each emergency key needs roles from: control, recover');
    const key = loadPublicKey(entry.publicKeyPem);
    const fingerprint = fingerprintOf(key);
    if (seen.has(fingerprint)) throw new Error('aiGateway: duplicate emergency key');
    seen.add(fingerprint);
    keys.push(Object.freeze({ key, fingerprint, roles: Object.freeze(roles.sort()) }));
  }

  return {
    verify(payload, signatureBase64) {
      for (const k of keys) {
        let ok = false;
        try {
          ok = crypto.verify(null, Buffer.from(String(payload), 'utf8'), k.key, Buffer.from(String(signatureBase64), 'base64'));
        } catch (err) {
          ok = false;
        }
        if (!ok) continue;
        if (revokedSet.has(k.fingerprint)) return { valid: false, revoked: true, signer: k.fingerprint, roles: [] };
        return { valid: true, signer: k.fingerprint, roles: [...k.roles] };
      }
      return { valid: false, signer: null, roles: [] };
    },
    active() {
      return keys.filter((k) => !revokedSet.has(k.fingerprint)).map((k) => ({ fingerprint: k.fingerprint, roles: [...k.roles] }));
    },
  };
}

/** A single-key set. The key gets the 'control' role only unless roles are given explicitly. */
function createEd25519Verifier(publicKeyPem, { roles = ['control'] } = {}) {
  return createEd25519KeySet([{ publicKeyPem, roles }]);
}

module.exports = { createEd25519KeySet, createEd25519Verifier, fingerprintPem };
