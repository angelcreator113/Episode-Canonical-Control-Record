/**
 * #3714 R2: the post-picture switch and how a failed run is classified, and
 * the release timer's startup. The integration side (publishing, the timer,
 * Make now, dismiss) is tests/integration/postPicturesSafety.integration.test.js.
 */
const postPictures = require('../../../src/services/postPictures');

describe('autoEnabled (POST_PICTURES_AUTO_ENABLED)', () => {
  test.each([[{}, false], [{ POST_PICTURES_AUTO_ENABLED: 'false' }, false], [{ POST_PICTURES_AUTO_ENABLED: '1' }, false],
    [{ POST_PICTURES_AUTO_ENABLED: 'yes' }, false], [{ POST_PICTURES_AUTO_ENABLED: 'true' }, true], [{ POST_PICTURES_AUTO_ENABLED: ' TRUE ' }, true]])(
    '%j gives %j', (env, expected) => { expect(postPictures.autoEnabled(env)).toBe(expected); },
  );
});

describe('outcomeOf: definite only when no paid request was sent', () => {
  const e = (props) => Object.assign(new Error('x'), props);
  test.each([
    ['a budget refusal before any request', e({ code: 'AI_BUDGET_EXCEEDED', status: 429 }), 0, 'definite'],
    ['our own check before the request (409, no headshot)', e({ status: 409 }), 0, 'definite'],
    ['a database error before the request', e({ message: 'connection reset' }), 0, 'definite'],
    ['a blank (blocked) picture after the request', e({ status: 422 }), 1, 'uncertain'],
    ['a provider 400 after the request', e({ response: { status: 400 } }), 1, 'uncertain'],
    ['a timeout after the request', e({ code: 'ECONNABORTED' }), 1, 'uncertain'],
    ['ECONNREFUSED from the storage upload after the request', e({ code: 'ECONNREFUSED' }), 1, 'uncertain'],
    ['a storage 413 after the request', e({ status: 413 }), 1, 'uncertain'],
    ['a reply without an image', e({ status: 502 }), 1, 'uncertain'],
    ['a carousel failing on its second picture (the first made)', e({ code: 'AI_BUDGET_EXCEEDED', status: 429 }), 1, 'uncertain'],
  ])('%s', (_label, err, attempts, expected) => {
    expect(postPictures.outcomeOf(err, { attempts })).toBe(expected);
  });

  test('interrupted and uncertain are the states that need a check', () => {
    expect([...postPictures.UNKNOWN_STATES].sort()).toEqual(['interrupted', 'uncertain']);
  });
});

describe('mediaVariations.editImage onAttempt', () => {
  afterEach(() => jest.restoreAllMocks());
  test('fires once, after the budget gate and before the provider request; never when the gate refuses', async () => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    const imageCost = require('../../../src/services/imageCostService');
    const axios = require('axios');
    const order = [];
    jest.spyOn(axios, 'post').mockImplementation(async () => { order.push('request'); return { data: { data: [{ b64_json: 'aGk=' }] } }; });
    jest.spyOn(imageCost, 'runImageCall').mockImplementation(async (_plan, fn) => { order.push('gate'); return fn(); });
    const { editImage } = require('../../../src/services/mediaVariations');
    await editImage('a prompt', [], { onAttempt: () => order.push('attempt') });
    expect(order).toEqual(['gate', 'attempt', 'request']);

    order.length = 0;
    imageCost.runImageCall.mockImplementation(async () => { order.push('gate'); throw Object.assign(new Error('budget'), { code: 'AI_BUDGET_EXCEEDED' }); });
    await expect(editImage('a prompt', [], { onAttempt: () => order.push('attempt') })).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(order).toEqual(['gate']);
  });
});

describe('the release timer', () => {
  afterEach(() => { require('../../../src/services/postRelease').stopScheduler(); jest.restoreAllMocks(); jest.useRealTimers(); });

  test('each tick releases due posts and runs the waiting pictures (which do nothing paid while the switch is off)', async () => {
    jest.useFakeTimers();
    const postRelease = require('../../../src/services/postRelease');
    const due = jest.spyOn(postRelease, 'releaseDue');
    const waiting = jest.spyOn(postPictures, 'runWaiting').mockResolvedValue([]);
    const db = { FeedPost: { findAll: jest.fn(async () => []) }, sequelize: { query: jest.fn(async () => [[]]) } };
    postRelease.startScheduler(db);
    jest.advanceTimersByTime(60 * 1000);
    expect(waiting).toHaveBeenCalledTimes(1);
    // releaseDue is called through the module's own binding, so assert on its effect: it reads the due drafts.
    await Promise.resolve();
    expect(db.FeedPost.findAll.mock.calls.length + due.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
