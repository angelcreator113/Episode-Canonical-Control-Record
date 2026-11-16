'use strict';

/** Ed25519 key sets for emergency commands (G3 E4). Keys are synthetic. */

const crypto = require('crypto');
const { createEd25519KeySet, createEd25519Verifier, fingerprintPem } = require('../../../src/aiGateway/signature');

const gen = () => {
  const k = crypto.generateKeyPairSync('ed25519');
  return { privateKey: k.privateKey, pem: k.publicKey.export({ type: 'spki', format: 'pem' }) };
};
const sign = (key, payload) => crypto.sign(null, Buffer.from(payload), key.privateKey).toString('base64');

describe('emergency key sets', () => {
  const A = gen();
  const B = gen();
  const R = gen();

  test('fingerprints are 16 lowercase hex characters and stable', () => {
    expect(fingerprintPem(A.pem)).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprintPem(A.pem)).toBe(fingerprintPem(A.pem));
    expect(fingerprintPem(A.pem)).not.toBe(fingerprintPem(B.pem));
  });

  test('several active keys verify, each reporting its own fingerprint and roles', () => {
    const set = createEd25519KeySet([
      { publicKeyPem: A.pem, roles: ['control'] },
      { publicKeyPem: R.pem, roles: ['recover'] },
    ]);
    expect(set.verify('p', sign(A, 'p'))).toEqual({ valid: true, signer: fingerprintPem(A.pem), roles: ['control'] });
    expect(set.verify('p', sign(R, 'p'))).toEqual({ valid: true, signer: fingerprintPem(R.pem), roles: ['recover'] });
    expect(set.verify('p', sign(B, 'p'))).toEqual({ valid: false, signer: null, roles: [] });
    expect(set.verify('q', sign(A, 'p')).valid).toBe(false);
    expect(set.verify('p', 'not-base64!').valid).toBe(false);
    expect(set.active()).toEqual([
      { fingerprint: fingerprintPem(A.pem), roles: ['control'] },
      { fingerprint: fingerprintPem(R.pem), roles: ['recover'] },
    ]);
  });

  test('a revoked key is reported as revoked, never valid, and is not active', () => {
    const set = createEd25519KeySet([
      { publicKeyPem: A.pem, roles: ['control'] },
      { publicKeyPem: B.pem, roles: ['control'] },
    ], { revoked: [fingerprintPem(B.pem)] });
    // roles stays empty (nothing new is accepted); historicalRoles is for replaying the log only.
    expect(set.verify('p', sign(B, 'p'))).toEqual({ valid: false, revoked: true, signer: fingerprintPem(B.pem), roles: [], historicalRoles: ['control'] });
    expect(set.active().map((k) => k.fingerprint)).toEqual([fingerprintPem(A.pem)]);
    expect(set.revoked()).toEqual([fingerprintPem(B.pem)]);
  });

  test('revoked() lists only keys the set still holds; a set with none revoked lists nothing', () => {
    const none = createEd25519KeySet([{ publicKeyPem: A.pem, roles: ['control'] }]);
    expect(none.revoked()).toEqual([]);
    const notHeld = createEd25519KeySet([{ publicKeyPem: A.pem, roles: ['control'] }], { revoked: [fingerprintPem(B.pem)] });
    expect(notHeld.revoked()).toEqual([]);
    expect(notHeld.verify('p', sign(B, 'p'))).toEqual({ valid: false, signer: null, roles: [] });
  });

  test('a single-key verifier has the control role only unless roles are given', () => {
    expect(createEd25519Verifier(A.pem).active()).toEqual([{ fingerprint: fingerprintPem(A.pem), roles: ['control'] }]);
    expect(createEd25519Verifier(R.pem, { roles: ['recover'] }).active()[0].roles).toEqual(['recover']);
  });

  test('invalid configurations are refused', () => {
    expect(() => createEd25519KeySet([])).toThrow(/at least one key/);
    expect(() => createEd25519KeySet([{ publicKeyPem: A.pem, roles: [] }])).toThrow(/roles/);
    expect(() => createEd25519KeySet([{ publicKeyPem: A.pem, roles: ['admin'] }])).toThrow(/roles/);
    expect(() => createEd25519KeySet([{ publicKeyPem: A.pem, roles: ['control'] }, { publicKeyPem: A.pem, roles: ['recover'] }])).toThrow(/duplicate/);
    expect(() => createEd25519KeySet([{ publicKeyPem: A.pem, roles: ['control'] }], { revoked: ['XYZ'] })).toThrow(/fingerprint/);
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' });
    expect(() => createEd25519KeySet([{ publicKeyPem: rsa, roles: ['control'] }])).toThrow(/Ed25519/);
  });
});
