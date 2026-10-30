'use strict';

/**
 * Extracting a clip's sound for Voice Studio (Voice plan V2; Evoni,
 * 2026-10-30). Run only by the footage-only worker, for one claimed
 * 'extract' job.
 *
 * ffmpeg reads the original where it is in storage, through the storage
 * reader (rawClipMedia.openStoredFile → rawClipSource: signed parts, no
 * copy of the video on disk), and writes only its sound: mono, 48 kHz,
 * FLAC. The result becomes the clip's 'extracted' source
 * (voiceStudioService.createExtractedSource). The clip, its original and
 * its cut-out are never touched; a clip already extracted keeps its source.
 *
 * Failures come back as FootageJobError with a plain message and whether
 * they are transient (retried) or need Prepare Voice again.
 */

const path = require('path');
const { FootageJobError, footageExtractionEnabledFor } = require('./voiceFootageJobs');
const { isDiskFull } = require('./rawClipErrors');

const MB = 1024 * 1024;
// Room on the temp disk: the FLAC (well under 0.2 MB a second of mono
// speech), never under 50 MB, plus the 500 MB kept free for the server.
const AUDIO_MB_PER_SECOND = 0.2;
const AUDIO_MIN_BYTES = 50 * MB;
const MARGIN_BYTES = 500 * MB;
const UNKNOWN_SECONDS = 600;
const EXTRACT_TIMEOUT_MS = 60 * 60 * 1000;
const NETWORK = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);

/** Bytes the extraction needs free for a clip of durationSeconds (null: not known). */
function audioRoomNeeded(durationSeconds) {
  const seconds = Number(durationSeconds) > 0 ? Number(durationSeconds) : UNKNOWN_SECONDS;
  return Math.max(AUDIO_MIN_BYTES, Math.ceil(seconds * AUDIO_MB_PER_SECOND * MB)) + MARGIN_BYTES;
}

/** ffmpeg arguments: input → its first audio stream only, mono 48 kHz FLAC. */
function extractArgs(input, output, netArgs = []) {
  return ['-hide_banner', '-y', ...netArgs, '-i', input, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-c:a', 'flac', output];
}

const mb = (bytes) => Math.max(1, Math.round(Number(bytes) / MB));

/**
 * The job's failure, sorted: transient ones (storage or network trouble,
 * a database connection) are retried; everything else waits for Prepare
 * Voice. Messages are plain words; the raw error is logged by the worker.
 */
function classify(err) {
  if (err instanceof FootageJobError) return err;
  const msg = String(err?.message || '');
  if (isDiskFull(err)) {
    return new FootageJobError('NO_ROOM', 'The server ran out of space while preparing the voice. Nothing was changed. Space has to be freed before Prepare Voice will work.');
  }
  const status = Number(err?.$metadata?.httpStatusCode);
  if (err?.name === 'NoSuchKey' || err?.name === 'NotFound' || status === 404) {
    return new FootageJobError('ORIGINAL_MISSING', "The clip's original video could not be found in storage, so its voice was not prepared.");
  }
  if (NETWORK.has(err?.code) || status >= 500 || status === 429 || err?.$retryable != null
    || /Server returned 5\d\d|Connection (reset|refused|timed out)|Input\/output error|End of file/i.test(msg)
    || /^Sequelize(Connection|ConnectionRefused|HostNotReachable|ConnectionTimedOut)Error$/.test(String(err?.name || ''))) {
    return new FootageJobError('STORAGE_TROUBLE', "The original video couldn't be read just now. It will be tried again automatically.", { retryable: true });
  }
  if (/took too long and was stopped/.test(msg)) {
    return new FootageJobError('TIMEOUT', 'Preparing the voice took longer than an hour and was stopped. Nothing was changed.');
  }
  if (/is not installed on the server/.test(msg)) {
    return new FootageJobError('NO_FFMPEG', `${msg}. Nothing was changed.`);
  }
  return new FootageJobError('EXTRACT_FAILED', "The clip's sound could not be extracted. Nothing was changed. Press Prepare Voice to try again.");
}

/**
 * Runs one claimed extract job. Resolves the source ({ source, existed }).
 * deps (for tests): sequelize, media (rawClipMedia), studio
 * (voiceStudioService), clips (rawClipsService).
 */
async function runExtract(job, { sequelize, media = require('./rawClipMedia'), studio = require('./voiceStudioService'), clips = require('./rawClipsService') } = {}) {
  const clip = await clips.getClip(sequelize, job.episode_id, job.raw_clip_id);
  if (!clip) throw new FootageJobError('CLIP_GONE', 'The clip was deleted, so its voice was not prepared.');
  if (!footageExtractionEnabledFor(clip.performer)) {
    throw new FootageJobError('NOT_ELIGIBLE', "The clip is no longer on Lala's lane, so its voice was not prepared.");
  }
  if (clip.s3_key_raw !== job.input_ref) {
    throw new FootageJobError('ORIGINAL_CHANGED', "The clip's original is not the one this job was queued for. Press Prepare Voice.");
  }

  const needs = audioRoomNeeded(clip.duration_seconds);
  const free = await media.freeBytes();
  if (free != null && free < needs) {
    throw new FootageJobError('NO_ROOM', `Not enough space on the server to prepare the voice (needs about ${mb(needs)} MB, ${mb(free)} MB free). Nothing was changed. Space has to be freed before Prepare Voice will work.`);
  }

  let source = null;
  const output = await media.tmpPath('voice.flac');
  try {
    source = await media.openStoredFile(clip.s3_key_raw);
    const input = source.url;
    const { stdout } = await media.run(media.FFPROBE, clips.probeArgs(input), { timeoutMs: 60 * 1000 });
    const probe = studio.readAudioProbe(stdout.toString());
    if (!probe.hasAudio) throw new FootageJobError('NO_AUDIO', 'This clip has no sound, so there is no voice to prepare.');

    await media.run(media.FFMPEG, extractArgs(input, output, clips.netInputArgs(input)), { low: true, timeoutMs: EXTRACT_TIMEOUT_MS });
    // ffmpeg can end "successfully" with part of the sound when its read breaks (#3645): checked here.
    if (source.stats && source.stats.failures > 0) {
      throw new FootageJobError('INCOMPLETE', "The original video couldn't be read to the end. It will be tried again automatically.", { retryable: true });
    }
    const { stdout: outInfo } = await media.run(media.FFPROBE, clips.probeArgs(output), { timeoutMs: 60 * 1000 });
    const got = studio.readAudioProbe(outInfo.toString());
    const expected = probe.duration_ms ? probe.duration_ms / 1000 : null;
    if (!clips.cutoutComplete(got.duration_ms ? got.duration_ms / 1000 : null, expected)) {
      throw new FootageJobError('INCOMPLETE', "The original video couldn't be read to the end. It will be tried again automatically.", { retryable: true });
    }
    return await studio.createExtractedSource(sequelize, {
      episodeId: job.episode_id, rawClipId: job.raw_clip_id, localPath: output, contentType: 'audio/flac', ext: path.extname(output) || '.flac', userId: job.requested_by,
    });
  } finally {
    if (source) await source.close();
    await media.removeFile(output);
  }
}

module.exports = { AUDIO_MB_PER_SECOND, MARGIN_BYTES, audioRoomNeeded, extractArgs, classify, runExtract };
