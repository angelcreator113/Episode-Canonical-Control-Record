// ============================================================================
// The must-cover matcher (Script tab audit 6, 2026-10-24; Evoni: "smarter
// matching + manual override"): a goal by its verb phrase, outside the to-do
// list, in the latest beat that does it, never by a message from the person;
// stems and stop words; the hook in beat 14 only; her manual marks win.
// utils/coverMatch.js is the Script tab's lib/coverMatch.js word for word.
// ============================================================================

const { goalMatch, hookCovered, verbPhrase, keyWords, coverKey, withMark, isListLine } = require('../../../src/utils/coverMatch');
const { scriptCoverage } = require('../../../src/utils/scriptCoverage');
const { goalPerson } = require('../../../src/utils/scriptRuleChecks');
const { stem } = require('../../../src/utils/beat14Invitation');

const EVENT = { canon_consequences: { automation: { guest_profiles: [{ profile_id: 9, display_name: 'Truthville' }] } } };
const PROFILES = [{ id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'mhale_styles' }];
const GUEST = { slot: 'relationship_guest', label: 'Get to know Truthville' };
const person = () => goalPerson(GUEST, EVENT, PROFILES);
const B = (number, ...lines) => ({ number, lines });

describe('stem and stop words', () => {
  test('plurals, -ed and -ing meet; short words keep theirs', () => {
    expect(['followed', 'following', 'follows', 'follow'].map(stem)).toEqual(['follow', 'follow', 'follow', 'follow']);
    expect(['campaigns', 'campaign'].map(stem)).toEqual(['campaign', 'campaign']);
    expect(new Set(['style', 'styled', 'styling', 'styles'].map(stem)).size).toBe(1);
    expect(new Set(['dress', 'dresses', 'dressed'].map(stem)).size).toBe(1);
    expect(['bus', 'gas', 'met', 'VIPs'.toLowerCase()].map(stem)).toEqual(['bus', 'gas', 'met', 'vip']);
  });
  test('function words are never key words', () => {
    expect(keyWords('She must decide whether to go before they leave, and what then')).toEqual(['decid', 'leav']);
  });
});

describe('the verb phrase', () => {
  test("the words before the person's or the brand's name, up to an article, without the preposition", () => {
    expect(verbPhrase('Get to know Truthville', person())).toEqual(['get', 'to', 'know']);
    expect(verbPhrase('Co-style a moment with Velour')).toEqual(['co', 'styl']);
    expect(verbPhrase('Follow up with STUDIO BY SABLE')).toEqual(['follow', 'up']);
    expect(verbPhrase('Get to know the stylist')).toEqual(['get', 'to', 'know']);
    expect(verbPhrase('Send Marcus the lookbook')).toEqual(['send']);
  });
  test('the phrase as a phrase: loose words do not cover the goal', () => {
    expect(goalMatch([B(11, 'Lala: "I want to know you, Marcus Hale."')], GUEST, person())).toBeNull();
    expect(goalMatch([B(11, 'Lala: "Get the drinks. I know Marcus Hale."')], GUEST, person())).toBeNull();
    expect(goalMatch([B(11, 'Lala: "Getting to know you, Marcus Hale!"')], GUEST, person())).toMatchObject({ beat: 11, as: 'Marcus Hale' });
    const brand = { slot: 'relationship_brand', label: 'Co-style a moment with Velour' };
    expect(goalMatch([B(11, 'Lala: "Velour, we co-styled a moment!"')], brand, null)?.beat).toBe(11);
    expect(goalMatch([B(11, 'Lala: "Velour has style, what a moment."')], brand, null)).toBeNull();
  });
  test('the verb in the past tense the stem does not reach (Evoni, 2026-10-27)', () => {
    expect(goalMatch([B(11, 'Lala: "I finally got to know Marcus Hale."')], GUEST, person())).toMatchObject({ beat: 11, as: 'Marcus Hale' });
    expect(goalMatch([B(11, 'Lala: "Got to know you, Truthville!"')], GUEST, person())?.beat).toBe(11);
    expect(goalMatch([B(11, 'Lala: "I got Marcus Hale a drink. I know him now."')], GUEST, person())).toBeNull();
    expect(goalMatch([B(12, 'Lala: "Took a moment with Velour."')], { label: 'Take a moment with Velour' }, null)?.beat).toBe(12);
    // Not "met": "The Met" is a place, so "Meet Velour" still needs "meet".
    expect(goalMatch([B(11, 'Lala: "Velour at The Met tonight."')], { label: 'Meet Velour' }, null)).toBeNull();
  });
});

describe('where a goal is covered', () => {
  test('not on the to-do list: beat 9, or a list line in another beat', () => {
    expect(goalMatch([B(9, 'Lala: "Get to know Truthville."')], GUEST, person())).toBeNull();
    expect(goalMatch([B(13, '- [x] Get to know Truthville'), B(14, 'Lala: "My to-do list says get to know Truthville."')], GUEST, person())).toBeNull();
    expect(isListLine('[UI:CHECK_ITEM Get to know Truthville]')).toBe(true);
    expect(isListLine('Lala: "Lovely to get to know you."')).toBe(false);
  });
  test('the latest beat that does it is named', () => {
    const beats = [B(3, 'Lala: "Tonight I get to know Truthville."'), B(9, '[UI:OPEN Todo]'), B(11, 'Lala: "Marcus Hale! I finally get to know you."'), B(12, 'Me: the challenge')];
    expect(goalMatch(beats, GUEST, person())).toMatchObject({ beat: 11, as: 'Marcus Hale' });
    expect(goalMatch([B(3, 'Lala: "Tonight I get to know Truthville."')], GUEST, person())?.beat).toBe(3);
  });
  test('a DM or notification from the person is not Lala working the room', () => {
    expect(goalMatch([B(11, '[UI:DM Marcus Hale: Get to know me better, Lala?]')], GUEST, person())).toBeNull();
    expect(goalMatch([B(11, '[UI:NOTIFY Truthville: get to know Truthville live]')], GUEST, null)).toBeNull();
    expect(goalMatch([B(11, '[UI:DM Lala: Lovely to get to know you, Marcus Hale]')], GUEST, person())?.beat).toBe(11);
  });
});

describe('the forward hook', () => {
  const hook = 'Whether she says yes to the Velour campaign before the deadline';
  test('only in beat 14, half its key words', () => {
    expect(hookCovered([B(11, 'Lala: the Velour campaign deadline, will she say yes?')], hook)).toBeNull();
    expect(hookCovered([B(14, 'Me: the Velour campaigns... and that deadline')], hook)).toBe(14);
    expect(hookCovered([B(14, 'Me: bye')], hook)).toBeNull();
  });
  test('told through the invitation beat 14 delivers', () => {
    expect(hookCovered([B(14, '[UI:DM Sable Reyes: The Sable campaign shoot is yours.]')], 'A second invitation arrives', 'Sable Campaign Shoot')).toBe(14);
  });
});

describe('manual marks', () => {
  test('stable keys', () => {
    expect(coverKey('goal', { slot: 'relationship_guest', label: 'Get to know  Truthville!' })).toBe('goal:relationship_guest:get-to-know-truthville');
    expect(coverKey('carried', { follow_up_id: 'f1' })).toBe('carried:f1');
    expect(coverKey('hook')).toBe('hook');
    expect(coverKey('opportunity')).toBe('opportunity');
  });
  test('marked covered is covered; marked not covered is a gap; no mark, the words decide', () => {
    const marks = { hook: { covered: true, beat: 14, at: 't', by: 'u1' }, opportunity: { covered: false, at: 't', by: 'u1' } };
    expect(withMark({ markKey: 'hook', beat: null }, marks)).toMatchObject({ covered: true, beat: 14, matched: null, marked: { covered: true, at: 't', by: 'u1' } });
    expect(withMark({ markKey: 'opportunity', beat: 14, line: 'x' }, marks)).toEqual({ markKey: 'opportunity', covered: false, beat: null, matched: 14, marked: { covered: false, at: 't', by: 'u1' } });
    expect(withMark({ markKey: 'goal:x:y', beat: 11 }, marks)).toEqual({ markKey: 'goal:x:y', beat: 11, covered: true });
  });
  test("scriptCoverage: a marked item is not a gap for the writer, and one marked not covered is", () => {
    const script = '## BEAT: 11 · Event Outcome\nLala: "I finally get to know Truthville."\n\n## BEAT: 14 · Cliffhanger\nMe: bye';
    const facts = { goals: [{ ...GUEST, person: person() }], forwardHook: 'A second invitation arrives' };
    expect(scriptCoverage(script, facts).missing.map((g) => g.kind)).toContain('hook');
    const marks = { hook: { covered: true }, 'goal:relationship_guest:get-to-know-truthville': { covered: false } };
    const { items, missing } = scriptCoverage(script, { ...facts, marks });
    expect(items.find((i) => i.kind === 'hook')).toMatchObject({ beat: 14 });
    expect(missing.filter((g) => ['goal', 'hook'].includes(g.kind)).map((g) => g.kind)).toEqual(['goal']);
  });
});
