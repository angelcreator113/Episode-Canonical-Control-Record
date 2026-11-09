'use strict';

/**
 * Bounded request-body intake (M0 requirement R-1).
 *
 *   - Content-Length is required and must equal the permit's body length
 *     before a single byte is read.
 *   - JSON bodies are read into memory, up to limits.jsonBodyMax.
 *   - Multipart uploads are spooled through the injected spool store (disk in
 *     production), up to limits.uploadBodyMax per request, with a total quota
 *     (spoolTotalMax), a concurrency cap (spoolConcurrency) and a read
 *     deadline. The SHA-256 is computed while reading.
 *   - Nothing is returned (so nothing can be forwarded) until the whole body
 *     has been read and hashed. Unbounded in-memory buffering never happens.
 *
 * Interfaces: spoolStore { create, append, finish, openRead, remove, removeAll },
 * timers { setTimeout, clearTimeout } (injected for tests).
 */

const crypto = require('crypto');
const { DEFAULT_LIMITS } = require('./constants');

class BodyRefusal extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function createBodyIntake({ spoolStore, limits = DEFAULT_LIMITS, timers = { setTimeout, clearTimeout } } = {}) {
  const state = { activeSpools: 0, spooledBytesReserved: 0 };

  function admitSpool(bytes) {
    if (!spoolStore) throw new BodyRefusal('SPOOL_UNAVAILABLE');
    if (state.activeSpools >= limits.spoolConcurrency) throw new BodyRefusal('SPOOL_FULL');
    if (state.spooledBytesReserved + bytes > limits.spoolTotalMax) throw new BodyRefusal('SPOOL_FULL');
    state.activeSpools += 1;
    state.spooledBytesReserved += bytes;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      state.activeSpools -= 1;
      state.spooledBytesReserved -= bytes;
    };
  }

  /**
   * Read a body. source is an async iterable of Buffers.
   * opts: { kind: 'json'|'multipart', contentLength, expectedBytes }
   * Resolves { bytes, sha256, json?, spool? } or rejects with BodyRefusal.
   * A spooled result must be given back with release(result).
   */
  async function read(source, { kind, contentLength, expectedBytes } = {}) {
    if (contentLength == null || contentLength === '') throw new BodyRefusal('BODY_LENGTH_REQUIRED');
    const declared = Number(contentLength);
    if (!Number.isInteger(declared) || declared < 0) throw new BodyRefusal('BODY_LENGTH_REQUIRED');
    if (declared !== expectedBytes) throw new BodyRefusal('BODY_LENGTH_MISMATCH');
    const max = kind === 'json' ? limits.jsonBodyMax : kind === 'multipart' ? limits.uploadBodyMax : null;
    if (max == null) throw new BodyRefusal('BODY_KIND_UNKNOWN');
    if (declared > max) throw new BodyRefusal('BODY_TOO_LARGE');

    const hash = crypto.createHash('sha256');
    let received = 0;
    const chunks = [];
    let spool = null;
    let releaseSlot = null;
    if (kind === 'multipart') {
      releaseSlot = admitSpool(declared);
      try {
        spool = spoolStore.create();
      } catch (err) {
        releaseSlot();
        throw err;
      }
    }

    let timer;
    const deadline = new Promise((_, reject) => {
      timer = timers.setTimeout(() => reject(new BodyRefusal('BODY_DEADLINE')), limits.bodyReadDeadlineMs);
    });
    let cancelled = false;
    const consume = (async () => {
      for await (const chunk of source) {
        if (cancelled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buf.length;
        if (received > declared) throw new BodyRefusal('BODY_LENGTH_MISMATCH');
        hash.update(buf);
        if (spool) spoolStore.append(spool, buf);
        else chunks.push(buf);
      }
      if (received !== declared) throw new BodyRefusal('BODY_LENGTH_MISMATCH');
    })();
    // After a refusal the reader is abandoned; record its late failure, if any.
    consume.catch((err) => { if (cancelled) console.error(`[aiGateway] abandoned body read ended: ${err.code || err.message}`); });

    try {
      await Promise.race([consume, deadline]);
    } catch (err) {
      cancelled = true;
      if (spool) {
        try { spoolStore.remove(spool); } catch (rmErr) { console.error(`[aiGateway] spool cleanup failed: ${rmErr.message}`); }
      }
      if (releaseSlot) releaseSlot();
      throw err;
    } finally {
      timers.clearTimeout(timer);
    }

    const sha256 = hash.digest('hex');
    if (spool) {
      spoolStore.finish(spool);
      return { bytes: received, sha256, spool, releaseSlot };
    }
    const raw = Buffer.concat(chunks, received);
    let json;
    try {
      json = JSON.parse(raw.toString('utf8'));
    } catch (err) {
      console.error(`[aiGateway] JSON body did not parse: ${err.message}`);
      throw new BodyRefusal('BODY_NOT_JSON');
    }
    return { bytes: received, sha256, raw, json };
  }

  /** Give back a read result: removes its spool file and frees its slot. */
  function release(result) {
    if (!result || !result.spool) return;
    try {
      spoolStore.remove(result.spool);
    } catch (err) {
      console.error(`[aiGateway] spool cleanup failed: ${err.message}`);
    }
    if (result.releaseSlot) result.releaseSlot();
  }

  /** Boot: delete every leftover spool file. The ledger decides those rows. */
  function sweep() {
    if (spoolStore) spoolStore.removeAll();
  }

  function stats() {
    return { ...state };
  }

  return { read, release, sweep, stats };
}

module.exports = { createBodyIntake, BodyRefusal };
