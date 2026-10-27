/**
 * A take's length written into its file (Evoni, 2026-10-27: her 22-minute
 * take downloaded with a length of 0:00 in her phone's player). The
 * recorder writes the take in one-second pieces, so Chrome's file has no
 * length in its header: a fragmented MP4 with mvhd duration 0 and no mehd,
 * or a WebM with no Duration in its Segment Info. The app's own player
 * works the length out; a phone's gallery can't, and can't seek either.
 *
 * withDuration(blob, seconds) writes the length the recorder measured into
 * the header only, without re-encoding: the first few MB are read, patched,
 * and put back in front of the rest of the file as a Blob slice, so a
 * 400 MB take is never copied into memory. Anything it does not recognise,
 * or can't patch safely, comes back unchanged (logged).
 *
 * MP4: mvhd (movie timescale), each trak's tkhd (movie timescale) and mdhd
 * (its media timescale), and mvex/mehd (added when missing; mvex and moov
 * grow by its size). Growing moov moves every fragment, which is only safe
 * when the fragments' data offsets count from their own moof: that is
 * checked in the first moof (no tfhd base-data-offset), and a file with an
 * mfra index at its end (absolute offsets) is left alone.
 *
 * WebM: the Segment Info gets a Duration (float, in TimecodeScale units) as
 * the fix-webm-duration package does; a known Segment size and SeekHead
 * positions after Info move with it. A file with Cues listed is left alone.
 */

const HEAD_BYTES = 4 * 1024 * 1024;

const ascii = (b, at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const u64 = (b, at) => u32(b, at) * 2 ** 32 + u32(b, at + 4);
const put32 = (b, at, v) => { b[at] = (v >>> 24) & 255; b[at + 1] = (v >>> 16) & 255; b[at + 2] = (v >>> 8) & 255; b[at + 3] = v & 255; };
const put64 = (b, at, v) => { put32(b, at, Math.floor(v / 2 ** 32)); put32(b, at + 4, v % 2 ** 32); };

// ── MP4 ─────────────────────────────────────────────────────────────────────

/** The boxes in b[start, end): [{ type, start, header, end }]; null when a size is impossible. */
function boxes(b, start, end) {
  const out = [];
  let at = start;
  while (at + 8 <= end) {
    let size = u32(b, at);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) break;
      size = u64(b, at + 8);
      header = 16;
    } else if (size === 0) size = end - at;
    if (size < header) return null;
    out.push({ type: ascii(b, at + 4), start: at, header, end: at + size });
    at += size;
  }
  return out;
}
const child = (list, type) => (list || []).find((x) => x.type === type) || null;
const kids = (b, box) => boxes(b, box.start + box.header, Math.min(box.end, b.length));

/** Writes a duration field (v0: 32-bit at off0, v1: 64-bit at off1). False when it does not fit. */
function setDuration(b, box, off0, off1, value) {
  const at = box.start + box.header;
  const v = b[at];
  if (v === 1) { put64(b, at + off1, value); return true; }
  if (value > 0xffffffff) return false;
  put32(b, at + off0, value);
  return true;
}
const readField = (b, box, off) => u32(b, box.start + box.header + off);

/** Whether the fragments' data offsets count from their own moof (no absolute base offset). */
function moofRelative(b, moof) {
  const trafs = (kids(b, moof) || []).filter((x) => x.type === 'traf');
  if (!trafs.length) return false;
  return trafs.every((traf) => {
    const tfhd = child(kids(b, traf), 'tfhd');
    if (!tfhd) return false;
    const flags = u32(b, tfhd.start + tfhd.header) & 0xffffff;
    return (flags & 0x000001) === 0; // base-data-offset-present: absolute file offsets
  });
}

/**
 * The fragmented MP4 head with its duration set: { head, consumed } (the
 * new bytes, and how many of the original's they replace), or null when the
 * file is not one, already has a length, or can't be patched safely.
 */
export function patchMp4Head(bytes, seconds) {
  const b = bytes;
  const top = boxes(b, 0, b.length);
  if (!top || top[0]?.type !== 'ftyp') return null;
  const moov = child(top, 'moov');
  if (!moov || moov.header !== 8 || moov.end > b.length) { console.warn('[takeDuration] mp4: no whole moov in the head; left as it is'); return null; }
  const moof = top.find((x) => x.type === 'moof' && x.start >= moov.end);
  if (!moof || moof.end > b.length) { console.warn('[takeDuration] mp4: no fragment to check in the head; left as it is'); return null; }
  if (!moofRelative(b, moof)) { console.warn('[takeDuration] mp4: fragments use absolute offsets; left as it is'); return null; }

  const inMoov = kids(b, moov);
  const mvhd = child(inMoov, 'mvhd');
  const mvex = child(inMoov, 'mvex');
  if (!mvhd || !mvex || mvex.header !== 8) return null;
  const mvhdV = b[mvhd.start + mvhd.header];
  const timescale = readField(b, mvhd, mvhdV === 1 ? 20 : 12);
  const current = mvhdV === 1 ? u64(b, mvhd.start + mvhd.header + 24) : readField(b, mvhd, 16);
  if (current !== 0 && current !== 0xffffffff) return null; // it has a length already
  const secs = Number(seconds);
  if (!timescale || !Number.isFinite(secs) || secs <= 0) return null;

  // In place first (the same sizes), on a copy of moov.
  const m = b.slice(moov.start, moov.end);
  const shift = (box) => ({ ...box, start: box.start - moov.start, end: box.end - moov.start });
  const movie = Math.round(secs * timescale);
  if (!setDuration(m, shift(mvhd), 16, 24, movie)) return null;
  for (const trak of inMoov.filter((x) => x.type === 'trak')) {
    const inTrak = kids(b, trak);
    const tkhd = child(inTrak, 'tkhd');
    if (tkhd && !setDuration(m, shift(tkhd), 20, 28, movie)) return null;
    const mdia = child(inTrak, 'mdia');
    const mdhd = mdia ? child(kids(b, mdia), 'mdhd') : null;
    if (mdhd) {
      const v = b[mdhd.start + mdhd.header];
      const ts = readField(b, mdhd, v === 1 ? 20 : 12);
      if (ts && !setDuration(m, shift(mdhd), 16, 24, Math.round(secs * ts))) return null;
    }
  }

  // mehd: updated in place, or added at the start of mvex (moov and mvex grow).
  const mehd = child(kids(b, mvex), 'mehd');
  let moovOut = m;
  if (mehd) {
    // mehd's fragment_duration sits right after version/flags (32-bit in v0, 64-bit in v1).
    const at = mehd.start - moov.start + mehd.header;
    if (m[at] === 1) put64(m, at + 4, movie);
    else if (movie > 0xffffffff) return null;
    else put32(m, at + 4, movie);
  } else {
    if (movie > 0xffffffff) return null;
    const add = new Uint8Array(16);
    put32(add, 0, 16);
    add.set([0x6d, 0x65, 0x68, 0x64], 4); // 'mehd'
    put32(add, 12, movie);
    const cut = mvex.start - moov.start + mvex.header;
    moovOut = new Uint8Array(m.length + 16);
    moovOut.set(m.subarray(0, cut), 0);
    moovOut.set(add, cut);
    moovOut.set(m.subarray(cut), cut + 16);
    put32(moovOut, 0, m.length + 16);
    put32(moovOut, mvex.start - moov.start, (mvex.end - mvex.start) + 16);
  }
  const head = new Uint8Array(moov.start + moovOut.length);
  head.set(b.subarray(0, moov.start), 0);
  head.set(moovOut, moov.start);
  return { head, consumed: moov.end };
}

// ── WebM (EBML) ─────────────────────────────────────────────────────────────

const ID = { EBML: 0x1a45dfa3, SEGMENT: 0x18538067, SEEKHEAD: 0x114d9b74, SEEK: 0x4dbb, SEEKID: 0x53ab, SEEKPOS: 0x53ac, INFO: 0x1549a966, SCALE: 0x2ad7b1, DURATION: 0x4489, CUES: 0x1c53bb6b, CLUSTER: 0x1f43b675 };

/** An element ID at `at`: { id, length } (marker bits kept), or null. */
function readId(b, at) {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 4 && !(first & (0x80 >> (len - 1)))) len += 1;
  if (len > 4 || at + len > b.length) return null;
  let id = 0;
  for (let i = 0; i < len; i += 1) id = id * 256 + b[at + i];
  return { id, length: len };
}
/** A size at `at`: { value, length, unknown }, or null. */
function readSize(b, at) {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len += 1;
  if (len > 8 || at + len > b.length) return null;
  let value = first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i += 1) { value = value * 256 + b[at + i]; if (b[at + i] !== 0xff) allOnes = false; }
  return { value, length: len, unknown: allOnes };
}
/** `value` as a size of exactly `len` bytes, or null when it does not fit. */
function sizeBytes(value, len) {
  if (value >= 2 ** (7 * len) - 1) return null;
  const out = new Uint8Array(len);
  let v = value;
  for (let i = len - 1; i >= 0; i -= 1) { out[i] = v % 256; v = Math.floor(v / 256); }
  out[0] |= 0x80 >> (len - 1);
  return out;
}
/** The element at `at`: { id, start, dataStart, end, size }, or null. */
function element(b, at) {
  const id = readId(b, at);
  if (!id) return null;
  const size = readSize(b, at + id.length);
  if (!size) return null;
  const dataStart = at + id.length + size.length;
  return { id: id.id, start: at, idLength: id.length, sizeLength: size.length, dataStart, end: size.unknown ? Infinity : dataStart + size.value, unknown: size.unknown, size: size.value };
}
/** The child elements of [start, end) that fit in b (stops at a cluster or the end of the bytes). */
function children(b, start, end) {
  const out = [];
  let at = start;
  while (at < Math.min(end, b.length)) {
    const el = element(b, at);
    if (!el || el.unknown) break;
    out.push(el);
    if (el.id === ID.CLUSTER) break;
    at = el.end;
  }
  return out;
}
const uintAt = (b, at, len) => { let v = 0; for (let i = 0; i < len; i += 1) v = v * 256 + b[at + i]; return v; };
const floatAt = (b, el) => {
  const view = new DataView(b.buffer, b.byteOffset + el.dataStart, el.size);
  return el.size === 4 ? view.getFloat32(0) : el.size === 8 ? view.getFloat64(0) : NaN;
};

/**
 * The WebM head with a Duration in its Segment Info: { head, consumed }, or
 * null when it is not a WebM, has a length already, or can't be patched safely.
 */
export function patchWebmHead(bytes, seconds) {
  const b = bytes;
  const ebml = element(b, 0);
  if (!ebml || ebml.id !== ID.EBML || ebml.end > b.length) return null;
  const seg = element(b, ebml.end);
  if (!seg || seg.id !== ID.SEGMENT) return null;
  const inSeg = children(b, seg.dataStart, seg.end);
  const info = inSeg.find((e) => e.id === ID.INFO);
  if (!info || info.end > b.length) { console.warn('[takeDuration] webm: no whole Segment Info in the head; left as it is'); return null; }
  const secs = Number(seconds);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  const inInfo = children(b, info.dataStart, info.end);
  const scaleEl = inInfo.find((e) => e.id === ID.SCALE);
  const scale = scaleEl ? uintAt(b, scaleEl.dataStart, scaleEl.size) : 1000000;
  const value = (secs * 1e9) / (scale || 1000000);
  const durEl = inInfo.find((e) => e.id === ID.DURATION);

  if (durEl) {
    const now = floatAt(b, durEl);
    if (now > 0) return null; // it has a length already
    if (durEl.size !== 4 && durEl.size !== 8) return null;
    const head = b.slice(0, info.end);
    const view = new DataView(head.buffer, durEl.dataStart, durEl.size);
    if (durEl.size === 4) view.setFloat32(0, value); else view.setFloat64(0, value);
    return { head, consumed: info.end };
  }

  // A new Duration (float64) at the end of Info; Info, a known Segment size
  // and SeekHead positions past Info grow with it.
  const dur = new Uint8Array(11);
  dur.set([0x44, 0x89, 0x88], 0);
  new DataView(dur.buffer).setFloat64(3, value);
  const infoData = info.end - info.dataStart + dur.length;
  let infoSize = sizeBytes(infoData, info.sizeLength);
  if (!infoSize) infoSize = sizeBytes(infoData, 8);
  const newInfoLength = info.idLength + infoSize.length + infoData;
  const delta = newInfoLength - (info.end - info.start);

  const head = new Uint8Array(info.end + delta);
  head.set(b.subarray(0, info.start), 0);
  head.set(b.subarray(info.start, info.start + info.idLength), info.start);
  head.set(infoSize, info.start + info.idLength);
  const dataAt = info.start + info.idLength + infoSize.length;
  head.set(b.subarray(info.dataStart, info.end), dataAt);
  head.set(dur, dataAt + (info.end - info.dataStart));

  if (!seg.unknown) {
    const s = sizeBytes(seg.size + delta, seg.sizeLength);
    if (!s) { console.warn('[takeDuration] webm: the Segment size does not fit; left as it is'); return null; }
    head.set(s, seg.start + seg.idLength);
  }
  // SeekHead entries (positions from the Segment's data) past Info move by delta.
  const infoRel = info.start - seg.dataStart;
  for (const sh of inSeg.filter((e) => e.id === ID.SEEKHEAD && e.end <= info.start)) {
    for (const seek of children(b, sh.dataStart, sh.end).filter((e) => e.id === ID.SEEK)) {
      const parts = children(b, seek.dataStart, seek.end);
      const idEl = parts.find((e) => e.id === ID.SEEKID);
      const posEl = parts.find((e) => e.id === ID.SEEKPOS);
      if (!idEl || !posEl) continue;
      if (uintAt(b, idEl.dataStart, idEl.size) === ID.CUES) { console.warn('[takeDuration] webm: it has Cues; left as it is'); return null; }
      const pos = uintAt(b, posEl.dataStart, posEl.size);
      if (pos <= infoRel) continue;
      const next = pos + delta;
      if (next >= 2 ** (8 * posEl.size)) { console.warn('[takeDuration] webm: a SeekHead position does not fit; left as it is'); return null; }
      let v = next;
      for (let i = posEl.size - 1; i >= 0; i -= 1) { head[posEl.dataStart + i] = v % 256; v = Math.floor(v / 256); }
    }
  }
  if (inSeg.some((e) => e.id === ID.SEEKHEAD && e.start > info.start)) { console.warn('[takeDuration] webm: a SeekHead after Info; left as it is'); return null; }
  return { head, consumed: info.end };
}

// ── The Blob ────────────────────────────────────────────────────────────────

/** Bytes [start, end) of a Blob. */
function readBytes(blob, start, end) {
  const part = blob.slice(start, end);
  if (typeof part.arrayBuffer === 'function') return part.arrayBuffer().then((buf) => new Uint8Array(buf));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(r.error || new Error('The take could not be read'));
    r.readAsArrayBuffer(part);
  });
}

/**
 * The take with its length in its header (an MP4 or a WebM from the
 * recorder), or the same blob when it has one, is something else, or can't
 * be patched (logged). Never throws.
 */
export async function withDuration(blob, seconds, { headBytes = HEAD_BYTES } = {}) {
  try {
    if (!blob || !blob.size || !(Number(seconds) > 0)) return blob;
    const head = await readBytes(blob, 0, Math.min(blob.size, headBytes));
    let patched = null;
    if (head.length >= 8 && ascii(head, 4) === 'ftyp') {
      // An mfra index at the end holds absolute offsets that growing moov would break.
      const tail = blob.size >= 16 ? await readBytes(blob, blob.size - 16, blob.size) : new Uint8Array(0);
      if (tail.length === 16 && ascii(tail, 4) === 'mfro') { console.warn('[takeDuration] mp4 has an mfra index; left as it is'); return blob; }
      patched = patchMp4Head(head, seconds);
    } else if (head.length >= 4 && u32(head, 0) === ID.EBML) {
      patched = patchWebmHead(head, seconds);
    }
    if (!patched) return blob;
    return new Blob([patched.head, blob.slice(patched.consumed)], { type: blob.type });
  } catch (err) {
    console.error('[takeDuration] the length was not written into the take:', err);
    return blob;
  }
}
