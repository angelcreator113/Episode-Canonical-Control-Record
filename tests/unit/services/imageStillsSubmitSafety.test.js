/**
 * Scene still images (fal Flux text-to-image and Flux Kontext through
 * sceneGenerationService.startTextToImage; OpenAI gpt-image-1.5 through
 * generateGptImageStill) are paid per request. A request is sent again only
 * when it provably never reached the provider (ENOTFOUND, EAI_AGAIN,
 * ECONNREFUSED). A 429, a 5xx, a timeout, a reset or a reply without an image
 * may already be a paid still: exactly one send, then PROVIDER_OUTCOME_UNKNOWN
 * (Evoni, AI Operations Center review, 2026-11-07, Q7).
 * axios is mocked: no provider is ever called.
 */
jest.mock('../../../src/models', () => ({
  AIUsageLog: { sum: jest.fn(async () => 0), count: jest.fn(async () => 0), create: jest.fn(async (r) => ({ ...r, id: 1 })) },
}));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn((input) => ({ input })),
}));
jest.mock('sharp', () => {
  const chain = () => {
    const c = {};
    for (const m of ['resize', 'jpeg', 'png', 'extract', 'composite', 'grayscale', 'blur', 'normalize']) c[m] = () => c;
    c.toBuffer = async () => Buffer.from('img');
    c.metadata = async () => ({ width: 1920, height: 1080 });
    return c;
  };
  return jest.fn(() => chain());
});
jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('../../../src/services/artifactDetectionService', () => ({ analyzeImageQuality: jest.fn(), buildRefinedPrompt: jest.fn() }));

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';

const axios = require('axios');
const sceneGen = require('../../../src/services/sceneGenerationService');
const outcome = require('../../../src/services/providerSubmitOutcome');

const netErr = (code) => Object.assign(new Error(code), { code });
const httpErr = (status) => Object.assign(new Error(`status ${status}`), { response: { status, data: { detail: 'x' } } });
const FLUX_OK = { data: { images: [{ url: 'https://fal.media/still.jpg' }] } };
const falPosts = () => axios.post.mock.calls.filter((c) => String(c[0]).startsWith('https://fal.run/')).length;
const openaiPosts = () => axios.post.mock.calls.filter((c) => String(c[0]).startsWith('https://api.openai.com/')).length;

beforeEach(() => {
  axios.post.mockReset();
  axios.get.mockReset();
  for (const m of ['log', 'warn', 'error']) jest.spyOn(console, m).mockImplementation(() => {});
  jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
});
afterEach(() => jest.restoreAllMocks());

const AMBIGUOUS = [
  ['a 408 (Request Timeout)', httpErr(408)],
  ['a 429', httpErr(429)],
  ['a 500', httpErr(500)],
  ['a 502', httpErr(502)],
  ['a 503', httpErr(503)],
  ['a timeout (ECONNABORTED)', netErr('ECONNABORTED')],
  ['ETIMEDOUT', netErr('ETIMEDOUT')],
  ['a reset (ECONNRESET)', netErr('ECONNRESET')],
  ['EPIPE', netErr('EPIPE')],
  ['an error with no code', new Error('socket hang up')],
];

describe.each([
  ['Flux text-to-image', () => sceneGen.startTextToImage('a cafe at dusk')],
  ['Flux Kontext (from a base still)', () => sceneGen.startTextToImage('a cafe at dusk', { referenceImage: 'https://bucket.example/base.jpg' })],
])('%s', (_label, run) => {
  test.each(AMBIGUOUS)('%s: exactly one fal request, then PROVIDER_OUTCOME_UNKNOWN', async (_l, err) => {
    axios.post.mockRejectedValueOnce(err).mockResolvedValue(FLUX_OK);
    await expect(run()).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', status: 502, provider: 'fal' });
    expect(falPosts()).toBe(1);
  });

  test('a 2xx without an image: one fal request, PROVIDER_OUTCOME_UNKNOWN (it may be a paid still)', async () => {
    axios.post.mockResolvedValueOnce({ status: 200, data: { images: [] } }).mockResolvedValue(FLUX_OK);
    await expect(run()).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(falPosts()).toBe(1);
  });

  test.each([['ENOTFOUND'], ['EAI_AGAIN'], ['ECONNREFUSED']])('%s (never reached fal) is retried and can succeed', async (code) => {
    axios.post.mockRejectedValueOnce(netErr(code)).mockResolvedValueOnce(FLUX_OK);
    await expect(run()).resolves.toMatchObject({ imageUrl: 'https://fal.media/still.jpg' });
    expect(falPosts()).toBe(2);
  });

  test('never reached three times: the network error itself, after three attempts', async () => {
    axios.post.mockRejectedValue(netErr('ECONNREFUSED'));
    await expect(run()).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    expect(falPosts()).toBe(3);
  });

  test('never reached, then a 429: two requests in all, then PROVIDER_OUTCOME_UNKNOWN', async () => {
    axios.post.mockRejectedValueOnce(netErr('ENOTFOUND')).mockRejectedValueOnce(httpErr(429)).mockResolvedValue(FLUX_OK);
    await expect(run()).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(falPosts()).toBe(2);
  });

  test('a 400 refusal is final: one request, the original error', async () => {
    axios.post.mockRejectedValueOnce(httpErr(400));
    await expect(run()).rejects.toMatchObject({ response: { status: 400 } });
    expect(falPosts()).toBe(1);
  });

  test('success: one request', async () => {
    axios.post.mockResolvedValueOnce(FLUX_OK);
    await expect(run()).resolves.toMatchObject({ imageUrl: 'https://fal.media/still.jpg' });
    expect(falPosts()).toBe(1);
  });
});

describe('callers keep the single send', () => {
  test('generateBaseStill (flux-dev) on a 503: one fal request, PROVIDER_OUTCOME_UNKNOWN', async () => {
    axios.post.mockRejectedValueOnce(httpErr(503)).mockResolvedValue(FLUX_OK);
    await expect(sceneGen.generateBaseStill({ id: 'set-1' }, 'a cafe', 'flux-dev')).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(falPosts()).toBe(1);
  });

  test('generateBestVariation on a timeout: one fal request', async () => {
    axios.post.mockRejectedValueOnce(netErr('ECONNABORTED')).mockResolvedValue(FLUX_OK);
    await expect(sceneGen.generateBestVariation('a cafe', 1, { setId: 'set-1' })).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(falPosts()).toBe(1);
  });
});

describe('OpenAI gpt-image-1.5 stills: no automatic resend (pinned)', () => {
  test.each([['a 429', httpErr(429)], ['a 500', httpErr(500)], ['a timeout', netErr('ECONNABORTED')], ['a reset', netErr('ECONNRESET')]])(
    '%s: exactly one OpenAI request',
    async (_l, err) => {
      axios.post.mockRejectedValueOnce(err);
      await expect(sceneGen.generateGptImageStill('a cafe', { sceneSetId: 'set-1' })).rejects.toBeTruthy();
      expect(openaiPosts()).toBe(1);
    },
  );
});

describe('classifySubmitError', () => {
  test('only pre-send network errors are "not_sent"; 408, 429 and 5xx are "unknown"; other 4xx "failed"', () => {
    expect(outcome.classifySubmitError(netErr('ECONNREFUSED'))).toBe('not_sent');
    expect(outcome.classifySubmitError(netErr('ENOTFOUND'))).toBe('not_sent');
    expect(outcome.classifySubmitError(netErr('ECONNRESET'))).toBe('unknown');
    expect(outcome.classifySubmitError(new Error('no code'))).toBe('unknown');
    expect(outcome.classifySubmitError(httpErr(408))).toBe('unknown');
    expect(outcome.classifySubmitError(httpErr(429))).toBe('unknown');
    expect(outcome.classifySubmitError(httpErr(500))).toBe('unknown');
    expect(outcome.classifySubmitError(httpErr(403))).toBe('failed');
    expect(outcome.classifySubmitError(httpErr(400))).toBe('failed');
  });
});

describe('an uncertain outcome is never followed by a second paid fal request', () => {
  const PATHS = [
    ['text-to-image', () => sceneGen.startTextToImage('a cafe at dusk')],
    ['Kontext', () => sceneGen.startTextToImage('a cafe at dusk', { referenceImage: 'https://bucket.example/base.jpg' })],
  ];
  test.each(PATHS)('%s: never reached, then a 408: two requests in all, then PROVIDER_OUTCOME_UNKNOWN, no third', async (_l, run) => {
    axios.post.mockRejectedValueOnce(netErr('EAI_AGAIN')).mockRejectedValueOnce(httpErr(408)).mockResolvedValue(FLUX_OK);
    await expect(run()).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(falPosts()).toBe(2);
  });
  test.each(PATHS)('%s: every ambiguous outcome, each in its own call, sends exactly once', async (_l, run) => {
    for (const [, err] of AMBIGUOUS) {
      axios.post.mockReset();
      axios.post.mockRejectedValueOnce(err).mockResolvedValue(FLUX_OK);
      await expect(run()).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
      expect(falPosts()).toBe(1);
    }
  });
});
