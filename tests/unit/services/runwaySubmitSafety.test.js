/**
 * #3714 R1: startImageToVideo (the one Runway image-to-video submission,
 * shared by POST /api/v1/scenes/:id/animate and the worker's
 * generateAngleVideo) is sent again only when the earlier attempt provably
 * never reached Runway. Every ambiguous failure, a 429 included, throws
 * ProviderOutcomeUnknownError after exactly one send.
 */
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn(), DeleteObjectCommand: jest.fn(),
}));

process.env.RUNWAY_ML_API_KEY = process.env.RUNWAY_ML_API_KEY || 'test-runway-key';
const axios = require('axios');
const sceneGen = require('../../../src/services/sceneGenerationService');

const netErr = (code) => Object.assign(new Error(code), { code });
const httpErr = (status) => Object.assign(new Error(`status ${status}`), { response: { status, data: { error: 'x' } } });

beforeEach(() => {
  axios.post.mockReset();
  axios.get.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
});
afterEach(() => jest.restoreAllMocks());

describe('startImageToVideo', () => {
  test('is exported (animate could not reach it before #3714 R1)', () => {
    expect(typeof sceneGen.startImageToVideo).toBe('function');
  });

  test('success: one request, the task id back', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'task-1' } });
    await expect(sceneGen.startImageToVideo('p', 'https://img', { duration: 5 })).resolves.toEqual({ jobId: 'task-1' });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test.each([['ECONNABORTED (axios timeout)'], ['ETIMEDOUT'], ['ECONNRESET'], ['EPIPE'], ['ERR_BAD_RESPONSE'], [undefined]])(
    'a %s with no response: exactly one send, then PROVIDER_OUTCOME_UNKNOWN',
    async (code) => {
      axios.post.mockRejectedValueOnce(netErr(code && code.split(' ')[0]));
      await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', status: 502 });
      expect(axios.post).toHaveBeenCalledTimes(1);
    },
  );

  test.each([[500], [502], [503], [504]])('a %i: exactly one send, then PROVIDER_OUTCOME_UNKNOWN', async (status) => {
    axios.post.mockRejectedValueOnce(httpErr(status));
    await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toBeInstanceOf(sceneGen.ProviderOutcomeUnknownError);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('a 2xx without a task id: one send, PROVIDER_OUTCOME_UNKNOWN', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test.each([['ENOTFOUND'], ['EAI_AGAIN'], ['ECONNREFUSED']])('%s (never reached Runway) is retried, then succeeds', async (code) => {
    axios.post.mockRejectedValueOnce(netErr(code)).mockResolvedValueOnce({ data: { id: 'task-2' } });
    await expect(sceneGen.startImageToVideo('p', 'https://img')).resolves.toEqual({ jobId: 'task-2' });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('never-reached three times: the network error itself (not "unknown"), after three attempts', async () => {
    axios.post.mockRejectedValue(netErr('ECONNREFUSED'));
    await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  test('a 429 is an unknown outcome: exactly one send, PROVIDER_OUTCOME_UNKNOWN, never retried', async () => {
    axios.post.mockRejectedValueOnce(httpErr(429)).mockResolvedValueOnce({ data: { id: 'task-3' } });
    await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', status: 502 });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('a 429 after a never-reached attempt: two sends in all, then PROVIDER_OUTCOME_UNKNOWN', async () => {
    axios.post.mockRejectedValueOnce(netErr('ECONNREFUSED')).mockRejectedValueOnce(httpErr(429)).mockResolvedValueOnce({ data: { id: 'task-x' } });
    await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('a 4xx refusal is final: one send, the original error', async () => {
    axios.post.mockRejectedValueOnce(httpErr(400));
    await expect(sceneGen.startImageToVideo('p', 'https://img')).rejects.toMatchObject({ response: { status: 400 } });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('classifySubmitError', () => {
    expect(sceneGen.classifySubmitError(netErr('ECONNREFUSED'))).toBe('not_sent');
    expect(sceneGen.classifySubmitError(netErr('ECONNRESET'))).toBe('unknown');
    expect(sceneGen.classifySubmitError(httpErr(429))).toBe('unknown');
    expect(sceneGen.classifySubmitError(httpErr(403))).toBe('failed');
    expect(sceneGen.classifySubmitError(httpErr(503))).toBe('unknown');
  });
});

describe('pollTask', () => {
  test('three failed polls are an unknown outcome, not a task failure', async () => {
    axios.get.mockRejectedValue(netErr('ECONNRESET'));
    await expect(sceneGen.pollTask('task-4', 20000)).resolves.toMatchObject({ status: 'UNKNOWN' });
  });
});

describe('the worker path (generateAngleVideo) under the shared change', () => {
  const angle = { id: 'a1', angle_name: 'Wide', angle_label: 'WIDE', still_image_url: 'https://bucket.example/a1.jpg' };
  const models = () => ({ SceneAngle: { update: jest.fn(async () => [1]), increment: jest.fn() }, SceneSet: { increment: jest.fn() } });

  test('a submit timeout: one Runway request, PROVIDER_OUTCOME_UNKNOWN, no clip written', async () => {
    const imageCost = require('../../../src/services/imageCostService');
    jest.spyOn(imageCost, 'runImageCall').mockImplementation(async (_plan, fn) => fn());
    axios.post.mockRejectedValueOnce(netErr('ECONNABORTED'));
    const m = models();
    await expect(sceneGen.generateAngleVideo(angle, { id: 's1' }, m)).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(m.SceneAngle.update).not.toHaveBeenCalled();
  });

  test('a submit 429: one Runway request, PROVIDER_OUTCOME_UNKNOWN, no clip written', async () => {
    const imageCost = require('../../../src/services/imageCostService');
    jest.spyOn(imageCost, 'runImageCall').mockImplementation(async (_plan, fn) => fn());
    axios.post.mockRejectedValueOnce(httpErr(429)).mockResolvedValueOnce({ data: { id: 'task-y' } });
    const m = models();
    await expect(sceneGen.generateAngleVideo(angle, { id: 's1' }, m)).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(m.SceneAngle.update).not.toHaveBeenCalled();
  });

  test('a poll that never finishes: PROVIDER_OUTCOME_UNKNOWN carrying the task id', async () => {
    const imageCost = require('../../../src/services/imageCostService');
    jest.spyOn(imageCost, 'runImageCall').mockImplementation(async (_plan, fn) => fn());
    axios.post.mockResolvedValueOnce({ data: { id: 'task-5' } });
    axios.get.mockRejectedValue(netErr('ECONNRESET'));
    await expect(sceneGen.generateAngleVideo(angle, { id: 's1' }, models())).rejects.toMatchObject({ code: 'PROVIDER_OUTCOME_UNKNOWN', taskId: 'task-5' });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
