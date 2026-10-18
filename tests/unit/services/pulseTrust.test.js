/**
 * Trust per character (services/pulseTrust; Evoni, 2026-10-18): review_all
 * holds every post, trusted keeps today's rules, full lets go of a post
 * flagged only for how it reads — never Lala, reveals, deals or canon.
 */
const { applyTrust, levelOf, WAIVABLE_FLAGS, ALWAYS_REVIEW, releasedOnTrust } = require('../../../src/services/pulseTrust');

const flagged = (...codes) => ({ pass: false, flags: codes.map((code) => ({ code })) });

describe('pulseTrust.applyTrust', () => {
  test('trusted (and no level) is today\'s rules', () => {
    expect(applyTrust(['gate'], 'trusted', flagged('voice'))).toEqual({ review: ['gate'], waived: [] });
    expect(applyTrust([], null, { pass: true, flags: [] })).toEqual({ review: [], waived: [] });
    expect(levelOf(undefined)).toBe('trusted');
    expect(levelOf('anything')).toBe('trusted');
  });

  test('review_all holds even a passing post', () => {
    expect(applyTrust([], 'review_all', { pass: true, flags: [] })).toEqual({ review: ['trust_review_all'], waived: [] });
    expect(applyTrust(['gate'], 'review_all', flagged('voice')).review).toEqual(['gate', 'trust_review_all']);
  });

  test('full lets go of a post flagged only for how it reads', () => {
    for (const code of WAIVABLE_FLAGS) {
      expect(applyTrust(['gate'], 'full', flagged(code))).toEqual({ review: [], waived: ['gate'] });
    }
    expect(applyTrust(['gate'], 'full', flagged('voice', 'off_lane', 'banned_phrase'))).toEqual({ review: [], waived: ['gate'] });
  });

  test('full never lets go of canon: secrets, hidden characters or events, the future, what they could not know', () => {
    for (const code of ['private_state', 'unrevealed_character', 'unrevealed_event', 'future_event', 'doesnt_know']) {
      expect(applyTrust(['gate'], 'full', flagged('voice', code))).toEqual({ review: ['gate'], waived: [] });
    }
  });

  test('full never lets go of Lala, a story reveal, a deal announcement or a caller\'s always-review', () => {
    expect(ALWAYS_REVIEW).toEqual(['lala', 'about_lala', 'reveals_story', 'brand_deal']);
    for (const reason of [...ALWAYS_REVIEW, 'on_request', 'event_post']) {
      const out = applyTrust([reason, 'gate'], 'full', flagged('voice'));
      expect(out.review).toEqual([reason]);
      expect(out.review.length).toBeGreaterThan(0);
    }
  });

  test('what goes on gate_json names the level, what was waived and the flags', () => {
    const at = new Date('2026-10-18T10:00:00Z');
    expect(releasedOnTrust('full', ['gate'], flagged('voice'), at)).toEqual({ level: 'full', waived: ['gate'], flags: ['voice'], at: '2026-10-18T10:00:00.000Z' });
  });
});
