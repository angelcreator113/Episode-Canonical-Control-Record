/**
 * #3714 R1: POST /api/v1/scenes/:id/animate.
 *   - off unless SCENE_ANIMATE_ENABLED is exactly "true";
 *   - the real daily budget gate (imageCostService.runImageCall) runs before
 *     Runway, and the submission writes one usage row;
 *   - only an image recorded on the scene can be animated;
 *   - duration 5 or 10, prompt <= 1000 characters, a known camera motion;
 *   - an ambiguous submission or an unfinished task answers 502
 *     PROVIDER_OUTCOME_UNKNOWN (retryable: false) after exactly one send;
 *   - the route carries aiRateLimiter.
 * Runway is never called: axios is mocked.
 */
const mockModels = {
  Scene: { findByPk: jest.fn() },
  SceneAngle: { findByPk: jest.fn() },
  SceneSet: { findByPk: jest.fn() },
  AIUsageLog: { sum: jest.fn(async () => 0), count: jest.fn(async () => 0), create: jest.fn(async () => ({ id: 77 })) },
  sequelize: { getQueryInterface: () => ({ describeTable: async () => ({ id: {}, background_url: {}, scene_set_id: {}, scene_angle_id: {} }) }) },
};
// sceneController (loaded by the route file) reads `models` from the module.
mockModels.models = mockModels;
jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/services/aiCostTracker', () => ({ getFreshDailySpend: async () => 0 }));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn(), DeleteObjectCommand: jest.fn(), GetObjectCommand: jest.fn(),
}));

process.env.RUNWAY_ML_API_KEY = process.env.RUNWAY_ML_API_KEY || 'test-runway-key';
const axios = require('axios');
const controller = require('../../../src/controllers/sceneStudioController');

const SCENE_ID = '6f1c2a3e-1b2c-4d5e-8f90-123456789abc';
const BG = 'https://episode-assets.s3.us-east-1.amazonaws.com/scenes/bg.jpg';
const ANGLE_STILL = 'https://episode-assets.s3.us-east-1.amazonaws.com/scene-sets/s/angles/a/still.jpg';
const SET_BASE = 'https://episode-assets.s3.us-east-1.amazonaws.com/scene-sets/s/stills/base.jpg';

function scene(fields = {}) {
  const v = { id: SCENE_ID, background_url: BG, scene_angle_id: 'angle-1', scene_set_id: 'set-1', ...fields };
  return { ...v, get: (k) => v[k] };
}
function res() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
async function call(body, { env = 'true' } = {}) {
  const saved = process.env.SCENE_ANIMATE_ENABLED;
  if (env === null) delete process.env.SCENE_ANIMATE_ENABLED; else process.env.SCENE_ANIMATE_ENABLED = env;
  try {
    const r = res();
    await controller.animateScene({ params: { id: SCENE_ID }, body, user: { id: 'u1' } }, r);
    return r;
  } finally {
    if (saved === undefined) delete process.env.SCENE_ANIMATE_ENABLED; else process.env.SCENE_ANIMATE_ENABLED = saved;
  }
}
const netErr = (code) => Object.assign(new Error(code), { code });

beforeEach(() => {
  axios.post.mockReset();
  axios.get.mockReset();
  mockModels.Scene.findByPk.mockReset().mockResolvedValue(scene());
  mockModels.SceneAngle.findByPk.mockReset().mockResolvedValue({ id: 'angle-1', still_image_url: ANGLE_STILL });
  mockModels.SceneSet.findByPk.mockReset().mockResolvedValue({ id: 'set-1', base_still_url: SET_BASE });
  mockModels.AIUsageLog.sum.mockReset().mockResolvedValue(0);
  mockModels.AIUsageLog.count.mockReset().mockResolvedValue(0);
  mockModels.AIUsageLog.create.mockReset().mockResolvedValue({ id: 77 });
  for (const m of ['log', 'warn', 'error']) jest.spyOn(console, m).mockImplementation(() => {});
  jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
});
afterEach(() => jest.restoreAllMocks());

describe('the switch', () => {
  test.each([[null], ['false'], ['1'], ['yes']])('SCENE_ANIMATE_ENABLED=%j (null: unset): 503 ANIMATE_DISABLED, nothing read, nothing sent', async (env) => {
    const r = await call({ prompt: 'drift' }, { env });
    expect(r.statusCode).toBe(503);
    expect(r.body.code).toBe('ANIMATE_DISABLED');
    expect(mockModels.Scene.findByPk).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('cost enforcement', () => {
  test('the daily budget gate refuses before Runway: 429, zero Runway requests', async () => {
    mockModels.AIUsageLog.sum.mockResolvedValue(1000); // far past both caps
    const r = await call({ prompt: 'drift' });
    expect(r.statusCode).toBe(429);
    expect(r.body.code).toBe('AI_BUDGET_EXCEEDED');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('a successful submission: one Runway request and one usage row for scenes-animate', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'task-1' } });
    axios.get.mockResolvedValueOnce({ data: { status: 'SUCCEEDED', output: ['https://runway.example/v.mp4'] } });
    const r = await call({ prompt: 'drift', duration: 10 });
    expect(r.statusCode).toBe(200);
    expect(r.body.data).toEqual({ video_url: 'https://runway.example/v.mp4', duration: 10, job_id: 'task-1' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1]).toMatchObject({ model: 'gen3a_turbo', promptImage: BG, duration: 10, cameraMotion: 'static' });
    expect(mockModels.AIUsageLog.create).toHaveBeenCalledTimes(1);
    expect(mockModels.AIUsageLog.create.mock.calls[0][0]).toMatchObject({ route_name: 'scenes-animate', provider: 'runway' });
  });
});

describe('the source image', () => {
  test.each([['the angle still', ANGLE_STILL], ['the scene set base', SET_BASE], ['the background', BG]])('%s recorded on the scene is allowed', async (_l, url) => {
    axios.post.mockResolvedValueOnce({ data: { id: 'task-2' } });
    axios.get.mockResolvedValueOnce({ data: { status: 'SUCCEEDED', output: ['v'] } });
    const r = await call({ prompt: 'drift', image_url: url });
    expect(r.statusCode).toBe(200);
    expect(axios.post.mock.calls[0][1].promptImage).toBe(url);
  });

  test.each([
    ['an external URL', 'https://evil.example/cat.jpg'],
    ['our bucket, but not this scene\'s image', 'https://episode-assets.s3.us-east-1.amazonaws.com/other/image.jpg'],
    ['a metadata address', 'http://169.254.169.254/latest/meta-data/'],
  ])('%s is refused: 400 SOURCE_NOT_ALLOWED, nothing sent', async (_l, url) => {
    const r = await call({ prompt: 'drift', image_url: url });
    expect(r.statusCode).toBe(400);
    expect(r.body.code).toBe('SOURCE_NOT_ALLOWED');
    expect(axios.post).not.toHaveBeenCalled();
    expect(mockModels.AIUsageLog.create).not.toHaveBeenCalled();
  });

  test('a scene with no image: 400 NO_SOURCE_IMAGE', async () => {
    mockModels.Scene.findByPk.mockResolvedValue(scene({ background_url: null, scene_angle_id: null, scene_set_id: null }));
    const r = await call({ prompt: 'drift' });
    expect(r.statusCode).toBe(400);
    expect(r.body.code).toBe('NO_SOURCE_IMAGE');
  });

  test('an unknown scene: 404', async () => {
    mockModels.Scene.findByPk.mockResolvedValue(null);
    expect((await call({ prompt: 'drift' })).statusCode).toBe(404);
  });
});

describe('the request', () => {
  test.each([[7], [0], [-5], [15], ['ten'], [5.5]])('duration %j: 400, nothing sent', async (duration) => {
    const r = await call({ prompt: 'drift', duration });
    expect(r.statusCode).toBe(400);
    expect(r.body.code).toBe('INVALID_ANIMATE_REQUEST');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('duration "10" (a string) and the default 5 are accepted', async () => {
    axios.post.mockResolvedValue({ data: { id: 'task-3' } });
    axios.get.mockResolvedValue({ data: { status: 'SUCCEEDED', output: ['v'] } });
    await call({ prompt: 'drift', duration: '10' });
    await call({ prompt: 'drift' });
    expect(axios.post.mock.calls.map((c) => c[1].duration)).toEqual([10, 5]);
  });

  test('no prompt, a prompt over 1000 characters, or an unknown camera motion: 400, nothing sent', async () => {
    for (const body of [{}, { prompt: '   ' }, { prompt: 'x'.repeat(1001) }, { prompt: 'drift', camera_motion: 'barrel_roll' }]) {
      const r = await call(body);
      expect(r.statusCode).toBe(400);
    }
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('retries and unknown outcomes', () => {
  test.each([['a timeout', netErr('ECONNABORTED')], ['a reset', netErr('ECONNRESET')], ['a 503', Object.assign(new Error('503'), { response: { status: 503, data: {} } })]])(
    '%s after sending: exactly one request, 502 PROVIDER_OUTCOME_UNKNOWN, retryable false',
    async (_l, err) => {
      axios.post.mockRejectedValueOnce(err);
      const r = await call({ prompt: 'drift' });
      expect(r.statusCode).toBe(502);
      expect(r.body).toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', retryable: false });
      expect(r.body.error).toMatch(/not sent again/);
      expect(axios.post).toHaveBeenCalledTimes(1);
    },
  );

  test('accepted but unfinished when we stop checking: 502 PROVIDER_OUTCOME_UNKNOWN with the task id', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'task-4' } });
    axios.get.mockResolvedValue({ data: { status: 'RUNNING' } });
    const r = await call({ prompt: 'drift' });
    expect(r.statusCode).toBe(502);
    expect(r.body).toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', retryable: false, job_id: 'task-4' });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('Runway reports the task failed: 502 ANIMATION_FAILED with the task id (definitive)', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'task-5' } });
    axios.get.mockResolvedValueOnce({ data: { status: 'FAILED', failure: 'bad input' } });
    const r = await call({ prompt: 'drift' });
    expect(r.body).toMatchObject({ code: 'ANIMATION_FAILED', job_id: 'task-5' });
  });

  test('never reached Runway (ECONNREFUSED) is retried and can succeed', async () => {
    axios.post.mockRejectedValueOnce(netErr('ECONNREFUSED')).mockResolvedValueOnce({ data: { id: 'task-6' } });
    axios.get.mockResolvedValueOnce({ data: { status: 'SUCCEEDED', output: ['v'] } });
    const r = await call({ prompt: 'drift' });
    expect(r.statusCode).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('a 4xx refusal: 502 PROVIDER_REJECTED, one request', async () => {
    axios.post.mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: {} } }));
    const r = await call({ prompt: 'drift' });
    expect(r.body.code).toBe('PROVIDER_REJECTED');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe('the route', () => {
  test('POST /:id/animate carries requireAuth and aiRateLimiter', () => {
    const router = require('../../../src/routes/scenes');
    const layer = router.stack.find((l) => l.route && l.route.path === '/:id/animate' && l.route.methods.post);
    const names = layer.route.stack.map((s) => s.name);
    const { aiRateLimiter } = require('../../../src/middleware/aiRateLimiter');
    const { requireAuth } = require('../../../src/middleware/auth');
    const handles = layer.route.stack.map((s) => s.handle);
    expect(handles).toContain(aiRateLimiter);
    expect(handles).toContain(requireAuth);
    expect(handles.indexOf(requireAuth)).toBeLessThan(handles.indexOf(aiRateLimiter));
    expect(names.length).toBeGreaterThanOrEqual(4);
  });
});
