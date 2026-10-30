/**
 * rawClipSource (P0; Evoni, 2026-10-30): green removal reads the original
 * from S3 through a link on this machine instead of copying it to the disk.
 * Each read is signed when it is made, a read S3 drops part-way is resumed
 * from the byte reached, and expired credentials are tried again. S3 is a
 * stand-in serving a Buffer; nothing leaves the machine.
 *
 * The ffmpeg tests (skipped where ffmpeg is not installed, as in CI) key a
 * generated green-screen clip read through the link while S3 keeps
 * dropping, and show why a link signed once at the start is not used: once
 * it expires, ffmpeg's reconnect is refused.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');
const { openSource, readRange, retryable } = require('../../../src/services/rawClipSource');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** A stand-in S3 for one file: head/get, plus failures to inject per read. */
function fakeS3(data, { failGet = [], dropAfter = [], chunk = 64 * 1024 } = {}) {
  const calls = { head: 0, get: [] };
  return {
    calls,
    headObject: async () => { calls.head += 1; return { ContentLength: data.length, ContentType: 'video/mp4' }; },
    getObject: async (_key, range) => {
      const n = calls.get.push(range) - 1;
      const fail = failGet[n];
      if (fail) throw fail;
      const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(range);
      const slice = data.subarray(Number(a), Number(b) + 1);
      const drop = dropAfter[n];
      async function* gen() {
        let sent = 0;
        for (let i = 0; i < slice.length; i += chunk) {
          const part = slice.subarray(i, i + chunk);
          if (drop != null && sent + part.length > drop) {
            yield part.subarray(0, Math.max(0, drop - sent));
            throw Object.assign(new Error('socket hang up (test)'), { code: 'ECONNRESET' });
          }
          sent += part.length;
          yield part;
        }
      }
      return { Body: Readable.from(gen()) };
    },
  };
}

const expired = () => Object.assign(new Error('The provided token has expired. (test)'), { name: 'ExpiredToken', $metadata: { httpStatusCode: 400 } });
const denied = () => Object.assign(new Error('Access Denied (test)'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });

/** GET url with an optional Range; resolves { status, headers, body } or rejects when the response breaks. */
function get(url, range, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: range ? { Range: range } : {} }, (res) => {
      const parts = [];
      res.on('data', (d) => parts.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('response aborted')));
    });
    req.on('error', reject);
    req.end();
  });
}

let warn;
let error;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { warn.mockRestore(); error.mockRestore(); });

describe('readRange', () => {
  test('ranges ffmpeg sends', () => {
    expect(readRange(undefined, 100)).toBeNull();
    expect(readRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(readRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(readRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(readRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(readRange('bytes=100-', 100)).toBe(false);
    expect(readRange('bytes=5-2', 100)).toBe(false);
    expect(readRange('items=0-1', 100)).toBe(false);
  });

  test('what is tried again: expired credentials, throttling, 5xx, network; not a refusal', () => {
    expect(retryable(expired())).toBe(true);
    expect(retryable({ name: 'SlowDown', $metadata: { httpStatusCode: 503 } })).toBe(true);
    expect(retryable({ code: 'ECONNRESET' })).toBe(true);
    expect(retryable({ name: 'InternalError', $metadata: { httpStatusCode: 500 } })).toBe(true);
    expect(retryable(denied())).toBe(false);
    expect(retryable({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } })).toBe(false);
  });
});

describe('openSource', () => {
  const data = crypto.randomBytes(1024 * 1024 + 123);

  test('serves the whole file and any range, on 127.0.0.1 only, at an unguessable path', async () => {
    const s3 = fakeS3(data);
    const src = await openSource({ key: 'k', ...s3 });
    try {
      expect(src.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{36}$/);
      const whole = await get(src.url);
      expect(whole.status).toBe(200);
      expect(whole.headers['accept-ranges']).toBe('bytes');
      expect(sha(whole.body)).toBe(sha(data));
      const part = await get(src.url, 'bytes=1000-1999');
      expect(part.status).toBe(206);
      expect(part.headers['content-range']).toBe(`bytes 1000-1999/${data.length}`);
      expect(part.body.equals(data.subarray(1000, 2000))).toBe(true);
      const tail = await get(src.url, `bytes=${data.length - 5}-`);
      expect(tail.body.equals(data.subarray(data.length - 5))).toBe(true);
      const head = await get(src.url, null, 'HEAD');
      expect(head.headers['content-length']).toBe(String(data.length));
      expect((await get(src.url, `bytes=${data.length}-`)).status).toBe(416);
      expect((await get(src.url.replace(/\/[0-9a-f]+$/, '/guess'))).status).toBe(404);
      // Every read is its own S3 request (signed when made), never a stored link.
      expect(s3.calls.get).toEqual([`bytes=0-${data.length - 1}`, 'bytes=1000-1999', `bytes=${data.length - 5}-${data.length - 1}`]);
    } finally {
      await src.close();
    }
  });

  test('S3 drops the read part-way, three times: it resumes from the byte reached and the bytes are exact', async () => {
    const s3 = fakeS3(data, { dropAfter: [200000, 150000, 300000] });
    const src = await openSource({ key: 'k', ...s3, retryBaseMs: 1 });
    try {
      const res = await get(src.url);
      expect(res.status).toBe(200);
      expect(sha(res.body)).toBe(sha(data));
      expect(s3.calls.get).toEqual([
        `bytes=0-${data.length - 1}`, `bytes=200000-${data.length - 1}`, `bytes=350000-${data.length - 1}`, `bytes=650000-${data.length - 1}`,
      ]);
      expect(src.stats.resumes).toBe(3);
    } finally {
      await src.close();
    }
  });

  test('expired credentials on a read (a long job outlived them): tried again, and the read completes', async () => {
    const s3 = fakeS3(data, { failGet: [null, expired(), expired()], dropAfter: [400000] });
    const src = await openSource({ key: 'k', ...s3, retryBaseMs: 1 });
    try {
      const res = await get(src.url);
      expect(sha(res.body)).toBe(sha(data));
      expect(src.stats.retries).toBe(3); // the drop, then two expired answers
    } finally {
      await src.close();
    }
  });

  test('S3 refuses (403): not tried again; the response breaks so ffmpeg fails, and it is logged', async () => {
    const s3 = fakeS3(data, { failGet: [denied()] });
    const src = await openSource({ key: 'k', ...s3, retryBaseMs: 1 });
    try {
      await expect(get(src.url)).rejects.toThrow();
      expect(s3.calls.get).toHaveLength(1);
      expect(src.stats.failures).toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('reading the original failed for good'), 'AccessDenied', expect.any(String));
    } finally {
      await src.close();
    }
  });

  test('expired over and over: it gives up after RETRIES tries rather than hanging', async () => {
    const s3 = fakeS3(data, { failGet: Array.from({ length: 10 }, expired) });
    const src = await openSource({ key: 'k', ...s3, retries: 3, retryBaseMs: 1 });
    try {
      await expect(get(src.url)).rejects.toThrow();
      expect(s3.calls.get).toHaveLength(4);
    } finally {
      await src.close();
    }
  });

  test('a missing original fails before anything is served', async () => {
    const missing = Object.assign(new Error('NotFound (test)'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    await expect(openSource({ key: 'k', headObject: async () => { throw missing; }, getObject: async () => ({}) })).rejects.toBe(missing);
  });

  test('close() stops the server', async () => {
    const src = await openSource({ key: 'k', ...fakeS3(data) });
    await src.close();
    await expect(get(src.url)).rejects.toThrow(/ECONNREFUSED/);
  });
});

// ── With ffmpeg ─────────────────────────────────────────────────────────────

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const hasFfmpeg = spawnSync(FFMPEG, ['-version']).status === 0 && spawnSync(FFPROBE, ['-version']).status === 0;
const withFfmpeg = hasFfmpeg ? describe : describe.skip;

withFfmpeg('ffmpeg reading through the link (ffmpeg installed)', () => {
  jest.setTimeout(120000);
  const clips = require('../../../src/services/rawClipsService');
  let dir;
  let clip; // a 6-second green-screen MP4, its index at the end (needs seeking)

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rawclip-source-'));
    clip = path.join(dir, 'green.mp4');
    const made = spawnSync(FFMPEG, ['-hide_banner', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x00B140:s=640x360:r=30:d=6',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      // Grain, so the file is big enough (several MB) to be read in many parts.
      '-vf', 'noise=alls=20:allf=t,drawbox=x=240:y=80:w=160:h=200:color=0xC08060:t=fill',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip]);
    if (made.status !== 0) throw new Error(`test clip not made: ${made.stderr}`);
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const ffmpeg = (args) => spawnSync(FFMPEG, args, { encoding: 'utf8', timeout: 100000 });
  const durationOf = (file) => Number(spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout);
  const run = (args) => new Promise((resolve) => {
    const child = require('child_process').spawn(FFMPEG, args);
    let err = '';
    const out = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    child.on('close', (code) => resolve({ status: code, stderr: err, stdout: Buffer.concat(out) }));
  });

  test('the production green-removal command, reading through the link while S3 drops four times: a whole cut-out with alpha', async () => {
    const data = fs.readFileSync(clip);
    const drops = [Math.floor(data.length * 0.2), 20000, Math.floor(data.length * 0.3), 1000];
    const s3 = fakeS3(data, { dropAfter: drops, chunk: 16 * 1024 });
    const src = await openSource({ key: 'k', ...s3, retryBaseMs: 1 });
    const out = path.join(dir, 'cutout.webm');
    try {
      // Asynchronously: the link is served by this same process.
      const sample = await run(clips.sampleFrameArgs(src.url, 1));
      expect(sample.status).toBe(0);
      const color = clips.pickKeyColor(sample.stdout);
      expect(color).toMatch(/^0x[0-9A-F]{6}$/);
      const res = await run(clips.chromakeyArgs(src.url, out, { color, strength: 'medium' }));
      expect(res.status).toBe(0);
    } finally {
      await src.close();
    }
    expect(Math.abs(durationOf(out) - 6)).toBeLessThan(0.1);
    // The cut-out keeps its alpha (decoded with libvpx, as the editor does).
    const alpha = ffmpeg(['-hide_banner', '-c:v', 'libvpx-vp9', '-i', out, '-frames:v', '1', '-vf', 'alphaextract,scale=8:8', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1']);
    expect(alpha.status).toBe(0);
    expect(s3.calls.get.length).toBeGreaterThan(1); // it seeked (index at the end) and resumed
  });

  test('why a link signed once is not used: once it expires, ffmpeg\'s reconnect is refused, and ffmpeg still exits 0 with a short cut-out', async () => {
    // A stand-in for a presigned S3 link with a fixed expiry: it serves the
    // file (with ranges) until it expires, then answers 403 as S3 does. Half
    // way through the file the connection drops, as an idle S3 read would,
    // and by then the link has expired.
    const data = fs.readFileSync(clip);
    let expiredNow = false;
    let sent = 0;
    const server = http.createServer(async (req, res) => {
      if (expiredNow) { res.writeHead(403, { 'Content-Type': 'application/xml' }); res.end('<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>'); return; }
      const range = readRange(req.headers.range, data.length) || { start: 0, end: data.length - 1 };
      res.writeHead(206, { 'Accept-Ranges': 'bytes', 'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${data.length}` });
      for (let i = range.start; i <= range.end && !res.destroyed; i += 8192) {
        const part = data.subarray(i, Math.min(i + 8192, range.end + 1));
        sent += part.length;
        if (sent > data.length / 2) { expiredNow = true; res.destroy(); return; }
        if (!res.write(part)) await new Promise((r) => res.once('drain', r));
      }
      res.end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${server.address().port}/presigned`;
    try {
      const out = path.join(dir, 'expired.webm');
      const res = await run(clips.chromakeyArgs(url, out, { strength: 'medium' }));
      // ffmpeg reconnects (the same link), is refused, and ends "successfully"
      // with part of the clip: exit 0 is not proof of a whole cut-out, so the
      // job checks the cut-out's length (clips.cutoutComplete).
      expect(res.stderr).toMatch(/Will reconnect/);
      expect(res.status).toBe(0);
      const got = durationOf(out);
      expect(got).toBeLessThan(5);
      expect(clips.cutoutComplete(got, 6)).toBe(false);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  });
});
