// The browser measures every upload (Evoni, 2026-10-28: a 453 MB phone MP4
// showed only "453 MB"): a normal length, the seek-past-the-end trick for a
// file with no length in its header, a video that never loads (timeout),
// and the thumbnail kept under 500 KB and 640 px wide. HTMLVideoElement and
// the canvas are fakes; nothing real is decoded.
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { probeVideo, thumbnailTime, fitWidth, lengthWritable, THUMB_MAX_BYTES } from './videoProbe';
import { measureForUpload, uploadFields } from './rawClipsApi';

/**
 * A fake <video>: `src` loads metadata (unless `never`), `currentTime` seeks.
 * duration: what the header says (Infinity for a fragmented MP4); real: the
 * length the browser finds when asked to seek past the end.
 */
class FakeVideo extends EventTarget {
  constructor(opts) {
    super();
    this.opts = opts;
    this.duration = NaN;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.seeks = [];
    this.attrs = {};
    this._t = 0;
  }

  canPlayType(type) { return this.opts.canPlay === false ? '' : (type ? 'maybe' : ''); }

  setAttribute(k, v) { this.attrs[k] = v; }

  removeAttribute(k) { delete this.attrs[k]; this.emptied = true; }

  load() {}

  set src(url) {
    this._src = url;
    if (this.opts.never) return;
    setTimeout(() => {
      if (this.opts.broken) { this.error = { code: 4, message: 'unsupported' }; this.dispatchEvent(new Event('error')); return; }
      this.duration = this.opts.duration;
      this.videoWidth = this.opts.width;
      this.videoHeight = this.opts.height;
      this.dispatchEvent(new Event('loadedmetadata'));
    }, 1);
  }

  get src() { return this._src; }

  get currentTime() { return this._t; }

  set currentTime(t) {
    this.seeks.push(t);
    this._t = t;
    setTimeout(() => {
      if (t > 1e100) {
        if (this.opts.real == null) return; // never finds it
        this.duration = this.opts.real;
        this._t = this.opts.real;
        this.dispatchEvent(new Event('durationchange'));
        this.dispatchEvent(new Event('timeupdate'));
        return;
      }
      this.dispatchEvent(new Event('seeked'));
    }, 1);
  }
}

/** A fake canvas: toBlob makes a JPEG of `bytesAt(quality)` bytes. */
function fakeDoc(videoOpts, bytesAt = () => 40 * 1024) {
  const made = { videos: [], canvases: [] };
  const doc = {
    createElement(tag) {
      if (tag === 'video') { const v = new FakeVideo(videoOpts); made.videos.push(v); return v; }
      if (tag === 'canvas') {
        const c = {
          width: 0, height: 0, qualities: [],
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob(cb, type, q) { c.qualities.push(q); cb(new Blob([new Uint8Array(bytesAt(q))], { type })); },
        };
        made.canvases.push(c);
        return c;
      }
      throw new Error(`unexpected ${tag}`);
    },
  };
  return { doc, made };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:probe');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const file = (type = 'video/mp4', name = 'phone.mp4') => new File([new Uint8Array(64)], name, { type });

describe('probeVideo', () => {
  test('a normal video: its length, width, height and a thumbnail from 1 second in; the object URL is revoked', async () => {
    const { doc, made } = fakeDoc({ duration: 481.43, width: 1080, height: 1920 });
    const out = await probeVideo(file(), { doc });
    expect(out).toMatchObject({ seconds: 481.43, width: 1080, height: 1920, problems: [] });
    expect(out.thumbnail).toMatch(/^data:image\/jpeg;base64,/);
    expect(out.thumbnailBytes).toBe(40 * 1024);
    const v = made.videos[0];
    expect(v.muted).toBe(true);
    expect(v.playsInline).toBe(true);
    expect(v.preload).toBe('metadata');
    expect(v.seeks).toEqual([1]); // no seek past the end needed
    expect(made.canvases[0]).toMatchObject({ width: 640, height: 1138, qualities: [0.8] });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:probe');
    expect(v.emptied).toBe(true);
  });

  test('no length in the header (Infinity): seeks far past the end, reads the real length, then seeks back for the thumbnail', async () => {
    const { doc, made } = fakeDoc({ duration: Infinity, real: 482.6, width: 720, height: 1280 });
    const out = await probeVideo(file(), { doc });
    expect(out.seconds).toBe(482.6);
    expect(out).toMatchObject({ width: 720, height: 1280 });
    expect(made.videos[0].seeks).toEqual([1e101, 1]);
    expect(made.canvases[0]).toMatchObject({ width: 640, height: 1138 });
    expect(out.thumbnail).toMatch(/^data:image\/jpeg/);
  });

  test('NaN too; a short clip takes its thumbnail 10% in; a length already known skips the trick', async () => {
    const short = fakeDoc({ duration: NaN, real: 4, width: 640, height: 360 });
    const a = await probeVideo(file('video/webm', 'take.webm'), { doc: short.doc });
    expect(a.seconds).toBe(4);
    expect(short.made.videos[0].seeks).toEqual([1e101, 0.4]);
    expect(short.made.canvases[0]).toMatchObject({ width: 640, height: 360 });
    const known = fakeDoc({ duration: Infinity, real: 99, width: 1280, height: 720 });
    const b = await probeVideo(file('video/webm', 'take.webm'), { doc: known.doc, knownSeconds: 41.234 });
    expect(b.seconds).toBe(41.23);
    expect(known.made.videos[0].seeks).toEqual([1]);
  });

  test('a video that never loads: gives up at the time limit, logs it, returns what it has, and still revokes the URL', async () => {
    const { doc } = fakeDoc({ never: true });
    const started = Date.now();
    const out = await probeVideo(file(), { doc, timeoutMs: 40 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(out).toMatchObject({ seconds: null, width: null, height: null, thumbnail: null });
    expect(out.problems[0]).toMatch(/not measured: timed out waiting for loadedmetadata/);
    expect(console.warn).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:probe');
  });

  test('a length the seek never finds stays unknown; the size and thumbnail still come back', async () => {
    const { doc } = fakeDoc({ duration: Infinity, real: null, width: 1080, height: 1920 });
    const out = await probeVideo(file(), { doc, timeoutMs: 60 });
    expect(out.seconds).toBeNull();
    expect(out).toMatchObject({ width: 1080, height: 1920 });
    expect(out.problems.join(' ')).toMatch(/length was not found/);
  });

  test('a known length is kept when the video can\'t be read; a type this browser can\'t play is not waited on', async () => {
    const broken = fakeDoc({ broken: true });
    expect(await probeVideo(file(), { doc: broken.doc, knownSeconds: 12 })).toMatchObject({ seconds: 12, width: null, thumbnail: null });
    const cant = fakeDoc({ canPlay: false });
    const out = await probeVideo(file('video/x-matroska', 'a.mkv'), { doc: cant.doc });
    expect(out.problems[0]).toMatch(/can't open video\/x-matroska/);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  test('the thumbnail is kept under 500 KB: the quality steps down until it fits, or there is none', async () => {
    const sizes = { 0.8: 900 * 1024, 0.65: 620 * 1024, 0.5: 480 * 1024, 0.35: 300 * 1024 };
    const { doc, made } = fakeDoc({ duration: 30, width: 3840, height: 2160 }, (q) => sizes[q]);
    const out = await probeVideo(file(), { doc });
    expect(made.canvases[0].qualities).toEqual([0.8, 0.65, 0.5]);
    expect(made.canvases[0]).toMatchObject({ width: 640, height: 360 });
    expect(out.thumbnailBytes).toBe(480 * 1024);
    expect(out.thumbnailBytes).toBeLessThanOrEqual(THUMB_MAX_BYTES);
    const huge = fakeDoc({ duration: 30, width: 3840, height: 2160 }, () => 800 * 1024);
    const none = await probeVideo(file(), { doc: huge.doc });
    expect(none.thumbnail).toBeNull();
    expect(none.seconds).toBe(30);
    expect(none.problems.join(' ')).toMatch(/stayed over 500 KB/);
  });

  test('helpers: where the thumbnail is taken, the 640 px fit, and which files get their length written', () => {
    expect(thumbnailTime(481)).toBe(1);
    expect(thumbnailTime(5)).toBe(0.5);
    expect(thumbnailTime(null)).toBe(0);
    expect(fitWidth(1080, 1920)).toEqual({ width: 640, height: 1138 });
    expect(fitWidth(480, 270)).toEqual({ width: 480, height: 270 });
    expect(lengthWritable(file())).toBe(true);
    expect(lengthWritable(file('video/webm', 'x.webm'))).toBe(true);
    expect(lengthWritable(file('', 'x.MP4'))).toBe(true);
    expect(lengthWritable(file('video/quicktime', 'x.mov'))).toBe(false);
  });
});

describe('measureForUpload (what an upload sends)', () => {
  test('an MP4 with a measured length gets it written into the file (same name and type); the measure comes back', async () => {
    const f = file();
    const probe = vi.fn(async () => ({ seconds: 481.4, width: 1080, height: 1920, thumbnail: 'data:image/jpeg;base64,/9j/AA==' }));
    const writeLength = vi.fn(async (b) => new Blob([b, new Uint8Array(16)], { type: b.type }));
    const m = await measureForUpload(f, { probe, writeLength });
    expect(writeLength).toHaveBeenCalledWith(f, 481.4);
    expect(m.file).not.toBe(f);
    expect(m.file.name).toBe('phone.mp4');
    expect(m.file.type).toBe('video/mp4');
    expect(m).toMatchObject({ seconds: 481.4, width: 1080, height: 1920, thumbnail: 'data:image/jpeg;base64,/9j/AA==' });
    expect(uploadFields({ performer: 'lala', seconds: m.seconds, width: m.width, height: m.height })).toMatchObject({ seconds: 481.4, width: 1080, height: 1920 });
  });

  test('a .mov, or no length: the file goes as it is; a probe that throws never stops the upload', async () => {
    const mov = file('video/quicktime', 'a.mov');
    const writeLength = vi.fn();
    const m = await measureForUpload(mov, { probe: async () => ({ seconds: 10, width: 1, height: 1 }), writeLength });
    expect(m.file).toBe(mov);
    expect(writeLength).not.toHaveBeenCalled();
    const f = file();
    const out = await measureForUpload(f, { probe: async () => { throw new Error('boom'); }, writeLength });
    expect(out).toEqual({ file: f, seconds: null, width: null, height: null, thumbnail: null });
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/not measured/), expect.any(Error));
  });
});
