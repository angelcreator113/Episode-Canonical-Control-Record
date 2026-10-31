'use strict';

/**
 * The original, read by ffmpeg over a link on this machine (P0; Evoni,
 * 2026-10-30: a 956 MB 4K clip failed green removal with ENOSPC because the
 * job downloaded the whole original to the temp disk first).
 *
 * openSource({ key, headObject, getObject }) starts a small HTTP server on
 * 127.0.0.1, on a free port, that serves only that one file at a random
 * path. ffmpeg reads it like any link, seeking with Range requests (an MP4
 * whose index sits at the end needs that). Each request, and each resume,
 * is a new S3 GetObject signed at that moment, so nothing expires during a
 * job however long it runs. A signed link made once at the start would not
 * do: the job may run up to four hours, ffmpeg reconnects with the same link,
 * and a link signed with the server's role credentials stops working when
 * those credentials do, whatever expiry it was given.
 *
 * When S3 drops a read part-way (an idle connection closed while ffmpeg is
 * busy encoding, a reset), the server asks S3 again from the byte it reached
 * and carries on in the same response; ffmpeg does not see the break.
 * Expired credentials, throttling, 5xx answers and network errors are tried
 * again (RETRIES times, waiting longer each time). Anything else ends the
 * response, so ffmpeg fails and the job records why.
 *
 * Nothing is written to disk. close() stops the server and every read.
 */

const crypto = require('crypto');
const http = require('http');

const RETRIES = 4;
const RETRY_BASE_MS = 500;

// S3 answers worth asking again: credentials that ran out mid-job (the SDK
// fetches new ones), throttling, the service's own faults, a dropped network.
const RETRY_NAMES = new Set([
  'ExpiredToken', 'ExpiredTokenException', 'RequestExpired', 'TokenRefreshRequired', 'InvalidToken',
  'SlowDown', 'RequestTimeout', 'RequestTimeTooSkewed', 'InternalError', 'ServiceUnavailable', 'TimeoutError',
]);
const RETRY_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ERR_STREAM_PREMATURE_CLOSE']);

/** Whether an S3 or network error is worth trying again. */
function retryable(err) {
  if (!err) return false;
  if (RETRY_NAMES.has(err.name) || RETRY_NAMES.has(err.Code) || RETRY_CODES.has(err.code)) return true;
  const status = Number(err.$metadata?.httpStatusCode);
  return status >= 500 || status === 429 || err.$fault === 'server' || err.$retryable != null;
}

/** Whether S3 says the file is not there. */
const notFound = (err) => !!err && (err.name === 'NoSuchKey' || err.name === 'NotFound' || Number(err.$metadata?.httpStatusCode) === 404);

/** Resolves when res can take more, or has closed (both listeners removed). */
function drained(res) {
  return new Promise((resolve) => {
    const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
    res.on('drain', done);
    res.on('close', done);
  });
}

const wait = (ms) => new Promise((resolve) => { const t = setTimeout(resolve, ms); if (typeof t.unref === 'function') t.unref(); });

/**
 * { start, end } (inclusive) from a Range header for a file of `size`
 * bytes, null for no Range (the whole file), or false when it can't be met.
 */
function readRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return false;
  let start; let end;
  if (m[1] === '') { // the last N bytes
    const n = Number(m[2]);
    if (n === 0) return false;
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || end < start) return false;
  return { start, end };
}

/**
 * Serves `key` on 127.0.0.1 until close(). headObject(key) → { ContentLength,
 * ContentType }; getObject(key, 'bytes=a-b') → { Body } (a readable stream).
 * Resolves { url, size, close, stats }. Throws (not found, refused) before
 * anything is served, so a missing original fails at once.
 */
async function openSource({ key, headObject, getObject, retries = RETRIES, retryBaseMs = RETRY_BASE_MS }) {
  const stats = { requests: 0, s3Reads: 0, resumes: 0, retries: 0, bytes: 0, failures: 0 };
  let head = null;
  for (let attempt = 0; ; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      head = await headObject(key);
      break;
    } catch (err) {
      if (attempt >= retries || !retryable(err)) throw err;
      stats.retries += 1;
      console.warn(`[rawClips] the original's size was not read (trying again): ${err.name || err.code || ''} ${err.message}`);
      // eslint-disable-next-line no-await-in-loop
      await wait(retryBaseMs * 2 ** attempt);
    }
  }
  const size = Number(head?.ContentLength);
  if (!Number.isFinite(size) || size <= 0) throw new Error('The original in storage has no size (empty or unreadable)');
  const contentType = head?.ContentType || 'application/octet-stream';
  const token = crypto.randomBytes(18).toString('hex');
  const open = new Set();
  let closed = false;

  // Writes bytes start..end (inclusive) of the file to res, resuming from
  // where it got to when S3 drops the read. Resolves when done; throws when
  // it gives up (the caller ends the response).
  async function send(res, start, end) {
    let pos = start;
    let attempt = 0;
    while (pos <= end) {
      if (closed || res.destroyed) return;
      let body = null;
      try {
        stats.s3Reads += 1;
        // eslint-disable-next-line no-await-in-loop
        ({ Body: body } = await getObject(key, `bytes=${pos}-${end}`));
        if (!body) throw new Error('S3 answered with no body');
        open.add(body);
        // eslint-disable-next-line no-await-in-loop
        for await (const chunk of body) {
          if (closed || res.destroyed) return;
          const room = res.write(chunk);
          pos += chunk.length;
          stats.bytes += chunk.length;
          attempt = 0; // progress made: the next drop starts its tries afresh
          // eslint-disable-next-line no-await-in-loop
          if (!room) await drained(res);
        }
        if (pos <= end) throw Object.assign(new Error('S3 ended the read early'), { code: 'ERR_STREAM_PREMATURE_CLOSE' });
      } catch (err) {
        if (closed || res.destroyed) return;
        if (attempt >= retries || !retryable(err)) throw err;
        attempt += 1;
        stats.retries += 1;
        if (pos > start) stats.resumes += 1;
        console.warn(`[rawClips] reading the original stopped at byte ${pos} of ${size} (trying again, ${attempt} of ${retries}): ${err.name || err.code || ''} ${err.message}`);
        // eslint-disable-next-line no-await-in-loop
        await wait(retryBaseMs * 2 ** (attempt - 1));
      } finally {
        if (body) { open.delete(body); if (typeof body.destroy === 'function') body.destroy(); }
      }
    }
  }

  const server = http.createServer((req, res) => {
    stats.requests += 1;
    if (req.url !== `/${token}`) { res.writeHead(404); res.end(); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const range = readRange(req.headers.range, size);
    if (range === false) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    const { start, end } = range || { start: 0, end: size - 1 };
    const headers = { 'Accept-Ranges': 'bytes', 'Content-Type': contentType, 'Content-Length': String(end - start + 1) };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    send(res, start, end).then(() => { if (!res.destroyed) res.end(); }).catch((err) => {
      stats.failures += 1;
      console.error(`[rawClips] reading the original failed for good (${key}):`, err.name || err.code || '', err.message);
      res.destroy(err);
    });
  });
  // ffmpeg may pause reading for a long time while it encodes: no timeouts here.
  server.requestTimeout = 0;
  server.timeout = 0;
  server.keepAliveTimeout = 60 * 1000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  server.on('error', (err) => console.error('[rawClips] the local reader of the original failed:', err.message));
  const { port } = server.address();

  function close() {
    if (closed) return Promise.resolve();
    closed = true;
    for (const body of open) { if (typeof body.destroy === 'function') body.destroy(); }
    open.clear();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { url: `http://127.0.0.1:${port}/${token}`, size, close, stats };
}

module.exports = { RETRIES, openSource, readRange, retryable, notFound };
