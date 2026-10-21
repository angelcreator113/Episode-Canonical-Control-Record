'use strict';

/**
 * A small in-memory cache of pictures for the thumbnail Studio (Evoni,
 * 2026-10-21: make it faster). Every "See it exactly" and save fetched each
 * picture from S3 again, and the editor drew full-size photos (poses go up
 * to 4000px). This keeps recent pictures, and the smaller copies made for
 * the editor, for a few minutes, up to a total size; the oldest-used go
 * first. One per server process; nothing is written anywhere.
 *
 *   const cache = createCache({ maxBytes, ttlMs });
 *   await cache.get(key, () => load())   // the cached Buffer, or load() once
 */

function createCache({ maxBytes = 150 * 1024 * 1024, ttlMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const entries = new Map(); // key -> { buf, at }; Map order is use order
  const pending = new Map(); // key -> Promise, so one load serves callers that ask at once
  let bytes = 0;

  const drop = (key) => {
    const e = entries.get(key);
    if (!e) return;
    bytes -= e.buf.length;
    entries.delete(key);
  };

  function put(key, buf) {
    if (!Buffer.isBuffer(buf) || buf.length > maxBytes) return;
    drop(key);
    entries.set(key, { buf, at: now() });
    bytes += buf.length;
    for (const k of entries.keys()) {
      if (bytes <= maxBytes) break;
      drop(k);
    }
  }

  function peek(key) {
    const e = entries.get(key);
    if (!e) return null;
    if (now() - e.at > ttlMs) { drop(key); return null; }
    // Used now: to the back of the order.
    entries.delete(key);
    entries.set(key, e);
    return e.buf;
  }

  async function get(key, load) {
    const hit = peek(key);
    if (hit) return hit;
    if (pending.has(key)) return pending.get(key);
    const p = (async () => {
      try {
        const buf = await load();
        put(key, buf);
        return buf;
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, p);
    return p;
  }

  return { get, peek, put, size: () => bytes, count: () => entries.size, clear: () => { entries.clear(); bytes = 0; } };
}

module.exports = { createCache };
