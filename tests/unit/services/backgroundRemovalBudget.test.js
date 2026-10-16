/**
 * Fourth audit (2026-10-15): background removal (remove.bg, and Runway's
 * remove-background) in wardrobe, assets and the phone overlays was paid
 * with no budget check and no log. Every call now goes through
 * imageCostService.runImageCall: a refused budget makes no provider call,
 * and the refusal reaches the caller as itself (code AI_BUDGET_EXCEEDED),
 * not wrapped as a provider failure or answered by a paid fallback.
 */
const mockRun = jest.fn();
jest.mock('../../../src/services/imageCostService', () => ({
  ...jest.requireActual('../../../src/services/imageCostService'),
  runImageCall: (...a) => mockRun(...a),
}));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

const axios = require('axios');

const refused = () => Object.assign(new Error('Daily image budget reached'), { code: 'AI_BUDGET_EXCEEDED' });

describe('background removal is budget-checked', () => {
  const saved = {};
  beforeAll(() => {
    for (const k of ['REMOVEBG_API_KEY', 'RUNWAY_API_KEY']) saved[k] = process.env[k];
    process.env.REMOVEBG_API_KEY = 'test-removebg';
    process.env.RUNWAY_API_KEY = 'test-runway';
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
  beforeEach(() => {
    mockRun.mockReset();
    axios.post.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a phone overlay\'s remove-background: refused, no remove.bg call, the refusal itself', async () => {
    mockRun.mockRejectedValueOnce(refused());
    const { removeBackgroundFromAsset } = require('../../../src/services/uiOverlayService');
    const models = { sequelize: { query: jest.fn(async () => [[{ id: 'a1', s3_url_raw: 'https://x/a.png', metadata: {} }]]) } };
    await expect(removeBackgroundFromAsset('a1', models, { showId: 's1' })).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(mockRun.mock.calls[0][0]).toEqual({ model: 'remove.bg', provider: 'removebg' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('the asset services pass the refusal through, unwrapped', async () => {
    const processing = require('../../../src/services/AssetProcessingService');
    mockRun.mockRejectedValueOnce(refused());
    await expect(processing.removeBgRemoveBackground('https://x/a.png')).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    mockRun.mockRejectedValueOnce(refused());
    await expect(processing.runwayRemoveBackground('https://x/a.png')).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(mockRun.mock.calls.map((c) => c[0].provider)).toEqual(['removebg', 'runway']);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('Runway\'s remove-background passes the refusal through, unwrapped', async () => {
    const runway = require('../../../src/services/RunwayMLService');
    jest.spyOn(runway, 'isConfigured').mockReturnValue(true);
    mockRun.mockRejectedValueOnce(refused());
    await expect(runway.removeBackground(Buffer.from('img'))).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(mockRun.mock.calls[0][0]).toEqual({ model: 'remove-background', provider: 'runway' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('allowed: the provider is called through the gate', async () => {
    mockRun.mockImplementation(async (plan, fn) => fn());
    axios.post.mockResolvedValueOnce({ data: { output_url: 'https://runway.example/out.png' } });
    const processing = require('../../../src/services/AssetProcessingService');
    await expect(processing.runwayRemoveBackground('https://x/a.png')).resolves.toBe('https://runway.example/out.png');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

// Every background-removal request in src/ is made inside runImageCall: a
// new call site added without the gate fails here.
describe('every background-removal call site is gated', () => {
  const fs = require('fs');
  const path = require('path');
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
    }
  };
  walk(path.join(__dirname, '../../../src'));
  const URL = /api\.remove\.bg\/v1\.0\/removebg|api\.runwayml\.com\/v1\/remove-background|\/remove-background`/;

  test('each one sits in a runImageCall', () => {
    const ungated = [];
    let found = 0;
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!URL.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
        found += 1;
        if (!lines.slice(Math.max(0, i - 1), i + 1).some((l) => l.includes('runImageCall('))) {
          ungated.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
        }
      });
    }
    expect(found).toBeGreaterThanOrEqual(11);
    expect(ungated).toEqual([]);
  });
});
