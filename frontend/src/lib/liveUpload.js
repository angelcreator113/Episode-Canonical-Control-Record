/**
 * Saving a take while it records (Evoni, 2026-10-28: a long take should be
 * mostly saved by the time she presses Stop). The take's upload in parts
 * (lib/rawClipsApi sendInParts, 8 MB parts straight to the video storage)
 * starts once the take has its first full part, before its size is known
 * (the server's size_unknown), and each 8 MB part goes up as soon as the
 * recorder has made it. At Stop the last parts go up from the finished file;
 * the upload is completed only when she presses Save, through the same
 * sendInParts (its `resume`), which finds the parts already there and sends
 * only what is missing. A part that fails, a server that forgot the upload,
 * a page that reloads: the parts sent are kept (meta.upload in lib/takeStore),
 * and the existing Retry sends the rest.
 *
 * The length in the header (lib/takeDuration withDuration). The recorder's
 * file has no length in its head, and the length is only known at Stop, but
 * part 1 goes up long before. Writing it can also make the head longer (an
 * MP4 gains a 16-byte mehd box, a WebM an 11-byte Duration), which would
 * move every byte after it, and so every part. The design:
 *  - How much the head grows never depends on the length written, only on
 *    the file's own structure (the same boxes or elements, whatever the
 *    number in them). So it is worked out from the head as soon as it is in
 *    (headGrowth, with a stand-in length): `delta` bytes.
 *  - The file that ends up in Files is the finished one: the patched head,
 *    then the rest of the recording. Its part k (from 2) is bytes
 *    [(k-1)·8 MB − delta, k·8 MB − delta) of the recording, the same bytes
 *    whatever the length turns out to be: those go up while recording.
 *  - Part 1 (the patched head and the recording's bytes up to 8 MB − delta)
 *    waits for Stop, when the length is known, and is then exactly 8 MB, so
 *    every part but the last is exactly 8 MB, as the server checks. (Any
 *    part that holds some of the patched head waits; with 8 MB parts and a
 *    head of a few KB that is part 1 alone.)
 *  - At Stop the finished file (withDuration, as Save and Download use) must
 *    be exactly the recording's size + delta. If it is not (the patch could
 *    not be made after all: a length too big for its field, an mfra index),
 *    the parts sent do not fit it: the upload is thrown away and Save
 *    uploads the file from the start, as before. Never a corrupted file.
 *  - A head that can't be patched (delta unknown): part 1 goes up with the
 *    others, as recorded; if withDuration then changes it without changing
 *    its size (a length field already there), part 1 is sent again.
 *
 * Pure: no React. The network goes through `transport` (tests pass their own).
 */
import api from '../services/api';
import { PART_SIZE, uploadInParts, withRetry, worthRetrying, PART_RETRIES, RETRY_DELAYS_MS } from './chunkedUpload';
import { patchMp4Head, patchWebmHead } from './takeDuration';

/** As much of the head as withDuration reads. */
export const HEAD_BYTES = 4 * 1024 * 1024;
/** More than this not yet sent (a slow connection): live saving stops; Save sends the rest. */
export const HOLD_LIMIT = 6 * PART_SIZE;
const PART_TIMEOUT_MS = 5 * 60 * 1000;
const EBML = 0x1a45dfa3;

const ascii = (b, at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];

/** Bytes of a Blob as a Uint8Array (arrayBuffer, or FileReader where there is none). */
export function readBlob(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(r.error || new Error('The take could not be read'));
    r.readAsArrayBuffer(blob);
  });
}

/**
 * How many bytes writing the length adds to this head: { delta, consumed },
 * or null when withDuration would leave it as it is (not an MP4 or WebM it
 * can patch, or a length already there). The number written does not change
 * the answer, so a stand-in length of 1 second is used.
 */
export function headGrowth(head) {
  try {
    let patched = null;
    if (head.length >= 8 && ascii(head, 4) === 'ftyp') patched = patchMp4Head(head, 1);
    else if (head.length >= 4 && u32(head, 0) === EBML) patched = patchWebmHead(head, 1);
    if (!patched) return null;
    return { delta: patched.head.length - patched.consumed, consumed: patched.consumed };
  } catch (err) {
    console.error('[liveUpload] the head was not read; parts go up as recorded:', err);
    return null;
  }
}

/**
 * What a page that reloaded mid-take kept (meta.upload, its size not known
 * then) made ready for Retry with the take brought back (`blobSize`): the
 * finished file's size (the recording plus the head's growth), and part 1
 * left to send again. Null when there is nothing to resume.
 */
export function restoredUpload(upload, blobSize) {
  if (!upload?.uploadId || !Array.isArray(upload.done)) return null;
  if (Number(upload.size) > 0) return upload;
  const delta = Number.isInteger(upload.delta) ? upload.delta : 0;
  return { ...upload, size: Number(blobSize) + delta, done: upload.done.filter((n) => n !== 1) };
}

/** Whole percent of the finished file already sent, or null before its size is known. */
export function sentPercent(state) {
  const size = Number(state?.size);
  if (!(size > 0) || !Array.isArray(state?.done)) return null;
  const p = state.partSize || PART_SIZE;
  const bytes = state.done.reduce((n, k) => n + Math.max(0, Math.min(p, size - (k - 1) * p)), 0);
  return Math.min(100, Math.floor((bytes * 100) / size));
}

const base = (episodeId) => `/api/v1/episode-clips/${episodeId}/uploads`;

/** The real network: start without a size, one part, and throw away. */
export const liveTransport = {
  start: (episodeId, body) => api.post(base(episodeId), body, { keepSession: true }).then((r) => r.data),
  part: (episodeId, uploadId, n, blob) => api.put(`${base(episodeId)}/${encodeURIComponent(uploadId)}/parts/${n}`, blob, {
    keepSession: true, timeout: PART_TIMEOUT_MS, headers: { 'Content-Type': 'application/octet-stream' },
  }),
  abort: (episodeId, uploadId) => api.delete(`${base(episodeId)}/${encodeURIComponent(uploadId)}`).then(() => true),
};

class Stopped extends Error {
  constructor() { super('The take was thrown away'); this.stopped = true; }
}

/**
 * One take's upload while it records. fields: rawClipsApi uploadFields() for
 * the start (performer is required there; the rest can change at Save).
 * onState(state): the upload as Retry needs it ({ uploadId, clipId,
 * partSize, size, done, delta }; size null until Stop; null when it is
 * gone), after every change. onChange(snapshot) for the page.
 *
 * Methods: push(blob) each piece as it is recorded; stop() when it stops;
 * finish(recording,
 * finished) at Stop (the recording as recorded, and the file Save sends);
 * abort() throws it away (on the server too); detach() stops without
 * throwing it away (the page closed: Retry carries on later); snapshot().
 */
export function createLiveUpload({
  episodeId, filename = 'take.webm', contentType = 'video/webm', fields = {},
  transport = liveTransport, partSize = PART_SIZE, holdLimit = HOLD_LIMIT, headBytes = HEAD_BYTES,
  onState, onChange, retries = PART_RETRIES, delays = RETRY_DELAYS_MS, sleep,
} = {}) {
  // waiting: no upload yet (under one part) | live | behind (too much waiting:
  // stopped sending) | failed | finishing (after Stop) | ready (every part
  // there) | off (nothing to do: a short take, or it did not fit) | aborted
  let status = 'waiting';
  let error = null;
  let chunks = []; // the recording's pieces not sent yet: [{ start, end, blob }]
  let total = 0;
  let growth; // undefined: not looked at yet; null: no patch; { delta }
  let state = null;
  let next = 1;
  let loop = null;
  let again = false;
  let stopped = false;
  let finishing = null;

  const snapshot = () => ({ status, uploadId: state?.uploadId || null, done: state?.done ? [...state.done] : [], size: state?.size ?? null, percent: sentPercent(state), error });
  const emit = () => { try { onChange?.(snapshot()); } catch (err) { console.error('[liveUpload] onChange failed:', err); } };
  const keep = (st) => {
    state = st;
    try { onState?.(st); } catch (err) { console.error('[liveUpload] onState failed:', err); }
    emit();
  };
  const shift = () => (growth ? growth.delta : 0);
  // Part k's bytes in the recording (k from 2 when part 1 waits for Stop).
  const range = (k) => [(k - 1) * partSize - shift(), k * partSize - shift()];
  const bytesOf = (start, end) => new Blob(
    chunks.filter((c) => c.end > start && c.start < end).map((c) => c.blob.slice(Math.max(0, start - c.start), Math.min(c.end, end) - c.start)),
    { type: 'application/octet-stream' },
  );
  const dropBefore = (at) => { chunks = chunks.filter((c) => c.end > at); };
  const held = () => (chunks.length ? total - chunks[0].start : 0);

  const sendPart = (n, body) => withRetry(() => {
    if (stopped && status === 'aborted') throw new Stopped();
    return transport.part(episodeId, state.uploadId, n, body);
  }, { retries, delays, sleep, shouldRetry: (err) => !err?.stopped && worthRetrying(err) });

  const pump = async () => {
    while (!stopped && status !== 'failed' && status !== 'behind' && status !== 'aborted' && status !== 'off') {
      if (!state) {
        // The first full part, and the whole head to read (8 MB covers the 4 MB head).
        if (total < Math.max(partSize, headBytes)) return;
        if (growth === undefined) growth = headGrowth(await readBlob(bytesOf(0, Math.min(total, headBytes))));
        if (stopped) return;
        const r = await transport.start(episodeId, { ...fields, filename, content_type: contentType, size_unknown: true });
        if (status === 'aborted') {
          transport.abort(episodeId, r.uploadId).catch((err) => console.error('[liveUpload] upload not thrown away:', err));
          return;
        }
        if ((r.partSize || partSize) !== partSize) {
          console.warn('[liveUpload] the server uses another part size; Save uploads the take as before');
          transport.abort(episodeId, r.uploadId).catch((err) => console.error('[liveUpload] upload not thrown away:', err));
          status = 'off';
          emit();
          return;
        }
        // The first part wholly past the patched head (part 2 for any real
        // head: 8 MB is far more than its few KB) goes first; the ones before wait for Stop.
        next = growth ? Math.ceil((growth.consumed + growth.delta) / partSize) + 1 : 1;
        status = 'live';
        keep({ uploadId: r.uploadId, clipId: r.clipId, partSize, size: null, done: [], delta: growth ? growth.delta : null });
        if (growth) dropBefore(range(next)[0]);
        continue;
      }
      const [start, end] = range(next);
      if (total < end) return;
      const n = next;
      await sendPart(n, bytesOf(start, end));
      if (status === 'aborted') return;
      next += 1;
      keep({ ...state, done: [...state.done, n] });
      dropBefore(range(next)[0]);
    }
  };

  const kick = () => {
    if (loop) { again = true; return loop; }
    loop = (async () => {
      do {
        again = false;
        try {
          // eslint-disable-next-line no-await-in-loop
          await pump();
        } catch (err) {
          if (!err?.stopped) {
            console.error('[liveUpload] saving while recording stopped; Save sends the rest:', err);
            error = err;
            status = 'failed';
            chunks = [];
            emit();
          }
          again = false;
        }
      } while (again && !stopped);
    })().finally(() => { loop = null; });
    return loop;
  };

  return {
    get status() { return status; },
    get state() { return state; },
    snapshot,

    /** One piece of the recording, in order. */
    push(blob) {
      if (stopped || !blob?.size) return;
      const start = total;
      total += blob.size;
      if (status !== 'waiting' && status !== 'live') return;
      chunks.push({ start, end: total, blob });
      if (held() > holdLimit) {
        console.warn('[liveUpload] the connection is behind the recording; the rest goes up at Save');
        status = 'behind';
        chunks = [];
        emit();
        return;
      }
      kick();
    },

    /**
     * Stop: the last parts from the finished file (part 1 with the length in
     * its head). Resolves the upload's state for Save (sendInParts resume),
     * or null when Save should upload the take from the start (a short take,
     * or one whose finished file does not line up with the parts sent).
     */
    finish(recording, finished) {
      if (finishing) return finishing;
      finishing = (async () => {
        stopped = true;
        if (loop) await loop;
        chunks = [];
        if (status === 'aborted') return null;
        if (!state) { status = 'off'; emit(); return null; }
        const expected = (recording?.size || 0) + shift();
        if (!finished || finished.size !== expected) {
          console.warn(`[liveUpload] the finished take (${finished?.size} bytes) does not line up with the parts sent while recording (${expected}); Save uploads it from the start`);
          const id = state.uploadId;
          status = 'off';
          keep(null);
          transport.abort(episodeId, id).catch((err) => console.error('[liveUpload] upload not thrown away:', err));
          return null;
        }
        // No patch was expected, but the length was written in place: part 1 again.
        let done = state.done;
        if (!growth && finished !== recording) done = done.filter((n) => n !== 1);
        keep({ ...state, size: finished.size, done });
        if (status === 'failed') {
          if (error?.response?.status === 404) { status = 'off'; keep(null); return null; }
          return state;
        }
        status = 'finishing';
        emit();
        try {
          await uploadInParts({
            blob: finished, partSize, done: state.done, retries, delays, sleep,
            send: (n, slice) => {
              if (status === 'aborted') throw new Stopped();
              return transport.part(episodeId, state.uploadId, n, slice);
            },
            onPartDone: (n) => { if (status !== 'aborted') keep({ ...state, done: [...state.done, n] }); },
          });
          if (status === 'aborted') return null;
          status = 'ready';
        } catch (err) {
          if (status === 'aborted') return null;
          console.error('[liveUpload] the last parts did not go up; Save sends them:', err);
          error = err;
          status = 'failed';
          if (err?.response?.status === 404) { status = 'off'; keep(null); return null; }
        }
        emit();
        return state;
      })();
      return finishing;
    },

    /** Throws the upload away, here and on the server (Discard, Retake). */
    async abort() {
      const id = state?.uploadId || null;
      stopped = true;
      status = 'aborted';
      chunks = [];
      if (state) keep(null); else emit();
      if (!id) return false;
      try {
        await transport.abort(episodeId, id);
        return true;
      } catch (err) {
        console.error('[liveUpload] upload not thrown away (the server forgets it within 6 hours):', err);
        return false;
      }
    },

    /**
     * The recording stopped: no more pieces, and no upload starts now (a
     * take that never filled a part while recording goes up whole at Save);
     * parts already started finish, and finish() does the rest.
     */
    stop() {
      if (!state) { stopped = true; chunks = []; return; }
      stopped = true;
    },

    /** Stops sending without throwing the upload away (the page is closing). */
    detach() {
      stopped = true;
      chunks = [];
    },
  };
}
