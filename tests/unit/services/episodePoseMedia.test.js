/**
 * Character poses, the image work (episodePoseMedia; Evoni, 2026-10-20):
 * which photos are upscaled, the trim box, the halo cut, reading uploads,
 * the colour step, the edge step, background removal and its fallbacks,
 * and a whole run start to finish. Real sharp on made-up images; no S3,
 * remove.bg, Runway or Replicate (all mocked), no database (setState mocked).
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: (...a) => mockSend(...a) })),
  PutObjectCommand: jest.fn((input) => ({ put: input })),
  GetObjectCommand: jest.fn((input) => ({ get: input })),
}));
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../../src/services/imageCostService', () => {
  const isBudgetError = (err) => err && err.code === 'AI_BUDGET_EXCEEDED';
  return { runImageCall: jest.fn((plan, fn) => fn()), isBudgetError };
});
jest.mock('../../../src/services/RunwayMLService', () => ({ isConfigured: jest.fn(() => false), removeBackground: jest.fn() }));
jest.mock('../../../src/services/wardrobeImageService', () => ({ aiUpscaleImage: jest.fn() }));
jest.mock('../../../src/services/episodePosesService', () => {
  const actual = jest.requireActual('../../../src/services/episodePosesService');
  return { ...actual, setState: jest.fn(async () => ({})) };
});

// The upload bucket comes from the server's settings (src/services/assetBucket.js).
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

const sharp = require('sharp');
const axios = require('axios');
const { runImageCall } = require('../../../src/services/imageCostService');
const runway = require('../../../src/services/RunwayMLService');
const { aiUpscaleImage } = require('../../../src/services/wardrobeImageService');
const poses = require('../../../src/services/episodePosesService');
const media = require('../../../src/services/episodePoseMedia');

const photo = (width, height, background = '#7A6A5A') => sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer();

/** A transparent PNG with an opaque block (her) and a faint smudge (halo) far from it. */
async function cutout(width = 200, height = 300) {
  const data = Buffer.alloc(width * height * 4);
  const paint = (x0, y0, x1, y1, a) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = 200; data[i + 1] = 150; data[i + 2] = 120; data[i + 3] = a;
      }
    }
  };
  paint(80, 100, 120, 260, 255); // her
  paint(5, 5, 15, 15, 12); // halo
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.REMOVEBG_API_KEY;
  delete process.env.REMOVE_BG_API_KEY;
  delete process.env.REPLICATE_API_TOKEN;
  mockSend.mockResolvedValue({});
  runway.isConfigured.mockReturnValue(false);
});
afterAll(() => { process.env = ORIGINAL_ENV; });

describe('the pure pieces', () => {
  test('upscaleFactor: none from 1600px tall, x2 from 800, x4 below', () => {
    expect(media.upscaleFactor(1600)).toBe(0);
    expect(media.upscaleFactor(3000)).toBe(0);
    expect(media.upscaleFactor(1599)).toBe(2);
    expect(media.upscaleFactor(800)).toBe(2);
    expect(media.upscaleFactor(799)).toBe(4);
    expect(media.upscaleFactor(null)).toBe(0);
  });

  test('alphaBounds: the box around what is opaque, padded and kept inside; null when empty', () => {
    const w = 10; const h = 10;
    const alpha = Buffer.alloc(w * h);
    alpha[3 * w + 4] = 255;
    alpha[6 * w + 5] = 255;
    expect(media.alphaBounds(alpha, w, h, { pad: 1 })).toEqual({ left: 3, top: 2, width: 4, height: 6 });
    expect(media.alphaBounds(alpha, w, h, { pad: 50 })).toEqual({ left: 0, top: 0, width: 10, height: 10 });
    expect(media.alphaBounds(Buffer.alloc(w * h), w, h)).toBeNull();
  });

  test('cutHalo: faint alpha goes, the rest stretches back to 0-255', () => {
    expect(media.cutHalo(0)).toBe(0);
    expect(media.cutHalo(media.EDGE_CUT)).toBe(0);
    expect(media.cutHalo(255)).toBe(255);
    expect(media.cutHalo(140)).toBeGreaterThan(120);
  });
});

describe('readUpload', () => {
  test('reads a JPG\'s size; a photo turned by EXIF reads upright', async () => {
    expect(await media.readUpload(await photo(300, 400))).toEqual({ width: 300, height: 400, format: 'jpeg' });
    const turned = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#888' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect(await media.readUpload(turned)).toMatchObject({ width: 300, height: 400 });
  });

  test('a file that is not a photo, or a GIF, is a 400 that says what to use', async () => {
    await expect(media.readUpload(Buffer.from('not an image'))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/JPG, PNG or WebP/) });
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#888' } }).gif().toBuffer();
    await expect(media.readUpload(gif)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/gif file/) });
  });
});

describe('colorFix and cleanEdges', () => {
  test('colorFix returns a JPEG no larger than 4000px on the long side', async () => {
    const out = await media.colorFix(await photo(4400, 2200));
    expect([out.width, out.height]).toEqual([4000, 2000]);
    expect((await sharp(out.buffer).metadata()).format).toBe('jpeg');
    const small = await media.colorFix(await photo(300, 500));
    expect([small.width, small.height]).toEqual([300, 500]);
  });

  test('cleanEdges drops the faint halo and trims to her, keeping 8px', async () => {
    const out = await media.cleanEdges(await cutout());
    // her block is 40 x 160 at (80, 100); the halo at (5, 5) is gone, so the box is hers plus 8px.
    expect([out.width, out.height]).toEqual([56, 176]);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.hasAlpha).toBe(true);
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0); // the corner is transparent
    const mid = ((info.height >> 1) * info.width + (info.width >> 1)) * 4;
    expect(data[mid + 3]).toBe(255); // she is opaque
  });

  test('cleanEdges with nobody left says so', async () => {
    const empty = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await expect(media.cleanEdges(empty)).rejects.toThrow(/Nobody was left in the photo/);
  });
});

describe('removeBackground', () => {
  test('with nothing set up it says which key the server needs', async () => {
    await expect(media.removeBackground(Buffer.from('x'))).rejects.toThrow(/not set up on the server \(REMOVEBG_API_KEY\)/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('remove.bg, gated and logged, as a person, PNG out', async () => {
    process.env.REMOVEBG_API_KEY = 'k';
    axios.post.mockResolvedValue({ data: Buffer.from('png') });
    const out = await media.removeBackground(Buffer.from('jpg'));
    expect(out).toEqual({ buffer: Buffer.from('png'), provider: 'remove.bg' });
    expect(runImageCall).toHaveBeenCalledWith({ model: 'remove.bg', provider: 'removebg' }, expect.any(Function));
    const [url, form, opts] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.remove.bg/v1.0/removebg');
    expect(form.getBuffer().toString()).toMatch(/name="type"\r\n\r\nperson/);
    expect(opts.headers['X-Api-Key']).toBe('k');
  });

  test('Runway steps in when remove.bg fails, but never after a budget refusal', async () => {
    process.env.REMOVEBG_API_KEY = 'k';
    runway.isConfigured.mockReturnValue(true);
    runway.removeBackground.mockResolvedValue(Buffer.from('rw'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.post.mockRejectedValueOnce(new Error('remove.bg is down'));
    await expect(media.removeBackground(Buffer.from('jpg'))).resolves.toEqual({ buffer: Buffer.from('rw'), provider: 'runway' });

    axios.post.mockRejectedValueOnce(Object.assign(new Error('budget'), { code: 'AI_BUDGET_EXCEEDED' }));
    runway.removeBackground.mockClear();
    await expect(media.removeBackground(Buffer.from('jpg'))).rejects.toThrow('budget');
    expect(runway.removeBackground).not.toHaveBeenCalled();
  });
});

describe('processPose, start to finish', () => {
  const putKeys = () => mockSend.mock.calls.map(([cmd]) => cmd.put?.Key).filter(Boolean);

  test('a small photo: colour, x4 upscale, remove.bg, edges; three states recorded, ready last', async () => {
    process.env.REMOVEBG_API_KEY = 'k';
    process.env.REPLICATE_API_TOKEN = 't';
    aiUpscaleImage.mockImplementation(async (url, { scale }) => ({ buffer: await photo(200 * scale, 300 * scale) }));
    axios.post.mockResolvedValue({ data: await cutout(800, 1200) });
    const job = { sequelize: {}, poseId: 'p1', episodeId: 'ep1', originalKey: 'k', buffer: await photo(200, 300), steps: {} };

    await media.processPose(job);

    expect(aiUpscaleImage).toHaveBeenCalledWith(expect.stringMatching(/episodes\/ep1\/poses\/p1\/\d+-enhanced\.jpg$/), { scale: 4, faceEnhance: false });
    expect(putKeys()).toEqual([
      expect.stringMatching(/^episodes\/ep1\/poses\/p1\/\d+-enhanced\.jpg$/),
      expect.stringMatching(/^episodes\/ep1\/poses\/p1\/\d+-enhanced-x4\.jpg$/),
      expect.stringMatching(/^episodes\/ep1\/poses\/p1\/\d+-final\.png$/),
    ]);
    expect(job.steps).toEqual({ color: true, upscale: 'x4', background: 'remove.bg', edges: true });
    const states = poses.setState.mock.calls.map((c) => c[2]);
    expect(states).toEqual(['processing', 'processing', 'ready']);
    const ready = poses.setState.mock.calls[2][3];
    expect(ready).toMatchObject({ finalUrl: expect.stringMatching(/-final\.png$/), finalWidth: expect.any(Number), finalHeight: expect.any(Number) });
    expect(job.buffer).toBeNull();
  });

  test('a large photo is not upscaled; no Replicate token skips it and says so; a failed upscale goes on without it', async () => {
    process.env.REMOVEBG_API_KEY = 'k';
    axios.post.mockResolvedValue({ data: await cutout() });

    const big = { sequelize: {}, poseId: 'p2', episodeId: 'ep1', buffer: await photo(1200, 1800), steps: {} };
    await media.processPose(big);
    expect(big.steps.upscale).toBe('not needed');

    const noToken = { sequelize: {}, poseId: 'p3', episodeId: 'ep1', buffer: await photo(200, 300), steps: {} };
    await media.processPose(noToken);
    expect(noToken.steps.upscale).toBe('skipped: upscaling is not set up on the server');

    process.env.REPLICATE_API_TOKEN = 't';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    aiUpscaleImage.mockRejectedValueOnce(new Error('GPU out of memory'));
    const failed = { sequelize: {}, poseId: 'p4', episodeId: 'ep1', buffer: await photo(200, 300), steps: {} };
    await media.processPose(failed);
    expect(failed.steps).toMatchObject({ upscale: 'skipped: the upscale failed', background: 'remove.bg', edges: true });
    expect(aiUpscaleImage).toHaveBeenCalledTimes(1);
    // The failed upscale's file is never stored: only the plain enhanced photo and the cut-out.
    expect(putKeys().filter((k) => k.includes('/p4/'))).toEqual([
      expect.stringMatching(/\d+-enhanced\.jpg$/), expect.stringMatching(/\d+-final\.png$/),
    ]);
  });

  test('without its buffer the job reads the original from S3', async () => {
    process.env.REMOVEBG_API_KEY = 'k';
    axios.post.mockResolvedValue({ data: await cutout() });
    const original = await photo(1700, 1700);
    mockSend.mockImplementation(async (cmd) => (cmd.get ? { Body: { transformToByteArray: async () => original } } : {}));
    await media.processPose({ sequelize: {}, poseId: 'p5', episodeId: 'ep1', originalKey: 'episodes/ep1/poses/p5/original.jpg', steps: {} });
    expect(mockSend.mock.calls[0][0].get).toMatchObject({ Key: 'episodes/ep1/poses/p5/original.jpg' });
  });
});

describe('the queue', () => {
  test('a failure is recorded as failed with a plain message and the steps done so far; the pose leaves the queue', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const done = new Promise((resolve) => {
      poses.setState.mockImplementation(async (s, id, status) => { if (status === 'failed') resolve(); return {}; });
    });
    expect(media.enqueue({}, { poseId: 'q1', episodeId: 'ep1', buffer: await photo(1700, 1700) })).toBe(true);
    expect(media.enqueue({}, { poseId: 'q1', episodeId: 'ep1' })).toBe(false);
    expect(media.activeIds()).toContain('q1');
    await done;
    const failed = poses.setState.mock.calls.find((c) => c[2] === 'failed');
    expect(failed[3]).toEqual({ error: 'Background removal is not set up on the server (REMOVEBG_API_KEY).', steps: { color: true, upscale: 'not needed' } });
    await new Promise((r) => setImmediate(r));
    expect(media.activeIds()).not.toContain('q1');
  });

  test('plainError: budget, out of credits, otherwise the message', () => {
    expect(media.plainError({ code: 'AI_BUDGET_EXCEEDED' })).toMatch(/image budget is used up/);
    expect(media.plainError({ response: { status: 402 } })).toMatch(/out of credits/);
    expect(media.plainError(new Error('boom'))).toBe('boom');
  });
});
