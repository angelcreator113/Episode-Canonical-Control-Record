/**
 * The quality gate's pure parts (Task #2969): Living State quoted in a post
 * is a leak; who goes to Review (Lala, about Lala, story-revealing, flagged)
 * and who publishes (an everyday post by another character that passed).
 */
const { privateLeaks, reviewReasons, MIN_PRIVATE } = require('../../../src/services/pulseGate');

describe('privateLeaks', () => {
  const state = { mood: 'secretly terrified of being forgotten', notes: ['wants out of the deal', 'ok'], nested: { deep: 'misses her sister every single day' } };

  test('a Living State phrase quoted in the post, any case or spacing, is a leak', () => {
    expect(privateLeaks('honestly I am Secretly  terrified of being forgotten lol', state)).toEqual(['secretly terrified of being forgotten']);
    expect(privateLeaks('misses her sister every single day', state)).toEqual(['misses her sister every single day']);
  });

  test('short phrases and unrelated posts are not leaks', () => {
    expect('ok'.length).toBeLessThan(MIN_PRIVATE);
    expect(privateLeaks('ok so the gala was fine', state)).toEqual([]);
    expect(privateLeaks('anything', null)).toEqual([]);
  });
});

describe('reviewReasons', () => {
  const pass = { pass: true, flags: [] };
  const post = (over) => ({ social_profile_id: 9, poster_handle: 'marcus', content_text: 'new fit who dis', ...over });

  test("an everyday post by another character that passed publishes: no reasons", () => {
    expect(reviewReasons(post(), pass, { lalaProfileId: 1 })).toEqual([]);
  });

  test("Lala's own post, by her profile id or (without one) her handle", () => {
    expect(reviewReasons(post({ social_profile_id: 1 }), pass, { lalaProfileId: 1 })).toEqual(['lala']);
    expect(reviewReasons(post({ poster_handle: '@Lala', social_profile_id: null }), pass, {})).toEqual(['lala']);
  });

  test('about Lala, story-revealing and a failed gate each send it to Review', () => {
    expect(reviewReasons(post({ content_text: 'saw @lala at the gala' }), pass, { lalaProfileId: 1 })).toEqual(['about_lala']);
    expect(reviewReasons(post(), pass, { lalaProfileId: 1, revealsStory: true })).toEqual(['reveals_story']);
    expect(reviewReasons(post(), { pass: false, flags: [{ code: 'voice' }] }, { lalaProfileId: 1 })).toEqual(['gate']);
    expect(reviewReasons(post({ content_text: 'Lala!!' }), { pass: false }, { lalaProfileId: 1, revealsStory: true })).toEqual(['about_lala', 'reveals_story', 'gate']);
  });
});
