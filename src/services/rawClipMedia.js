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
 * Files never pass through memory whole: uploads arrive on disk (multer),
 * stream to S3, and jobs stream the original back down to a temp file.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const clips = require('./rawClipsService');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const { ASSET_BUCKET: BUCKET, requireAssetBucket } = require('./assetBucket');
const REGION = process.env.AWS_REGION || 'us-east-1';
const JOB_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const TMP_DIR = path.join(os.tmpdir(), 'raw-clips');

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
 */
function run(cmd, args, { low = false, timeoutMs = 10 * 60 * 1000 } = {}) {
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
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => { err = (err + d.toString()).slice(-4000); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(toolError(e, path.basename(cmd))); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
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
  await getS3().send(new PutObjectCommand({
    Bucket: requireAssetBucket(), Key: key, Body: fs.createReadStream(localPath), ContentLength: size, ContentType: contentType,
  }));
  return publicUrl(key);
}

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

/**
 * Queues green removal for a clip. localPath: the original on disk, if the
 * upload still has it (the job removes it when done); otherwise the job
 * downloads the original from S3.
 */
function enqueueKey(sequelize, { clipId, episodeId, s3KeyRaw, strength = 'medium', localPath = null }) {
  if (active.has(clipId)) return false;
  active.add(clipId);
  queue.push({ sequelize, clipId, episodeId, s3KeyRaw, strength, localPath });
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
        console.error(`[rawClips] green removal failed for ${job.clipId}:`, err.message);
        try {
          await clips.setKeyState(job.sequelize, job.clipId, 'failed', { error: err.message });
        } catch (dbErr) {
          console.error('[rawClips] could not record the failure:', dbErr.message);
        }
      } finally {
        active.delete(job.clipId);
        await removeFile(job.localPath);
      }
    }
  } finally {
    running = false;
  }
}

async function keyClip({ sequelize, clipId, episodeId, s3KeyRaw, strength, localPath }) {
  await clips.setKeyState(sequelize, clipId, 'processing');
  let input = localPath;
  let downloaded = null;
  const output = await tmpPath('cutout.webm');
  try {
    if (!input) {
      downloaded = await tmpPath(path.basename(s3KeyRaw));
      await downloadFile(s3KeyRaw, downloaded);
      input = downloaded;
    }
    let color = clips.DEFAULT_KEY_COLOR;
    try {
      const { stdout } = await run(FFMPEG, clips.sampleFrameArgs(input, 1), { timeoutMs: 60 * 1000 });
      color = clips.pickKeyColor(stdout);
    } catch (err) {
      if (/not installed/.test(err.message)) throw err;
      console.error('[rawClips] could not sample the green; using chroma-key green:', err.message);
    }
    await run(FFMPEG, clips.chromakeyArgs(input, output, { color, strength }), { low: true, timeoutMs: JOB_TIMEOUT_MS });
    const cutoutKey = `${clipPrefix(episodeId, clipId)}/cutout.webm`;
    const cutoutUrl = await uploadFile(output, cutoutKey, 'video/webm');
    await clips.setKeyState(sequelize, clipId, 'done', { cutoutKey, cutoutUrl });
  } finally {
    await removeFile(output);
    await removeFile(downloaded);
  }
}

module.exports = {
  BUCKET, TMP_DIR, publicUrl, clipPrefix, tmpPath, removeFile,
  run, uploadFile, downloadFile, inspect, enqueueKey, activeIds,
};
