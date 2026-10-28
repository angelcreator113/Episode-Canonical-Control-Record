/**
 * The browser measures a video before it is uploaded (Evoni, 2026-10-28:
 * a 453 MB phone MP4 uploaded on Assets → Files showed only "453 MB": no
 * length, no size, no picture, and the player sat at 0:00). The server's
 * own measure (ffprobe over a signed link) came back with nothing, so every
 * upload, from Files and the teleprompter alike, now sends what the browser
 * saw: its length, width, height and a small JPEG thumbnail. The server
 * still tries ffprobe first and uses these for whatever it can't read.
 *
 * probeVideo(blob) loads the file into a detached, muted <video> through an
 * object URL (nothing is copied or sent), reads its length and size, seeks
 * to about 1 second in (10% of a short clip) and draws that frame on a
 * canvas no wider than 640 px. A file whose header has no length (a phone's
 * or a recorder's fragmented MP4, a browser's WebM) reads as Infinity: the
 * known way round is to seek far past the end, when the browser works the
 * length out and reports it, then seek back.
 *
 * Never throws and never holds an upload up: every step waits at most
 * what is left of about 15 seconds; on any failure it logs and resolves
 * what it has (null for the rest). The object URL is always revoked.
 */

export const PROBE_TIMEOUT_MS = 15000;
export const THUMB_MAX_WIDTH = 640;
export const THUMB_MAX_BYTES = 500 * 1024;
// JPEG qualities tried in turn until the thumbnail is under THUMB_MAX_BYTES.
export const THUMB_QUALITIES = [0.8, 0.65, 0.5, 0.35];
const FAR_PAST_THE_END = 1e101;

const usable = (n) => Number.isFinite(n) && n > 0;
const round2 = (n) => Math.round(n * 100) / 100;

/** The seconds of a <video>, or null while it has none (Infinity, NaN, 0). */
const lengthOf = (video) => {
  const d = Number(video?.duration);
  return usable(d) ? d : null;
};

/** Where the thumbnail is taken: about 1 second in, or 10% of a clip under 10 seconds. */
export const thumbnailTime = (seconds) => (usable(seconds) ? Math.min(1, seconds * 0.1) : 0);

/** A width and height scaled to at most maxWidth wide. */
export function fitWidth(width, height, maxWidth = THUMB_MAX_WIDTH) {
  const scale = width > maxWidth ? maxWidth / width : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Whether the file is an MP4 or a WebM (the kinds withDuration can write a length into). */
export function lengthWritable(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  return /^video\/(mp4|webm)\b/.test(type) || /\.(mp4|m4v|webm)$/.test(name);
}

/**
 * Waits for one of `events` on the video (resolving its name), or rejects
 * on an `error` event or when `ms` runs out. ok(video, name) can turn an
 * event down (keep waiting). Listeners are always removed.
 */
function waitFor(video, events, ms, ok = () => true) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const handlers = {};
    const done = (fn, value) => {
      clearTimeout(timer);
      events.forEach((e) => video.removeEventListener(e, handlers[e]));
      video.removeEventListener('error', handlers.error);
      fn(value);
    };
    events.forEach((e) => {
      handlers[e] = () => { if (ok(video, e)) done(resolve, e); };
      video.addEventListener(e, handlers[e]);
    });
    handlers.error = () => done(reject, new Error(`the video could not be read (${video.error?.message || video.error?.code || 'error'})`));
    video.addEventListener('error', handlers.error);
    timer = setTimeout(() => done(reject, new Error(`timed out waiting for ${events.join('/')}`)), Math.max(0, ms));
  });
}

/** A canvas as a JPEG Blob at `quality`, or null. */
const jpegBlob = (canvas, quality) => new Promise((resolve) => {
  try {
    canvas.toBlob((b) => resolve(b || null), 'image/jpeg', quality);
  } catch (err) {
    console.warn('[videoProbe] the frame could not be turned into a JPEG:', err);
    resolve(null);
  }
});

/** A Blob as a data: URL (what the server takes as the thumbnail). */
export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error || new Error('the thumbnail could not be read'));
  r.readAsDataURL(blob);
});

/**
 * Measures a video file in the browser. Resolves { seconds, width, height,
 * thumbnail, thumbnailBytes, problems }: seconds to two decimals, width and
 * height in pixels, thumbnail a JPEG data: URL under maxBytes; each null
 * when it could not be had. problems lists, in plain words for the log,
 * what went wrong. knownSeconds: a length already known (a teleprompter
 * take): used when the file's own is missing, and skips the seek-past-the-end.
 */
export async function probeVideo(blob, {
  timeoutMs = PROBE_TIMEOUT_MS, knownSeconds = null, maxWidth = THUMB_MAX_WIDTH, maxBytes = THUMB_MAX_BYTES,
  qualities = THUMB_QUALITIES, doc = typeof document !== 'undefined' ? document : null, now = () => Date.now(),
} = {}) {
  const out = { seconds: null, width: null, height: null, thumbnail: null, thumbnailBytes: null, problems: [] };
  const known = usable(Number(knownSeconds)) ? Number(knownSeconds) : null;
  const problem = (what, err) => {
    out.problems.push(err ? `${what}: ${err.message || err}` : what);
    console.warn(`[videoProbe] ${what}${err ? ':' : ''}`, err ? (err.message || err) : '');
  };
  if (!blob || !doc || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    problem('nothing to measure here (no file, or no browser to measure it in)');
    if (known) out.seconds = round2(known);
    return out;
  }
  const deadline = now() + timeoutMs;
  const left = () => Math.max(0, deadline - now());
  let url = null;
  let video = null;
  try {
    video = doc.createElement('video');
    // A browser that says it can't play this kind of file: don't wait on it.
    // (A .mov is often H.264 a browser plays though it says it can't; an
    // unknown type is tried too.)
    const type = String(blob.type || '');
    if (type && !/quicktime/i.test(type) && typeof video.canPlayType === 'function' && !video.canPlayType(type)) {
      problem(`this browser can't open ${type} files to measure them`);
      if (known) out.seconds = round2(known);
      return out;
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    try { video.setAttribute?.('playsinline', ''); video.setAttribute?.('muted', ''); } catch (err) {
      console.warn('[videoProbe] attributes not set on the probe video:', err);
    }
    url = URL.createObjectURL(blob);
    const loaded = waitFor(video, ['loadedmetadata'], left());
    video.src = url;
    await loaded;

    out.width = usable(video.videoWidth) ? Math.round(video.videoWidth) : null;
    out.height = usable(video.videoHeight) ? Math.round(video.videoHeight) : null;
    let seconds = lengthOf(video);
    if (seconds == null && known) seconds = known;
    if (seconds == null) {
      // No length in the header: seek far past the end; the browser reports the real length.
      try {
        const found = waitFor(video, ['durationchange', 'timeupdate', 'seeked'], left(), (v) => lengthOf(v) != null);
        video.currentTime = FAR_PAST_THE_END;
        await found;
        seconds = lengthOf(video);
      } catch (err) {
        problem('the length was not found by seeking to the end', err);
      }
    }
    out.seconds = seconds != null ? round2(seconds) : null;

    // The thumbnail: about 1 second in (10% of a short clip).
    if (out.width && out.height && typeof doc.createElement === 'function') {
      try {
        const seeked = waitFor(video, ['seeked'], left());
        video.currentTime = thumbnailTime(out.seconds);
        await seeked;
        const size = fitWidth(video.videoWidth || out.width, video.videoHeight || out.height, maxWidth);
        const canvas = doc.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!ctx || typeof canvas.toBlob !== 'function') throw new Error('this browser has no canvas to draw on');
        ctx.drawImage(video, 0, 0, size.width, size.height);
        let jpeg = null;
        for (const q of qualities) {
          if (left() <= 0) throw new Error('ran out of time making the thumbnail');
          // eslint-disable-next-line no-await-in-loop
          const b = await jpegBlob(canvas, q);
          if (b && b.size <= maxBytes) { jpeg = b; break; }
        }
        if (!jpeg) throw new Error(`the thumbnail stayed over ${Math.round(maxBytes / 1024)} KB`);
        out.thumbnail = await blobToDataUrl(jpeg);
        out.thumbnailBytes = jpeg.size;
      } catch (err) {
        problem('no thumbnail', err);
      }
    }
  } catch (err) {
    problem('the video was not measured', err);
    if (out.seconds == null && known) out.seconds = round2(known);
  } finally {
    try {
      if (video) { video.removeAttribute?.('src'); video.load?.(); }
    } catch (err) {
      console.warn('[videoProbe] the probe video was not emptied:', err);
    }
    try { if (url) URL.revokeObjectURL(url); } catch (err) {
      console.warn('[videoProbe] the object URL was not revoked:', err);
    }
  }
  return out;
}
