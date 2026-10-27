// A take's length written into its header (Evoni, 2026-10-27: a downloaded
// 22-minute take showed 0:00 in her phone's player). Tiny synthetic files:
// a fragmented MP4 and a WebM get a duration with consistent sizes; files
// already with a length, unknown files and unsafe ones come back unchanged.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { patchMp4Head, patchWebmHead, withDuration } from './takeDuration';

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => { out.set(p, at); at += p.length; });
  return out;
};
const be32 = (v) => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
const be64 = (v) => cat(be32(Math.floor(v / 2 ** 32)), be32(v % 2 ** 32));
const str = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const box = (type, ...payload) => { const body = cat(...payload); return cat(be32(body.length + 8), str(type), body); };
const full = (type, version, flags, ...payload) => box(type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...payload);
const zeros = (n) => new Uint8Array(n);
const read32 = (b, at) => new DataView(b.buffer, b.byteOffset).getUint32(at);

// A fragmented MP4 as Chrome's recorder writes it: no length in moov.
function mp4({ tfhdFlags = 0x020000, mvhdDuration = 0, mehd = null } = {}) {
  const mvhd = full('mvhd', 0, 0, be32(0), be32(0), be32(1000), be32(mvhdDuration), zeros(80));
  const tkhd = full('tkhd', 0, 3, be32(0), be32(0), be32(1), be32(0), be32(0), zeros(60));
  const mdhd = full('mdhd', 0, 0, be32(0), be32(0), be32(90000), be32(0), zeros(4));
  const trak = box('trak', tkhd, box('mdia', mdhd));
  const mvex = box('mvex', ...(mehd ? [mehd] : []), full('trex', 0, 0, be32(1), be32(1), zeros(12)));
  const moov = box('moov', mvhd, trak, mvex);
  const moof = box('moof', full('mfhd', 0, 0, be32(1)), box('traf', full('tfhd', 0, tfhdFlags, be32(1)), full('trun', 0, 1, be32(1), be32(8))));
  return cat(box('ftyp', str('isom'), be32(512), str('isomiso2')), moov, moof, box('mdat', str('frames!!')));
}
const findBox = (b, type, from = 0) => { for (let i = from; i < b.length - 4; i += 1) if (String.fromCharCode(...b.subarray(i, i + 4)) === type) return i - 4; return -1; };

describe('fragmented MP4', () => {
  test('mvhd, tkhd, mdhd get the length; mehd is added; moov and mvex sizes grow by its 16 bytes; the rest is untouched', () => {
    const file = mp4();
    const { head, consumed } = patchMp4Head(file, 1320.5); // 22 minutes
    const out = cat(head, file.subarray(consumed));
    expect(out.length).toBe(file.length + 16);
    const moov = findBox(out, 'moov');
    const mvhd = findBox(out, 'mvhd');
    expect(read32(out, mvhd + 8 + 4 + 12)).toBe(1320500); // movie timescale 1000
    const tkhd = findBox(out, 'tkhd');
    expect(read32(out, tkhd + 8 + 4 + 16)).toBe(1320500);
    const mdhd = findBox(out, 'mdhd');
    expect(read32(out, mdhd + 8 + 4 + 12)).toBe(Math.round(1320.5 * 90000)); // its own timescale
    const mvex = findBox(out, 'mvex');
    const mehd = findBox(out, 'mehd');
    expect(mehd).toBe(mvex + 8);
    expect(read32(out, mehd)).toBe(16);
    expect(read32(out, mehd + 12)).toBe(1320500);
    // Sizes add up: moov ends where moof begins, mvex holds mehd + trex.
    expect(moov + read32(out, moov)).toBe(findBox(out, 'moof'));
    expect(read32(out, mvex)).toBe(8 + 16 + 32);
    // Everything after moov is byte for byte the same.
    expect(out.subarray(moov + read32(out, moov))).toEqual(file.subarray(consumed));
  });

  test('an existing mehd (v1) is updated in place', () => {
    const file = mp4({ mehd: full('mehd', 1, 0, be64(0)) });
    const { head, consumed } = patchMp4Head(file, 10);
    const out = cat(head, file.subarray(consumed));
    expect(out.length).toBe(file.length);
    const mehd = findBox(out, 'mehd');
    expect(read32(out, mehd + 16)).toBe(10000);
  });

  test('left unchanged: a length already there, absolute fragment offsets, not an MP4', () => {
    expect(patchMp4Head(mp4({ mvhdDuration: 5000 }), 10)).toBeNull();
    expect(patchMp4Head(mp4({ tfhdFlags: 0x000001 }), 10)).toBeNull();
    expect(patchMp4Head(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), 10)).toBeNull();
    expect(patchMp4Head(mp4(), 0)).toBeNull();
  });
});

// EBML pieces.
const el = (id, ...payload) => { const body = cat(...payload); return cat(id, new Uint8Array([0x80 | body.length]), body); };
const ID = { EBML: [0x1a, 0x45, 0xdf, 0xa3], SEG: [0x18, 0x53, 0x80, 0x67], INFO: [0x15, 0x49, 0xa9, 0x66], SCALE: [0x2a, 0xd7, 0xb1], APP: [0x4d, 0x80], TRACKS: [0x16, 0x54, 0xae, 0x6b], CLUSTER: [0x1f, 0x43, 0xb6, 0x75], SEEKHEAD: [0x11, 0x4d, 0x9b, 0x74], SEEK: [0x4d, 0xbb], SEEKID: [0x53, 0xab], SEEKPOS: [0x53, 0xac], DUR: [0x44, 0x89] };
const u8 = (a) => new Uint8Array(a);
const UNKNOWN = u8([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const f64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };

function webm({ seekHead = false, duration = null, knownSize = false } = {}) {
  const info = el(u8(ID.INFO), el(u8(ID.SCALE), u8([0x0f, 0x42, 0x40])), el(u8(ID.APP), str('Chrome')), ...(duration == null ? [] : [el(u8(ID.DUR), f64(duration))]));
  const tracks = el(u8(ID.TRACKS), u8([0xae, 0x80]));
  const cluster = el(u8(ID.CLUSTER), u8([0xe7, 0x81, 0x00]));
  const seek = seekHead ? el(u8(ID.SEEKHEAD), el(u8(ID.SEEK), el(u8(ID.SEEKID), u8(ID.TRACKS)), el(u8(ID.SEEKPOS), u8([0x00, 0x00, 0x00, 0x00])))) : u8([]);
  if (seekHead) {
    // Tracks sits after SeekHead and Info, from the Segment's data start.
    const pos = seek.length + info.length;
    seek.set(be32(pos), seek.length - 4);
  }
  const body = cat(seek, info, tracks, cluster);
  const segSize = knownSize ? cat(u8([0x01]), u8([0, 0, 0, 0, 0, 0, body.length])) : UNKNOWN;
  return cat(el(u8(ID.EBML), u8([0x42, 0x86, 0x81, 0x01])), u8(ID.SEG), segSize, body);
}
const findSeq = (b, seq) => { for (let i = 0; i <= b.length - seq.length; i += 1) if (seq.every((x, k) => b[i + k] === x)) return i; return -1; };

describe('WebM', () => {
  test('a Duration (ms at the default scale) is added to Segment Info; Info\'s size grows by it; the rest is untouched', () => {
    const file = webm();
    const { head, consumed } = patchWebmHead(file, 1320.5);
    const out = cat(head, file.subarray(consumed));
    expect(out.length).toBe(file.length + 11);
    const info = findSeq(out, ID.INFO);
    const infoSize = out[info + 4] & 0x7f;
    const dur = findSeq(out, ID.DUR);
    expect(dur).toBe(info + 5 + infoSize - 11);
    expect(out[dur + 2]).toBe(0x88);
    expect(new DataView(out.buffer, out.byteOffset + dur + 3, 8).getFloat64(0)).toBe(1320500);
    expect(findSeq(out, ID.TRACKS)).toBe(info + 5 + infoSize);
    expect(out.subarray(head.length)).toEqual(file.subarray(consumed));
  });

  test('a known Segment size and a SeekHead position past Info move with it', () => {
    const file = webm({ seekHead: true, knownSize: true });
    const { head, consumed } = patchWebmHead(file, 2);
    const out = cat(head, file.subarray(consumed));
    const seg = findSeq(out, ID.SEG);
    const size = read32(out, seg + 8); // the 8-byte size's low 4 bytes
    expect(seg + 4 + 8 + size).toBe(out.length);
    const posAt = findSeq(out, ID.SEEKPOS) + 3;
    // (Tracks' ID also appears inside the SeekHead: look after Info.)
    const info = findSeq(out, ID.INFO);
    const tracksRel = info + findSeq(out.subarray(info), ID.TRACKS) - (seg + 12);
    expect(tracksRel).toBe(read32(file, findSeq(file, ID.SEEKPOS) + 3) + 11);
    expect(read32(out, posAt)).toBe(tracksRel);
  });

  test('left unchanged: a length already there; a zero Duration is filled in place', () => {
    expect(patchWebmHead(webm({ duration: 5000 }), 10)).toBeNull();
    const file = webm({ duration: 0 });
    const { head, consumed } = patchWebmHead(file, 10);
    const out = cat(head, file.subarray(consumed));
    expect(out.length).toBe(file.length);
    expect(new DataView(out.buffer, out.byteOffset + findSeq(out, ID.DUR) + 3, 8).getFloat64(0)).toBe(10000);
  });
});

describe('withDuration (the Blob)', () => {
  const bytesOf = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result)); r.readAsArrayBuffer(blob); });

  test('an MP4 take comes back with its length; the type is kept', async () => {
    const blob = new Blob([mp4()], { type: 'video/mp4' });
    const out = await withDuration(blob, 12);
    expect(out).not.toBe(blob);
    expect(out.type).toBe('video/mp4');
    expect(out.size).toBe(blob.size + 16);
    const b = await bytesOf(out);
    expect(read32(b, findBox(b, 'mvhd') + 8 + 4 + 12)).toBe(12000);
  });

  test('a WebM take comes back with its length', async () => {
    const out = await withDuration(new Blob([webm()], { type: 'video/webm' }), 3);
    expect(out.size).toBe(webm().length + 11);
  });

  test('unknown files, no length measured, or an MP4 with an mfra index come back as they are', async () => {
    const odd = new Blob([u8([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])], { type: 'video/webm' });
    expect(await withDuration(odd, 5)).toBe(odd);
    const take = new Blob([mp4()], { type: 'video/mp4' });
    expect(await withDuration(take, 0)).toBe(take);
    const indexed = new Blob([mp4(), box('mfra', full('mfro', 0, 0, be32(16)))], { type: 'video/mp4' });
    expect(await withDuration(indexed, 5)).toBe(indexed);
  });
});
