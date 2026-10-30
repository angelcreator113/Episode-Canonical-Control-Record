'use strict';

/**
 * The file work for raw clips (episode_raw_clips; rawClipsService): reading
 * a clip's length and size (ffprobe), its thumbnail, S3 storage, and green
 * removal (ffmpeg chromakey → WebM with alpha).
 *
 * Green removal runs on this server, in the background, one clip at a time,
 * at low CPU priority, so uploads return at once and the site stays quick.
 * No outside service and no per-clip cost. ffmpeg and ffprobe are found on
 * PATH, or at FFMPEG_PATH / FFPROBE_PATH.
 *
 * Files never pass through memory whole: uploads arrive on disk (multer)
 * and stream to S3. A job reads the original where it is: the upload's own
 * temp file if it is still here, otherwise straight from S3 through a link
 * on this machine (rawClipSource), with no copy on this disk (P0; Evoni,
 * 2026-10-30: a 956 MB 4K original filled the disk). Before it starts, a
 * job checks there is room for the cut-out (roomToKey), and each run writes
 * its own cut-out file, so a failed run or a re-key never replaces one that
 * worked.
 * A teleprompter take goes to S3 in parts instead (rawClipMultipart), with
 * no copy on this disk.
 *
 * The temp folder is swept on start and then hourly (sweepTmp): files older
 * than six hours go, except any a green-removal job is still using
 * (Evoni, 2026-10-27: a full disk stopped a take from saving).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const clips = require('./rawClipsService');
const { openSource } = require('./rawClipSource');
const { KeyNoRoomError, friendlyKeyError } = require('./rawClipErrors');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const { ASSET_BUCKET: BUCKET, requireAssetBucket } = require('./assetBucket');
const REGION = process.env.AWS_REGION || 'us-east-1';
const JOB_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const TMP_DIR = path.join(os.tmpdir(), 'raw-clips');
const TMP_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
// Temp files a queued or running job still needs (sweepTmp leaves them alone).
const inUse = new Set();

let s3Client = null;
const getS3 = () => {
  if (!s3Client) {
    const config = { region: REGION };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
    }
    s3Client = new S3Client(config);
  }
  return s3Client;
};

const publicUrl = (key) => `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
const clipPrefix = (episodeId, clipId) => `episodes/${episodeId}/raw-clips/${clipId}`;

async function tmpPath(name) {
  await fsp.mkdir(TMP_DIR, { recursive: true });
  return path.join(TMP_DIR, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`);
}

async function removeFile(file) {
  if (!file) return;
  try { await fsp.unlink(file); } catch (err) {
    if (err.code !== 'ENOENT') console.error('[rawClips] could not remove temp file', file, err.message);
  }
}

/** A plain message for a tool that could not run. */
function toolError(err, tool) {
  if (err && err.code === 'ENOENT') return new Error(`${tool} is not installed on the server`);
  return err;
}

/**
 * Runs a command; resolves { stdout (Buffer), stderr (string) }, rejects on a
 * non-zero exit with the tail of stderr. low: run at low CPU priority.
 * onLine: stdout is read line by line as it comes and passed to onLine
 * instead of being kept (ffmpeg's -progress output).
 */
function run(cmd, args, { low = false, timeoutMs = 10 * 60 * 1000, onLine = null } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(toolError(err, path.basename(cmd)));
      return;
    }
    if (low && child.pid) {
      try { os.setPriority(child.pid, 15); } catch (err) {
        console.error('[rawClips] could not lower ffmpeg priority:', err.message);
      }
    }
    const out = [];
    let err = '';
    let partial = '';
    const emit = (line) => {
      try { onLine(line); } catch (e) {
        console.error(`[rawClips] could not read a line of ${path.basename(cmd)} output:`, e.message);
      }
    };
    child.stdout.on('data', (d) => {
      if (!onLine) { out.push(d); return; }
      const lines = (partial + d.toString()).split('\n');
      partial = lines.pop();
      lines.forEach(emit);
    });
    child.stderr.on('data', (d) => { err = (err + d.toString()).slice(-4000); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(toolError(e, path.basename(cmd))); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (onLine && partial) emit(partial);
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else {
        const why = signal === 'SIGKILL' ? 'took too long and was stopped' : (err.trim().split('\n').slice(-3).join(' ') || `exit ${code}`);
        reject(new Error(`${path.basename(cmd)} failed: ${why}`));
      }
    });
  });
}

async function uploadFile(localPath, key, contentType) {
  const { size } = await fsp.stat(localPath);
  // Closed whatever S3 does: a send that fails before reading the file would
  // otherwise keep it open, and an unread stream whose file is then removed
  // would throw with nothing listening (2026-10-27).
  const body = fs.createReadStream(localPath);
  body.on('error', (err) => console.error('[rawClips] could not read the file being uploaded', localPath, err.message));
  try {
    await getS3().send(new PutObjectCommand({
      Bucket: requireAssetBucket(), Key: key, Body: body, ContentLength: size, ContentType: contentType,
    }));
  } finally {
    body.destroy();
  }
  return publicUrl(key);
}

const headObject = (key) => getS3().send(new HeadObjectCommand({ Bucket: requireAssetBucket(), Key: key }));
const getObject = (key, range) => getS3().send(new GetObjectCommand({ Bucket: requireAssetBucket(), Key: key, Range: range }));

/**
 * A stored file (an original) opened for ffmpeg through rawClipSource: a
 * link on this machine, read in signed parts, no copy on disk. Resolves
 * { url, size, close, stats }; close() when done. (Voice plan V2 reads a
 * clip's sound this way.)
 */
const openStoredFile = (key) => openSource({ key, headObject, getObject });

async function downloadFile(key, localPath) {
  const res = await getS3().send(new GetObjectCommand({ Bucket: requireAssetBucket(), Key: key }));
  await pipeline(res.Body, fs.createWriteStream(localPath));
}

/**
 * Reads an uploaded file: { duration_seconds, width, height, thumbPath }.
 * Throws RawClipError(400) when the file has no video stream. When ffprobe
 * or ffmpeg is missing the clip is still kept: the numbers come back null.
 */
async function inspect(localPath) {
  let probe = { duration_seconds: null, width: null, height: null, hasVideo: true };
  try {
    const { stdout } = await run(FFPROBE, clips.probeArgs(localPath), { timeoutMs: 60 * 1000 });
    probe = clips.readProbe(stdout.toString());
  } catch (err) {
    if (/not installed/.test(err.message)) {
      console.error('[rawClips] ffprobe missing; keeping the clip without its length:', err.message);
      return { duration_seconds: null, width: null, height: null, thumbPath: null };
    }
    // Logged before the 400 (Teleprompter audit 9): why ffprobe refused it.
    console.error('[rawClips] ffprobe could not read the upload:', err.message);
    throw new clips.RawClipError(400, 'That file is not a video we can read');
  }
  if (!probe.hasVideo) throw new clips.RawClipError(400, 'That file has no video in it');
  let thumbPath = await tmpPath('thumb.jpg');
  const at = probe.duration_seconds ? Math.min(1, probe.duration_seconds / 3) : 0;
  try {
    await run(FFMPEG, clips.thumbnailArgs(localPath, thumbPath, at), { timeoutMs: 60 * 1000 });
  } catch (err) {
    console.error('[rawClips] thumbnail failed:', err.message);
    await removeFile(thumbPath);
    thumbPath = null;
  }
  return { duration_seconds: probe.duration_seconds, width: probe.width, height: probe.height, thumbPath };
}

// ── The green-removal queue: one job at a time, in this process ─────────────

const queue = [];
const active = new Set();
let running = false;

/** Clip ids queued or running here (listClips leaves these alone). */
const activeIds = () => [...active];

// The running green removal's progress, in memory only: { startedAt,
// doneSeconds, totalSeconds } by clip id while ffmpeg runs (Evoni,
// 2026-10-30). Gone when the job ends or the process restarts; the Files page
// then falls back to the time since key_started_at.
const progress = new Map();

/** { clipId: { percent, elapsed_seconds, eta_seconds } } for the jobs running now. */
function keyProgress(now = Date.now()) {
  const out = {};
  for (const [clipId, p] of progress) out[clipId] = clips.progressView(p, now);
  return out;
}

/** A file's or link's length in seconds by ffprobe, or null (logged) when it can't be read. */
async function secondsOf(input) {
  try {
    const { stdout } = await run(FFPROBE, clips.probeArgs(input), { timeoutMs: 60 * 1000 });
    return clips.readProbe(stdout.toString()).duration_seconds;
  } catch (err) {
    console.error('[rawClips] length not read:', err.message);
    return null;
  }
}

/**
 * { ok, needs, free } for green removal of a clip durationSeconds long: ok
 * when the temp disk has room for the cut-out and the margin. free is null
 * (and ok true, logged) when the disk can't be read.
 */
async function roomToKey(durationSeconds, { dir = TMP_DIR } = {}) {
  const needs = clips.keyRoomNeeded(durationSeconds);
  const free = await freeBytes(dir);
  if (free == null) {
    console.warn('[rawClips] free disk space unknown; green removal goes ahead without the check');
    return { ok: true, needs, free };
  }
  return { ok: free >= needs, needs, free };
}

/**
 * Queues green removal for a clip. localPath: the original on disk, if the
 * upload still has it (the job removes it when done); otherwise the job
 * reads the original from S3. durationSeconds sizes the disk check;
 * hadCutout (an earlier cut-out exists) words the message if it fails.
 */
function enqueueKey(sequelize, { clipId, episodeId, s3KeyRaw, strength = 'medium', localPath = null, durationSeconds = null, hadCutout = false }) {
  if (active.has(clipId)) return false;
  active.add(clipId);
  if (localPath) inUse.add(localPath);
  queue.push({ sequelize, clipId, episodeId, s3KeyRaw, strength, localPath, durationSeconds, hadCutout });
  setImmediate(drain);
  return true;
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      try {
        await keyClip(job);
      } catch (err) {
        console.error(`[rawClips] green removal failed for ${job.clipId}:`, err.code || err.name || '', err.message);
        try {
          await clips.setKeyState(job.sequelize, job.clipId, 'failed', { error: friendlyKeyError(err, { hadCutout: job.hadCutout }) });
        } catch (dbErr) {
          console.error('[rawClips] could not record the failure:', dbErr.message);
        }
      } finally {
        active.delete(job.clipId);
        if (job.localPath) inUse.delete(job.localPath);
        await removeFile(job.localPath);
      }
    }
  } finally {
    running = false;
  }
}

async function keyClip({ sequelize, clipId, episodeId, s3KeyRaw, strength, localPath, durationSeconds, hadCutout, source: open = openSource }) {
  await clips.setKeyState(sequelize, clipId, 'processing');
  // Before anything is written: is there room for the cut-out?
  const room = await roomToKey(durationSeconds);
  if (!room.ok) {
    console.error(`[rawClips] green removal not started for ${clipId}: ${Math.round(room.free / 1048576)} MB free, about ${Math.round(room.needs / 1048576)} MB needed`);
    throw new KeyNoRoomError(room.needs, room.free, hadCutout);
  }
  let input = localPath;
  let source = null;
  const output = await tmpPath('cutout.webm');
  inUse.add(output);
  try {
    if (!input) {
      source = await open({ key: s3KeyRaw, headObject, getObject });
      input = source.url;
    }
    // The original's length, to check the cut-out against (the stored one if ffprobe can't say).
    const expected = (await secondsOf(input)) ?? (Number(durationSeconds) > 0 ? Number(durationSeconds) : null);
    let color = clips.DEFAULT_KEY_COLOR;
    try {
      const { stdout } = await run(FFMPEG, clips.sampleFrameArgs(input, 1), { timeoutMs: 60 * 1000 });
      color = clips.pickKeyColor(stdout);
    } catch (err) {
      if (/not installed/.test(err.message)) throw err;
      console.error('[rawClips] could not sample the green; using chroma-key green:', err.message);
    }
    const p = { startedAt: Date.now(), doneSeconds: null, totalSeconds: expected };
    progress.set(clipId, p);
    await run(FFMPEG, ['-progress', 'pipe:1', '-nostats', ...clips.chromakeyArgs(input, output, { color, strength })], {
      low: true,
      timeoutMs: JOB_TIMEOUT_MS,
      onLine: (line) => {
        const s = clips.progressSeconds(line);
        if (s != null) p.doneSeconds = s;
      },
    });
    // ffmpeg can end "successfully" with only part of the clip when its read
    // of the original breaks for good (it did in testing, with a link that
    // had expired): such a cut-out is never stored.
    if (source && source.stats.failures > 0) throw new clips.CutoutIncompleteError('the original could not be read to the end');
    const got = await secondsOf(output);
    if (!clips.cutoutComplete(got, expected)) {
      throw new clips.CutoutIncompleteError(`the cut-out is ${got ?? 'of unknown length'} s, the original ${expected} s`);
    }
    // A new file for this run; the clip moves to it only once it is stored.
    const cutoutKey = clips.cutoutKeyFor(clipPrefix(episodeId, clipId));
    const cutoutUrl = await uploadFile(output, cutoutKey, 'video/webm');
    await clips.setKeyState(sequelize, clipId, 'done', { cutoutKey, cutoutUrl });
    if (source) console.log(`[rawClips] green removed for ${clipId}, original read from storage:`, JSON.stringify(source.stats));
  } finally {
    progress.delete(clipId);
    inUse.delete(output);
    if (source) await source.close();
    await removeFile(output);
  }
}

// ── The temp folder: old leftovers go (on start, then hourly) ───────────────

/**
 * Removes files in the temp folder older than maxAgeMs (by last change),
 * leaving alone any a job still uses. Resolves the names removed; logs them.
 * A folder that is not there yet is nothing to do.
 */
async function sweepTmp({ dir = TMP_DIR, maxAgeMs = TMP_MAX_AGE_MS, now = Date.now(), busy = inUse } = {}) {
  let names;
  try {
    names = await fsp.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('[rawClips] temp folder not read for clean-up:', err.message);
    return [];
  }
  const removed = [];
  for (const name of names) {
    const file = path.join(dir, name);
    if (busy.has(file)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const st = await fsp.stat(file);
      if (!st.isFile() || now - st.mtimeMs < maxAgeMs) continue;
      // eslint-disable-next-line no-await-in-loop
      await fsp.unlink(file);
      removed.push({ name, bytes: st.size });
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[rawClips] temp file not cleaned up:', file, err.message);
    }
  }
  if (removed.length) {
    const mb = Math.round(removed.reduce((n, r) => n + r.bytes, 0) / (1024 * 1024));
    console.log(`[rawClips] temp clean-up removed ${removed.length} file(s), ${mb} MB:`, removed.map((r) => r.name).join(', '));
  }
  return removed.map((r) => r.name);
}

let sweeper = null;
/** Sweeps now and then hourly (once per process). The timer never keeps the process up. */
function startTmpSweeper() {
  if (sweeper) return sweeper;
  const sweep = () => sweepTmp().catch((err) => console.error('[rawClips] temp clean-up failed:', err.message));
  sweep();
  sweeper = setInterval(sweep, SWEEP_EVERY_MS);
  if (typeof sweeper.unref === 'function') sweeper.unref();
  return sweeper;
}

/** Free bytes on the disk that holds dir (made if missing), or null when it can't be read. */
async function freeBytes(dir = TMP_DIR) {
  try {
    await fsp.mkdir(dir, { recursive: true });
    if (typeof fsp.statfs !== 'function') return null;
    const st = await fsp.statfs(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch (err) {
    console.error('[rawClips] free disk space not read:', err.message);
    return null;
  }
}

module.exports = {
  BUCKET, TMP_DIR, TMP_MAX_AGE_MS, FFMPEG, FFPROBE, publicUrl, clipPrefix, tmpPath, removeFile, getS3, openStoredFile,
  run, uploadFile, downloadFile, inspect, enqueueKey, activeIds, keyProgress, roomToKey, keyClip,
  sweepTmp, startTmpSweeper, freeBytes,
};
