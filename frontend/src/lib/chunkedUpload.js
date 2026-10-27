/**
 * Sending a video in parts (Evoni, 2026-10-27: a 22-minute take, about
 * 430 MB, failed to save because the server's disk filled up). The file is
 * cut into 8 MB slices; each goes up on its own and is passed straight on to
 * the video storage, so nothing big waits on the server. A slice that fails
 * is tried again (up to 3 more times, waiting longer each time); when the
 * whole save fails, the slices already sent are remembered, and Retry sends
 * only the rest. Pure: no React, no network of its own (the caller sends).
 */

export const PART_SIZE = 8 * 1024 * 1024;
export const PART_RETRIES = 3;
export const RETRY_DELAYS_MS = [1000, 3000, 8000];

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The slices of a file of `size` bytes: [{ partNumber, start, end }] (end exclusive). */
export function slicePlan(size, partSize = PART_SIZE) {
  const total = Math.max(0, Number(size) || 0);
  const step = Math.max(1, Number(partSize) || PART_SIZE);
  const count = Math.max(1, Math.ceil(total / step));
  return Array.from({ length: count }, (_, i) => ({ partNumber: i + 1, start: i * step, end: Math.min(total, (i + 1) * step) }));
}

/**
 * Whether a failed slice is worth sending again: the connection dropped, it
 * timed out, the server was busy or briefly down. Not: a refusal (4xx), a
 * sign-in that is over, or the server's disk being full (507).
 */
export function worthRetrying(err) {
  if (!err) return false;
  if (err.sessionExpired) return false;
  if (err.authRefreshed) return true;
  const status = err.response?.status;
  if (!status) return true; // no answer: the connection dropped or timed out
  if (status === 408 || status === 429) return true;
  return status >= 500 && status !== 507;
}

/**
 * Runs fn(); on a failure worth retrying, tries again up to `retries` more
 * times, waiting delays[i] between. Rejects with the last error.
 */
export async function withRetry(fn, { retries = PART_RETRIES, delays = RETRY_DELAYS_MS, sleep = wait, shouldRetry = worthRetrying, onRetry } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const ms = delays[Math.min(attempt, delays.length - 1)] ?? 1000;
      console.warn(`[chunkedUpload] part failed, trying again in ${ms} ms (try ${attempt + 2} of ${retries + 1}):`, err?.response?.status ?? err?.message ?? err);
      onRetry?.(attempt + 1, err);
      attempt += 1;
      // eslint-disable-next-line no-await-in-loop
      await sleep(ms);
    }
  }
}

/** Whole percent of `sent` bytes out of `total`. */
export const percentOf = (sent, total) => (total > 0 ? Math.min(100, Math.floor((sent * 100) / total)) : 100);

/**
 * Sends the blob's slices that are not in `done` (part numbers already
 * sent), one at a time, in order. send(partNumber, slice, onLoaded) sends
 * one slice (onLoaded(bytes) as it goes). onProgress(percent) for the whole
 * file; onPartDone(partNumber) after each slice is sent. Resolves the part
 * numbers sent in all; rejects with the first slice that failed its retries
 * (the ones before it count as done).
 */
export async function uploadInParts({
  blob, partSize = PART_SIZE, done = [], send, onProgress, onPartDone,
  retries = PART_RETRIES, delays = RETRY_DELAYS_MS, sleep = wait,
}) {
  const size = blob?.size || 0;
  const plan = slicePlan(size, partSize);
  const sent = new Set((done || []).filter((n) => plan.some((p) => p.partNumber === n)));
  let bytes = plan.filter((p) => sent.has(p.partNumber)).reduce((n, p) => n + (p.end - p.start), 0);
  const report = (b) => onProgress?.(percentOf(b, size));
  report(bytes);
  for (const p of plan) {
    if (sent.has(p.partNumber)) continue;
    const slice = blob.slice(p.start, p.end);
    const length = p.end - p.start;
    // eslint-disable-next-line no-await-in-loop
    await withRetry(() => send(p.partNumber, slice, (loaded) => report(bytes + Math.min(Number(loaded) || 0, length))), { retries, delays, sleep });
    bytes += length;
    sent.add(p.partNumber);
    onPartDone?.(p.partNumber);
    report(bytes);
  }
  return [...sent].sort((a, b) => a - b);
}

/**
 * A small JPEG of the video's first second, made in the browser (a data:
 * URL, at most maxBytes), or null when this browser can't (logged). Never
 * waits longer than timeoutMs.
 */
export function makeThumbnail(blob, { at = 1, maxWidth = 480, quality = 0.7, maxBytes = 450 * 1024, timeoutMs = 8000, doc = typeof document !== 'undefined' ? document : null } = {}) {
  if (!blob || !doc) return Promise.resolve(null);
  let canvas;
  let ctx = null;
  try {
    canvas = doc.createElement('canvas');
    ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  } catch (err) {
    console.warn('[chunkedUpload] no canvas for the thumbnail:', err);
    return Promise.resolve(null);
  }
  if (!ctx) return Promise.resolve(null);
  // A browser that can't play this kind of video can't draw a frame of it either.
  try {
    const probe = doc.createElement('video');
    if (typeof probe.canPlayType !== 'function' || !probe.canPlayType(blob.type || 'video/mp4')) return Promise.resolve(null);
  } catch (err) {
    console.warn('[chunkedUpload] could not ask whether the video plays:', err);
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let url = null;
    let settled = false;
    const video = doc.createElement('video');
    const end = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (url) URL.revokeObjectURL(url); } catch (err) { console.warn('[chunkedUpload] thumbnail URL not revoked:', err); }
      resolve(value);
    };
    const timer = setTimeout(() => { console.warn('[chunkedUpload] thumbnail took too long; the server makes one'); end(null); }, timeoutMs);
    try {
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadeddata = () => {
        const d = Number(video.duration);
        const t = Number.isFinite(d) && d > 0 ? Math.min(at, d / 3) : 0;
        if (t > 0) video.currentTime = t; else video.onseeked();
      };
      video.onseeked = () => {
        try {
          const w = video.videoWidth || 0;
          const h = video.videoHeight || 0;
          if (!w || !h) { end(null); return; }
          const scale = Math.min(1, maxWidth / w);
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL('image/jpeg', quality);
          const bytes = Math.floor(((data.length - data.indexOf(',') - 1) * 3) / 4);
          end(/^data:image\/jpeg;base64,/.test(data) && bytes <= maxBytes ? data : null);
        } catch (err) {
          console.warn('[chunkedUpload] thumbnail not drawn:', err);
          end(null);
        }
      };
      video.onerror = () => { console.warn('[chunkedUpload] thumbnail: the video did not load'); end(null); };
      url = URL.createObjectURL(blob);
      video.src = url;
    } catch (err) {
      console.warn('[chunkedUpload] thumbnail not made:', err);
      end(null);
    }
  });
}
