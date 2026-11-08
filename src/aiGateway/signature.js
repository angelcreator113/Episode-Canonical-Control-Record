'use strict';

/**
 * Ed25519 signature verifier for local emergency commands (M0 addendum E).
 * The private key is held off the server; only the public key is given here.
 */

const crypto = require('crypto');

function createEd25519Verifier(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('aiGateway: emergency public key must be Ed25519');
  const der = key.export({ type: 'spki', format: 'der' });
  const signer = crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  return {
    verify(payload, signatureBase64) {
      try {
        const valid = crypto.verify(null, Buffer.from(payload, 'utf8'), key, Buffer.from(signatureBase64, 'base64'));
        return { valid, signer };
      } catch (err) {
        console.error(`[aiGateway] emergency signature check failed: ${err.message}`);
        return { valid: false, signer };
      }
    },
  };
}

module.exports = { createEd25519Verifier };
