'use strict';

/**
 * A stand-in for the object storage, for tests (V2-2a-2): the real
 * @aws-sdk/client-s3 commands, and an S3Client whose send() keeps objects
 * in memory and behaves as the real one does for the three things the
 * document presentations rely on:
 *   - a read of a key that is not there fails with NoSuchKey (404);
 *   - a write with If-None-Match: * to a key that is there fails with
 *     PreconditionFailed (412) and leaves what is there;
 *   - a write without the condition replaces.
 * Nothing leaves the process. Use:
 *   jest.mock('@aws-sdk/client-s3', () => require('../helpers/objectStorageDouble').module());
 *   const storage = require('@aws-sdk/client-s3').__storage;
 */
function module_() {
  const real = jest.requireActual('@aws-sdk/client-s3');
  const objects = new Map();
  const log = [];
  const control = {
    /**
     * 'honoured' (as S3), 'unsupported' (answers 501 to a conditional
     * write), or 'ignored' (a store that takes the condition and writes
     * over what is there all the same).
     */
    conditional: 'honoured',
    /** A function called before each send; it may wait or throw. */
    before: null,
  };
  const fail = (name, status) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });
  class S3Client {
    async send(command) {
      const kind = command.constructor.name;
      const { Key: key } = command.input || {};
      if (control.before) await control.before(kind, command.input);
      if (kind === 'GetObjectCommand' || kind === 'HeadObjectCommand') {
        log.push({ op: 'read', key });
        if (!objects.has(key)) throw fail('NoSuchKey', 404);
        const bytes = objects.get(key);
        return { Body: { transformToByteArray: async () => new Uint8Array(bytes) }, ContentLength: bytes.length };
      }
      if (kind === 'PutObjectCommand') {
        const conditional = command.input.IfNoneMatch === '*';
        if (conditional && control.conditional === 'unsupported') throw fail('NotImplemented', 501);
        if (conditional && control.conditional !== 'ignored' && objects.has(key)) { log.push({ op: 'refused', key }); throw fail('PreconditionFailed', 412); }
        log.push({ op: objects.has(key) ? 'overwrite' : 'write', key, conditional });
        objects.set(key, Buffer.from(command.input.Body));
        return {};
      }
      if (kind === 'DeleteObjectCommand') {
        log.push({ op: 'delete', key });
        objects.delete(key);
        return {};
      }
      throw new Error(`objectStorageDouble: ${kind} is not stood in for`);
    }
  }
  return { ...real, S3Client, __storage: { objects, log, control, keyOf: (url) => decodeURIComponent(new URL(url).pathname.slice(1)) } };
}

module.exports = { module: module_ };
