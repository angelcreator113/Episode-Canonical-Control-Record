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

describe('outcomeOf: definite vs possibly submitted', () => {
  const e = (props) => Object.assign(new Error('x'), props);
  test.each([
    ['a budget refusal', e({ code: 'AI_BUDGET_EXCEEDED', status: 429 }), 'definite'],
    ['our own check (409, no headshot)', e({ status: 409 }), 'definite'],
    ['a blocked (blank) picture', e({ status: 422 }), 'definite'],
    ['a provider 400', e({ response: { status: 400 } }), 'definite'],
    ['never reached the service (ECONNREFUSED)', e({ code: 'ECONNREFUSED' }), 'definite'],
    ['never reached the service (ENOTFOUND, in cause)', e({ cause: { code: 'ENOTFOUND' } }), 'definite'],
    ['a timeout', e({ code: 'ECONNABORTED' }), 'uncertain'],
    ['a reset', e({ code: 'ECONNRESET' }), 'uncertain'],
    ['a 502 from the image tool (cameraRoll wraps every failure so)', e({ status: 502 }), 'uncertain'],
    ['a provider 500', e({ response: { status: 500 } }), 'uncertain'],
    ['a 408', e({ status: 408 }), 'uncertain'],
    ['storing the picture failed after the call', e({ message: 'S3 put failed' }), 'uncertain'],
    ['nothing', null, 'uncertain'],
  ])('%s', (_label, err, expected) => {
    expect(postPictures.outcomeOf(err)).toBe(expected);
  });

  test('interrupted and uncertain are the states that need a check', () => {
    expect([...postPictures.UNKNOWN_STATES].sort()).toEqual(['interrupted', 'uncertain']);
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
