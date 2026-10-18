'use strict';

/**
 * The consistency checker (Character Consistency Engine step 3; Evoni,
 * 2026-10-16): flag-only, narrator text against the facts; the mask and
 * author-only notes are never flagged.
 */
jest.mock('../../../src/services/characterFacts', () => ({
  factsOf: jest.fn(),
  primaryPresenceKey: jest.requireActual('../../../src/services/characterFacts').primaryPresenceKey,
}));
const { factsOf } = require('../../../src/services/characterFacts');
const { checkCharacter, followerMentions, withIntentional, zoneOf, statusMentions, applyFix } = require('../../../src/services/characterConsistency');

const FACTS = {
  handle: '@slowsift', followers: { count: 2000000, label: '2M', source: 'ledger' }, account_status: 'gone_dark',
  affordability: { key: 'getting_by', label: 'Getting by', yearly: 40000 }, undecided: [],
};
const maren = (extra = {}) => ({
  display_name: 'Maren Elise Volk',
  description: 'A slow-fashion creator with 1.2M followers who stopped posting.',
  dilemma: { text: 'Her two million followers want the old Maren.' },
  blind_spot: 'She thinks 10M followers would fix it.',
  the_mask: { description: 'Posts like she has 5M followers.' },
  canon_facts: {},
  ...extra,
});
const feed = (extra = {}) => ({
  id: 7, handle: '@slowsift', display_name: 'Maren Elise Volk', follower_count_approx: '2M',
  content_persona: 'Brags about 9M followers.', real_signal: 'She went dark after the retakes.',
  full_profile: { follower_count_approx: '1.2M', content_persona: '3M followers, she says' },
  ...extra,
});

beforeEach(() => factsOf.mockResolvedValue(FACTS));

describe('followerMentions', () => {
  test.each([
    ['with 1.2M followers', 1200000], ['two million followers', 2000000], ['1,200,000 loyal followers', 1200000],
    ['her 47k followers', 47000], ['half a million followers', 500000],
  ])('%s', (text, count) => {
    expect(followerMentions(text).map((m) => m.count)).toEqual([count]);
  });
  test('each mention keeps its leading count, so a fix can swap only the number', () => {
    expect(followerMentions('Quiet deletion. 4K followers abandoned; later four million loyal followers.').map((m) => [m.match, m.number]))
      .toEqual([['4K followers', '4K'], ['four million loyal followers', 'four million']]);
  });
  test('"a follower" and "two followers" are not count claims', () => {
    expect(followerMentions('a follower wrote in; two followers left')).toEqual([]);
  });
});

describe('zones', () => {
  test('what they post is the mask; blind spot is author-only; the rest is narrator', () => {
    expect(zoneOf('content_persona')).toBe('mask');
    expect(zoneOf('lifestyle_claim')).toBe('mask');
    expect(zoneOf('blind_spot')).toBe('author');
    expect(zoneOf('description')).toBe('narrator');
    expect(zoneOf('lifestyle_reality')).toBe('narrator');
  });
});

describe('checkCharacter (Maren)', () => {
  test('flags the narrator 1.2M and the stored 1.2M copy, not her mask or her blind spot', async () => {
    const out = await checkCharacter({}, { character: maren(), feedProfile: feed() });
    const followers = out.flags.filter((f) => f.check === 'followers');
    expect(followers.map((f) => f.field).sort()).toEqual(['character.description', 'feed.full_profile.follower_count_approx']);
    expect(followers[0].expected).toBe('2M followers');
    expect(out.flags.some((f) => /blind_spot|the_mask|content_persona/.test(f.field))).toBe(false);
    expect(out.skipped.mask).toBeGreaterThan(0);
    expect(out.skipped.author).toBeGreaterThan(0);
  });

  test('"went dark" agrees with a gone-dark account; disagrees with a rising one', async () => {
    let out = await checkCharacter({}, { character: maren(), feedProfile: feed() });
    expect(out.flags.filter((f) => f.check === 'account_status')).toEqual([]);
    factsOf.mockResolvedValue({ ...FACTS, account_status: 'rising' });
    out = await checkCharacter({}, { character: maren(), feedProfile: feed() });
    expect(out.flags.find((f) => f.check === 'account_status')).toMatchObject({ field: 'feed.real_signal', found: 'went dark' });
  });

  test('a luxury above what her income affords is flagged; in a post it is the mask', async () => {
    const out = await checkCharacter({}, {
      character: maren({ living_state: { home: 'a penthouse downtown' } }),
      feedProfile: feed({ lifestyle_claim: 'Posts from a yacht every weekend.' }),
    });
    const lux = out.flags.filter((f) => f.check === 'affordability');
    expect(lux).toHaveLength(1);
    expect(lux[0]).toMatchObject({ field: 'character.living_state.home', found: 'penthouse' });
  });

  test('a doubled handle in the text and a mismatched social name are flagged', async () => {
    const out = await checkCharacter({}, {
      character: maren({ prose_overview: 'Known online as @@slowsift.', display_name: 'Maren V' }),
      feedProfile: feed(),
    });
    expect(out.flags.find((f) => f.check === 'handle')).toMatchObject({ found: '@@slowsift.' });
    expect(out.flags.find((f) => f.check === 'social_name')).toMatchObject({ found: 'Maren V' });
  });

  test('an undecided fact is not checked', async () => {
    factsOf.mockResolvedValue({ ...FACTS, undecided: ['followers'] });
    const out = await checkCharacter({}, { character: maren(), feedProfile: feed() });
    expect(out.flags.filter((f) => f.check === 'followers')).toEqual([]);
  });

  test('a flag marked intentional moves to intentional, with its note', async () => {
    const first = await checkCharacter({}, { character: maren(), feedProfile: feed() });
    const target = first.flags.find((f) => f.field === 'character.description');
    const marked = withIntentional({}, target.id, { note: 'She lies about it' });
    const out = await checkCharacter({}, { character: maren({ canon_facts: marked }), feedProfile: feed() });
    expect(out.flags.find((f) => f.id === target.id)).toBeUndefined();
    expect(out.intentional).toEqual([expect.objectContaining({ id: target.id, note: 'She lies about it' })]);
    expect(() => withIntentional({}, 'not-an-id')).toThrow(/flag id/);
  });
});

describe('statusMentions (Evoni, 2026-10-17: false alarms on "goes quiet" and "gone silent")', () => {
  test.each([
    ['When people compliment her influence on another creator, she goes quiet for days.'],
    ['Three sponsors in six weeks have confirmed deals and gone silent within 48 hours.'],
  ])('a mood or someone else going quiet is not the account: %s', (text) => {
    expect(statusMentions(text)).toEqual([]);
  });
  test.each([
    ['She went dark after the retakes.', 'went dark'],
    ['Her feed has gone quiet since March.', 'has gone quiet'],
    ['She went silent on Instagram for a month.', 'went silent'],
  ])('the account going dark or quiet is: %s', (text, found) => {
    expect(statusMentions(text)).toEqual([expect.objectContaining({ status: 'gone_dark', match: found })]);
  });
  test('a cue in another sentence does not count', () => {
    expect(statusMentions('Her feed is busy. She goes quiet when praised.')).toEqual([]);
  });
});

describe('applyFix with a suggested rewrite', () => {
  const record = (fields) => ({ ...fields, update: jest.fn(async function update(patch) { Object.assign(this, patch); }) });

  test('swaps only the flagged sentence, then checks again', async () => {
    factsOf.mockResolvedValue({ ...FACTS, account_status: 'rising' });
    const fp = record(feed({ real_signal: 'Her numbers climb. She went dark after the retakes. Nobody noticed.' }));
    const character = maren();
    const flag = (await checkCharacter({}, { character, feedProfile: fp })).flags.find((f) => f.check === 'account_status');
    const out = await applyFix({}, { character, feedProfile: fp }, flag.id, {
      replace: { before: 'She went dark after the retakes.', after: 'She kept posting through the retakes.' },
    });
    expect(fp.update).toHaveBeenCalledWith({ real_signal: 'Her numbers climb. She kept posting through the retakes. Nobody noticed.' });
    expect(out.flags.find((f) => f.id === flag.id)).toBeUndefined();
  });

  test('a sentence that has changed since is refused', async () => {
    factsOf.mockResolvedValue({ ...FACTS, account_status: 'rising' });
    const fp = record(feed());
    const character = maren();
    const flag = (await checkCharacter({}, { character, feedProfile: fp })).flags.find((f) => f.check === 'account_status');
    await expect(applyFix({}, { character, feedProfile: fp }, flag.id, { replace: { before: 'Not in the text.', after: 'x' } }))
      .rejects.toMatchObject({ status: 409 });
    await expect(applyFix({}, { character, feedProfile: fp }, flag.id, { replace: { before: 'She went dark after the retakes.', after: ' ' } }))
      .rejects.toMatchObject({ status: 400 });
    expect(fp.update).not.toHaveBeenCalled();
  });
});
