/**
 * Green removal's safety (P0; Evoni, 2026-10-30: a 956 MB 4K clip failed
 * with "ENOSPC: no space left on device, write").
 *
 *   - Low disk: refused before anything is written, in plain words.
 *   - Each run writes its own cut-out; the clip moves to it only once it is
 *     stored. A failed re-key leaves the earlier cut-out in place, and no
 *     file is ever deleted from storage.
 *   - A cut-out shorter than its original (ffmpeg's read broke) is never
 *     stored.
 *   - Expired credentials when the job starts are tried again.
 *
 * ffmpeg and ffprobe are small stand-in scripts (FFMPEG_PATH / FFPROBE_PATH)
 * so this runs anywhere; S3 is a stand-in (S3Client.prototype.send); the
 * database is a stand-in that records each statement. Nothing leaves the
 * machine. The last block runs the real ffmpeg where it is installed.
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');

const saved = { ...process.env };
function restoreEnv() {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
}
// The stand-in tools read their settings from a file (Jest's process.env does
// not reach the processes they run as).
const fake = { seconds: '184.0', out: '184.0', err: '', progress: '' };
const writeFake = () => fs.writeFileSync(path.join(work, 'fake.env'),
  `FAKE_SECONDS='${fake.seconds}'\nFAKE_OUT_SECONDS='${fake.out}'\nFAKE_FFMPEG_ERR='${fake.err}'\nFAKE_PROGRESS='${fake.progress}'\nFAKE_LOG='${path.join(work, 'ffmpeg.log')}'\n`);
const REAL_FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const REAL_FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
let realTools = false; // the last block runs the installed ffmpeg
let work; // this file's own temp folder (TMPDIR), with the stand-in tools in it

beforeAll(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'rawclip-key-'));
  const ffprobe = path.join(work, 'fake-ffprobe');
  const ffmpeg = path.join(work, 'fake-ffmpeg');
  // ffprobe: a .webm's length is the number written in it; anything else is FAKE_SECONDS long.
  fs.writeFileSync(ffprobe, `#!/bin/sh
. "${path.join(work, 'fake.env')}"
for a; do last="$a"; done
case "$last" in *.webm) d=$(cat "$last") ;; *) d="$FAKE_SECONDS" ;; esac
echo "{\\"format\\":{\\"duration\\":\\"$d\\"},\\"streams\\":[{\\"codec_type\\":\\"video\\",\\"width\\":3840,\\"height\\":2160}]}"
`);
  // ffmpeg: logs each call; the frame sample answers green; the key writes
  // FAKE_OUT_SECONDS into the output, or fails with FAKE_FFMPEG_ERR. With
  // FAKE_PROGRESS, the key first reports FAKE_PROGRESS seconds done the way
  // -progress pipe:1 does, then pauses a moment.
  fs.writeFileSync(ffmpeg, `#!/bin/sh
. "${path.join(work, 'fake.env')}"
for a; do last="$a"; done
echo "$*" >> "$FAKE_LOG"
if [ "$last" = "pipe:1" ]; then i=0; while [ $i -lt 256 ]; do printf '\\000\\261\\100'; i=$((i+1)); done; exit 0; fi
if [ -n "$FAKE_PROGRESS" ]; then printf 'frame=1\\nout_time_us=%s000000\\nprogress=continue\\n' "$FAKE_PROGRESS"; sleep 1; fi
if [ -n "$FAKE_FFMPEG_ERR" ]; then echo "$FAKE_FFMPEG_ERR" >&2; exit 1; fi
printf '%s' "$FAKE_OUT_SECONDS" > "$last"
`);
  fs.chmodSync(ffprobe, 0o755);
  fs.chmodSync(ffmpeg, 0o755);
});
afterAll(() => {
  restoreEnv();
  fs.rmSync(work, { recursive: true, force: true });
});

let media;
let sent; // every S3 command, in order
let s3Answer; // (command) => answer, per test
let free; // bytes the disk reports free
let db;
let logs;

beforeEach(() => {
  jest.resetModules();
  restoreEnv();
  process.env.AWS_S3_BUCKET = 'key-test-bucket';
  process.env.FFMPEG_PATH = realTools ? REAL_FFMPEG : path.join(work, 'fake-ffmpeg');
  process.env.FFPROBE_PATH = realTools ? REAL_FFPROBE : path.join(work, 'fake-ffprobe');
  Object.assign(fake, { seconds: '184.0', out: '184.0', err: '', progress: '' });
  writeFake();
  try { fs.unlinkSync(path.join(work, 'ffmpeg.log')); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  free = 5 * 1024 ** 3;
  sent = [];
  s3Answer = null;
  const { S3Client } = require('@aws-sdk/client-s3');
  jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) => {
    const name = command.constructor.name;
    sent.push({ name, key: command.input.Key, range: command.input.Range });
    const custom = s3Answer ? await s3Answer(command, name) : undefined;
    if (custom !== undefined) return custom;
    if (name === 'HeadObjectCommand') return { ContentLength: 956 * 1024 * 1024, ContentType: 'video/mp4' };
    if (name === 'GetObjectCommand') return { Body: Readable.from([Buffer.alloc(16)]) };
    if (name === 'PutObjectCommand') { command.input.Body.resume(); return {}; }
    throw new Error(`unexpected S3 command ${name}`);
  });
  jest.spyOn(fs.promises, 'statfs').mockImplementation(async () => ({ bavail: Math.floor(free / 4096), bsize: 4096 }));
  logs = { error: jest.spyOn(console, 'error').mockImplementation(() => {}), warn: jest.spyOn(console, 'warn').mockImplementation(() => {}), log: jest.spyOn(console, 'log').mockImplementation(() => {}) };
  db = fakeDb();
  media = require('../../../src/services/rawClipMedia');
  tmpBefore = tmpFiles();
});
afterEach(() => jest.restoreAllMocks());

/** A stand-in database for one clip row: applies setKeyState's UPDATEs, records every statement. */
function fakeDb(row = {}) {
  const state = { id: 'c1', key_status: 'none', s3_key_cutout: null, url_cutout: null, key_error: null, ...row };
  const statements = [];
  return {
    state,
    statements,
    sequelize: {
      query: async (sql, { replacements = {} } = {}) => {
        statements.push({ sql, replacements });
        if (/UPDATE episode_raw_clips SET key_status/.test(sql)) {
          state.key_status = replacements.status;
          if (/s3_key_cutout = :cutoutKey/.test(sql)) { state.s3_key_cutout = replacements.cutoutKey; state.url_cutout = replacements.cutoutUrl; }
          if (/key_error = :error/.test(sql)) state.key_error = replacements.error;
          if (/key_error = NULL/.test(sql)) state.key_error = null;
        }
        return [[{ ...state }]];
      },
    },
  };
}

const JOB = { clipId: 'c1', episodeId: 'ep1', s3KeyRaw: 'episodes/ep1/raw-clips/c1/original.mp4', strength: 'medium', durationSeconds: 184 };

/** Queues the job and waits for the queue to finish it. */
async function key(extra = {}) {
  expect(media.enqueueKey(db.sequelize, { ...JOB, ...extra })).toBe(true);
  return key.wait();
}

/** Waits for the queue to finish; resolves the clip's state. */
key.wait = async () => {
  for (let i = 0; i < 9000 && media.activeIds().length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 10));
  }
  expect(media.activeIds()).toEqual([]);
  return db.state;
};

const puts = () => sent.filter((c) => c.name === 'PutObjectCommand').map((c) => c.key);
const deletes = () => sent.filter((c) => /Delete/.test(c.name));
const LOG = () => path.join(work, 'ffmpeg.log');
const ffmpegCalls = () => (fs.existsSync(LOG()) ? fs.readFileSync(LOG(), 'utf8').trim().split('\n') : []);
const cutoutStatements = () => db.statements.filter((s) => /s3_key_cutout/.test(s.sql));
const tmpFiles = () => (fs.existsSync(media.TMP_DIR) ? fs.readdirSync(media.TMP_DIR) : []);
let tmpBefore = [];
// Temp files this test's jobs left behind (the temp folder may be shared).
const leftInTmp = () => tmpFiles().filter((n) => !tmpBefore.includes(n));

describe('progress while green removal runs (Evoni, 2026-10-30)', () => {
  test('ffmpeg reports its progress; the job shows how far it has got while running, and nothing once it ends', async () => {
    fake.progress = '92'; // half of the 184 s clip
    writeFake();
    expect(media.enqueueKey(db.sequelize, JOB)).toBe(true);
    let seen = null;
    for (let i = 0; i < 300 && !seen; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 10));
      const p = media.keyProgress();
      if (p.c1 && p.c1.percent != null) seen = p.c1;
    }
    expect(seen).toMatchObject({ percent: 50 });
    expect(seen.elapsed_seconds).toBeGreaterThanOrEqual(0);
    const state = await key.wait();
    expect(state.key_status).toBe('done');
    expect(media.keyProgress()).toEqual({});
    expect(ffmpegCalls().find((c) => /chromakey/.test(c))).toMatch(/^-progress pipe:1 -nostats /);
  });

  test('a failed run leaves no progress behind', async () => {
    fake.progress = '30';
    fake.err = 'Invalid data found when processing input';
    writeFake();
    const state = await key();
    expect(state.key_status).toBe('failed');
    expect(media.keyProgress()).toEqual({});
  });
});

describe('low disk space', () => {
  test('too little room: refused before ffmpeg runs or anything is stored, with the numbers, and the earlier cut-out kept', async () => {
    db = fakeDb({ key_status: 'done', s3_key_cutout: 'episodes/ep1/raw-clips/c1/cutout.webm', url_cutout: 'https://b/old.webm' });
    free = 300 * 1024 * 1024;
    const state = await key({ hadCutout: true });
    expect(state.key_status).toBe('failed');
    expect(state.key_error).toBe('Not enough space on the server to remove the green (needs about 721 MB, 300 MB free). Nothing was changed: the original and the earlier cut-out are as they were. Space has to be freed on the server before Retry will work.');
    expect(state.s3_key_cutout).toBe('episodes/ep1/raw-clips/c1/cutout.webm');
    expect(state.url_cutout).toBe('https://b/old.webm');
    expect(ffmpegCalls()).toEqual([]);
    expect(sent).toEqual([]); // not even the original was asked for
    expect(leftInTmp()).toEqual([]);
  });

  test('roomToKey: the 956 MB, 3:04 4K clip needs about 721 MB, not 956 MB plus the cut-out (the original is not copied)', async () => {
    free = 2.6 * 1024 ** 3;
    const room = await media.roomToKey(184);
    expect(Math.round(room.needs / 1048576)).toBe(721);
    expect(room.ok).toBe(true);
    free = 700 * 1024 * 1024;
    expect((await media.roomToKey(184)).ok).toBe(false);
  });

  test('the disk fills during the run anyway (ENOSPC from ffmpeg): plain words, nothing stored, temp file removed', async () => {
    fake.err = 'Error writing trailer: No space left on device'; writeFake();
    const state = await key();
    expect(state.key_status).toBe('failed');
    expect(state.key_error).toBe('The server ran out of space while removing the green. Nothing was changed: the original is as it was. Space has to be freed on the server before Retry will work.');
    expect(puts()).toEqual([]);
    expect(leftInTmp()).toEqual([]);
    expect(logs.error).toHaveBeenCalledWith(expect.stringContaining('green removal failed for c1'), expect.anything(), expect.stringMatching(/No space left on device/));
  });
});

describe('the earlier cut-out is kept', () => {
  test('success, failed re-key, success: each run its own file, the failed one changes nothing, nothing is deleted', async () => {
    const first = await key();
    expect(first.key_status).toBe('done');
    const k1 = first.s3_key_cutout;
    expect(k1).toMatch(/^episodes\/ep1\/raw-clips\/c1\/cutout-\d{8}T\d{9}Z-[0-9a-z]{1,4}\.webm$/);
    expect(first.url_cutout).toBe(`https://key-test-bucket.s3.us-east-1.amazonaws.com/${k1}`);

    // The re-key fails part-way.
    fake.err = 'Conversion failed!'; writeFake();
    const before = cutoutStatements().length;
    const second = await key({ hadCutout: true, strength: 'high' });
    expect(second.key_status).toBe('failed');
    expect(second.key_error).toBe('Removing the green failed. Nothing was changed: the original and the earlier cut-out are as they were. Press Retry.');
    expect(second.s3_key_cutout).toBe(k1);
    expect(cutoutStatements().length).toBe(before); // no statement touched the cut-out's key
    expect(puts()).toEqual([k1]);

    fake.err = ''; writeFake();
    const third = await key({ hadCutout: true });
    expect(third.key_status).toBe('done');
    expect(third.s3_key_cutout).not.toBe(k1);
    expect(puts()).toEqual([k1, third.s3_key_cutout]);
    expect(deletes()).toEqual([]);
    expect(sent.some((c) => c.key === k1 && c.name !== 'PutObjectCommand')).toBe(false);
  });

  test('ffmpeg exits 0 with a short cut-out (its read broke): not stored, the earlier cut-out stays', async () => {
    db = fakeDb({ key_status: 'done', s3_key_cutout: 'old-key', url_cutout: 'old-url' });
    fake.out = '61.2'; writeFake();
    const state = await key({ hadCutout: true });
    expect(state.key_status).toBe('failed');
    expect(state.key_error).toBe('The original video could not be read to the end, so the cut-out was not kept. Nothing was changed: the original and the earlier cut-out are as they were. Press Retry in a few minutes.');
    expect([state.s3_key_cutout, state.url_cutout]).toEqual(['old-key', 'old-url']);
    expect(puts()).toEqual([]);
    expect(leftInTmp()).toEqual([]);
  });

  test('the cut-out is stored but saving the clip fails: the clip keeps its earlier cut-out, and the new file is left in storage, not deleted', async () => {
    db = fakeDb({ key_status: 'done', s3_key_cutout: 'old-key', url_cutout: 'old-url' });
    const query = db.sequelize.query;
    db.sequelize.query = async (sql, opts) => {
      if (/s3_key_cutout = :cutoutKey/.test(sql)) throw new Error('connection terminated (test)');
      return query(sql, opts);
    };
    const state = await key({ hadCutout: true });
    expect(state.key_status).toBe('failed');
    expect([state.s3_key_cutout, state.url_cutout]).toEqual(['old-key', 'old-url']);
    expect(puts()).toHaveLength(1);
    expect(deletes()).toEqual([]);
  });

  test('the original is not in storage: plain words, nothing else asked of S3', async () => {
    s3Answer = async (_c, name) => {
      if (name === 'HeadObjectCommand') throw Object.assign(new Error('NotFound (test)'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      return undefined;
    };
    const state = await key();
    expect(state.key_error).toBe('The original video could not be found in storage, so the green was not removed. Nothing was changed: the original is as it was.');
    expect(sent.map((c) => c.name)).toEqual(['HeadObjectCommand']);
    expect(ffmpegCalls()).toEqual([]);
  });
});

describe('expired credentials', () => {
  test('expired when the job starts: tried again, and the job completes', async () => {
    let n = 0;
    s3Answer = async (_c, name) => {
      if (name === 'HeadObjectCommand' && n++ < 2) throw Object.assign(new Error('The provided token has expired. (test)'), { name: 'ExpiredToken' });
      return undefined;
    };
    const state = await key();
    expect(state.key_status).toBe('done');
    expect(sent.filter((c) => c.name === 'HeadObjectCommand')).toHaveLength(3);
  }, 15000);

  test('ffmpeg reads the original from a link on this machine, never a stored S3 link, and not from a copy on disk', async () => {
    await key();
    const calls = ffmpegCalls();
    expect(calls).toHaveLength(2); // the frame sample, then the key
    for (const c of calls) {
      expect(c).toMatch(/-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -rw_timeout 30000000 .*-i http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{36} /);
      expect(c).not.toMatch(/amazonaws|X-Amz/);
    }
    expect(sent.some((c) => c.name === 'GetObjectCommand' && !c.range)).toBe(false); // never a whole-file download
  });

  test('an upload still on disk is keyed from that file (no storage read)', async () => {
    const local = path.join(work, 'upload.mp4');
    fs.writeFileSync(local, 'x');
    await key({ localPath: local });
    expect(ffmpegCalls()[1]).toContain(`-i ${local} `);
    expect(sent.map((c) => c.name)).toEqual(['PutObjectCommand']);
  });
});

// ── With the real ffmpeg ────────────────────────────────────────────────────

const hasFfmpeg = spawnSync(REAL_FFMPEG, ['-version']).status === 0 && spawnSync(REAL_FFPROBE, ['-version']).status === 0;

(hasFfmpeg ? describe : describe.skip)('with the real ffmpeg (installed)', () => {
  jest.setTimeout(120000);
  let clip;
  beforeAll(() => {
    clip = path.join(work, 'green.mp4');
    const made = spawnSync(REAL_FFMPEG, ['-hide_banner', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x00B140:s=640x360:r=30:d=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      '-vf', 'noise=alls=20:allf=t,drawbox=x=240:y=80:w=160:h=200:color=0xC08060:t=fill',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip]);
    if (made.status !== 0) throw new Error(String(made.stderr));
  });

  // Set before the file's beforeEach loads rawClipMedia (and its stand-in S3).
  beforeAll(() => { realTools = true; });
  afterAll(() => { realTools = false; });

  test('keyed from storage while S3 drops twice, then a re-key through a link that expires: the first cut-out is kept', async () => {
    const data = fs.readFileSync(clip);
    let gets = 0;
    s3Answer = async (command, name) => {
      if (name === 'HeadObjectCommand') return { ContentLength: data.length, ContentType: 'video/mp4' };
      if (name !== 'GetObjectCommand') return undefined;
      const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(command.input.Range);
      const slice = data.subarray(Number(a), Number(b) + 1);
      const drop = [2, 4].includes(gets++) ? Math.floor(slice.length / 3) : null;
      async function* body() {
        for (let i = 0; i < slice.length; i += 16384) {
          if (drop != null && i > drop) throw Object.assign(new Error('reset (test)'), { code: 'ECONNRESET' });
          yield slice.subarray(i, i + 16384);
        }
      }
      return { Body: Readable.from(body()) };
    };
    const first = await key({ durationSeconds: 6 });
    expect(first.key_error).toBeNull();
    expect(first.key_status).toBe('done');
    const k1 = first.s3_key_cutout;

    // The re-key reads through a link signed once, which expires part-way:
    // ffmpeg's reconnect is refused and it exits 0 with part of the clip.
    let expired = false;
    const server = http.createServer(async (req, res) => {
      if (expired) { res.writeHead(403); res.end('Request has expired'); return; }
      const { readRange } = require('../../../src/services/rawClipSource');
      const r = readRange(req.headers.range, data.length) || { start: 0, end: data.length - 1 };
      res.writeHead(206, { 'Accept-Ranges': 'bytes', 'Content-Length': String(r.end - r.start + 1), 'Content-Range': `bytes ${r.start}-${r.end}/${data.length}` });
      let served = 0; // a read drops half-way through the file
      for (let i = r.start; i <= r.end && !res.destroyed; i += 8192) {
        const part = data.subarray(i, Math.min(i + 8192, r.end + 1));
        served += part.length;
        if (served > data.length / 2) { expired = true; res.destroy(); return; }
        if (!res.write(part)) await new Promise((x) => res.once('drain', x));
      }
      res.end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const fixedLink = async () => ({ url: `http://127.0.0.1:${server.address().port}/signed-once`, stats: { failures: 0 }, close: async () => {} });
    try {
      // keyClip directly, with the stand-in link, as the queue would run it.
      // Where the link expires depends on how much ffprobe read first: either
      // ffmpeg is refused at the start, or (rawClipSource.test.js) it exits 0
      // with part of the clip and the length check stops it. Either way the
      // job fails and nothing is stored.
      const err = await media.keyClip({ sequelize: db.sequelize, ...JOB, durationSeconds: 6, hadCutout: true, source: fixedLink }).then(() => null, (e) => e);
      expect(err).not.toBeNull();
      expect(err.code === 'CUTOUT_INCOMPLETE' || /403 Forbidden/.test(err.message)).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    expect(db.state.s3_key_cutout).toBe(k1);
    expect(puts()).toEqual([k1]);
    expect(leftInTmp()).toEqual([]);
  });
});
