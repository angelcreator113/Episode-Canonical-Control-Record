/**
 * What Lala knows, and from which line (Evoni, 2026-10-26, My Little List
 * rulings 1 and 3): a game action first, then an earlier episode, then a
 * [LEARNS] line, then the beat as compatibility; accepting implies
 * knowing; line-level within a beat; anything else is not known.
 */
const {
  knowledgeTimeline, knowsAt, learnedAt, learnsCues, actionMoments, opportunityBefore, comparePositions, DEFAULTS,
} = require('../../../src/utils/lalaKnowledge');
const { scriptBeats } = require('../../../src/utils/scriptWear');

const script = (...beats) => beats.map(([n, lines]) => [`## BEAT: ${n} · Beat ${n}`, ...lines].join('\n')).join('\n');
const DEAL = { is_deal: true, terms_locked: true };
const RUNWAY = { id: 'opp-runway', discovered_before: false, accepted_before: false };

describe('positions', () => {
  test('beat, then line; Infinity is the end of the beat', () => {
    expect(comparePositions({ beat: 5, line: 2 }, { beat: 5, line: 3 })).toBe(-1);
    expect(comparePositions({ beat: 6, line: 0 }, { beat: 5, line: Infinity })).toBe(1);
    expect(comparePositions({ beat: 5, line: Infinity }, { beat: 5, line: Infinity })).toBe(0);
  });
});

describe('a game action gives the state', () => {
  const s = script([5, ['Lala: oh', '[UI:DISPLAY Invitation]', 'Lala: wow', '[UI:OPEN Offer letter]']]);

  test('the invitation and the offer letter, at their lines', () => {
    const t = knowledgeTimeline({ script: s, event: DEAL });
    expect(t.facts.get('invitation_received')).toEqual({ at: { beat: 5, line: 1 }, source: 'action' });
    expect(t.facts.get('deal_discovered')).toEqual({ at: { beat: 5, line: 3 }, source: 'action' });
  });

  test('changes within the beat: not known on the line before, known on its line', () => {
    const t = knowledgeTimeline({ script: s, event: DEAL });
    expect(knowsAt(t, 'invitation_received', { beat: 5, line: 0 })).toBe(false);
    expect(knowsAt(t, 'invitation_received', { beat: 5, line: 1 })).toBe(true);
    expect(knowsAt(t, 'deal_discovered', { beat: 5, line: 2 })).toBe(false);
    expect(knowsAt(t, 'deal_discovered', { beat: 5, line: 3 })).toBe(true);
  });

  test('the beat 5 overlay key counts as the invitation', () => {
    expect(actionMoments(scriptBeats(script([5, ['[UI:OPEN OPEN_LETTER_INVITE_OVERLAY]']]))).invitation).toEqual({ beat: 5, line: 0 });
  });

  test('a [LEARNS] line for a state a game action gives changes nothing and is reported', () => {
    const t = knowledgeTimeline({ script: script([4, ['[LEARNS: invitation_received]']], [5, ['[UI:DISPLAY Invitation]']]), event: DEAL });
    expect(t.facts.get('invitation_received')).toMatchObject({ at: { beat: 5, line: 0 }, source: 'action' });
    expect(t.issues).toEqual([expect.objectContaining({ code: 'given_by_game_action', fact: 'invitation_received', beat: 4 })]);
  });
});

describe('[LEARNS] lines', () => {
  test('read at their line, lower-cased, with the opportunity id', () => {
    expect(learnsCues(scriptBeats(script([14, ['Lala: hm', '[LEARNS: Opportunity_Discovered opp-runway]']])))).toEqual([
      { fact: 'opportunity_discovered', ref: 'opp-runway', at: { beat: 14, line: 1 }, raw: '[LEARNS: Opportunity_Discovered opp-runway]' },
    ]);
  });

  test('deal_accepted from its line, within beat 6', () => {
    const t = knowledgeTimeline({ script: script([6, ['Lala: can I afford it?', '[LEARNS: deal_accepted]', 'Lala: yes']]), event: DEAL });
    expect(knowsAt(t, 'deal_accepted', { beat: 6, line: 0 })).toBe(false);
    expect(knowsAt(t, 'deal_accepted', { beat: 6, line: 1 })).toBe(true);
    expect(t.facts.get('deal_accepted').source).toBe('learns');
  });

  test.each([
    ['[LEARNS: deal_signed]', DEAL, [], 'unknown_state'],
    ['[LEARNS: opportunity_discovered]', DEAL, [RUNWAY], 'unknown_opportunity'],
    ['[LEARNS: opportunity_accepted opp-nope]', DEAL, [RUNWAY], 'unknown_opportunity'],
    ['[LEARNS: deal_accepted opp-runway]', DEAL, [RUNWAY], 'unexpected_reference'],
    ['[LEARNS: deal_accepted]', { is_deal: false }, [], 'not_a_deal'],
    ['[LEARNS: invitation_received]', null, [], 'no_event'],
  ])('%s does nothing and is reported %s', (line, event, opportunities, code) => {
    const t = knowledgeTimeline({ script: script([6, [line]]), event, opportunities });
    expect(t.issues.map((i) => i.code)).toEqual([code]);
    expect([...t.facts.values()].some((f) => f.source === 'learns')).toBe(false);
  });

  test('a second line for the same state is reported; the first stands', () => {
    const t = knowledgeTimeline({ script: script([6, ['[LEARNS: deal_accepted]']], [7, ['[LEARNS: deal_accepted]']]), event: DEAL });
    expect(t.facts.get('deal_accepted').at).toEqual({ beat: 6, line: 0 });
    expect(t.issues.map((i) => i.code)).toEqual(['repeated']);
  });
});

describe('the beats, for a script that says neither', () => {
  test('invitation at the start of beat 5, the offer at its end, yes at beat 7 when the terms are locked here', () => {
    const t = knowledgeTimeline({ script: script([1, ['Lala: hi']]), event: DEAL });
    expect(learnedAt(t, 'invitation_received')).toEqual(DEFAULTS.invitation_received);
    expect(knowsAt(t, 'deal_discovered', { beat: 5, line: 40 })).toBe(false);
    expect(knowsAt(t, 'deal_discovered', { beat: 6, line: 0 })).toBe(true);
    expect(learnedAt(t, 'deal_accepted')).toEqual({ beat: 7, line: 0 });
    expect(t.facts.get('deal_accepted').source).toBe('beat');
  });

  test('terms not locked to this episode: no yes', () => {
    expect(knowledgeTimeline({ event: { is_deal: true, terms_locked: false } }).facts.has('deal_accepted')).toBe(false);
  });

  test('not a deal: no deal states; no event: nothing at all', () => {
    expect([...knowledgeTimeline({ event: { is_deal: false } }).facts.keys()]).toEqual(['invitation_received']);
    expect(knowledgeTimeline({ event: null }).facts.size).toBe(0);
  });

  test('opportunities have no beat: hidden unless a line or an earlier episode reveals them', () => {
    const t = knowledgeTimeline({ script: script([14, ['Lala: what?']]), event: DEAL, opportunities: [RUNWAY] });
    expect(knowsAt(t, 'opportunity_discovered', { beat: 14, line: 99 }, 'opp-runway')).toBe(false);
  });
});

describe('accepting implies knowing, and earlier episodes', () => {
  test('an accepted opportunity is a discovered one, from the same line', () => {
    const t = knowledgeTimeline({ script: script([12, ['[LEARNS: opportunity_accepted opp-runway]']]), event: DEAL, opportunities: [RUNWAY] });
    expect(learnedAt(t, 'opportunity_discovered', 'opp-runway')).toEqual({ beat: 12, line: 0 });
  });

  test('yes to the deal on a line before the offer: she knows of it from that line', () => {
    const t = knowledgeTimeline({ script: script([4, ['[LEARNS: deal_accepted]']], [5, ['[UI:DISPLAY Offer letter]']]), event: DEAL });
    expect(learnedAt(t, 'deal_discovered')).toEqual({ beat: 4, line: 0 });
  });

  test('offered in an earlier episode: known from the start; booked: accepted from the start', () => {
    expect(opportunityBefore({ status: 'booked', offered_episode_number: 1 }, 2)).toEqual({ discovered_before: true, accepted_before: true });
    expect(opportunityBefore({ status: 'considering', offered_episode_number: 1 }, 2)).toEqual({ discovered_before: true, accepted_before: false });
    expect(opportunityBefore({ status: 'booked', offered_episode_number: 2 }, 2)).toEqual({ discovered_before: false, accepted_before: false });
    expect(opportunityBefore({ status: 'booked', offered_episode_number: null }, 2)).toEqual({ discovered_before: false, accepted_before: false });
    const t = knowledgeTimeline({ opportunities: [{ id: 'o1', discovered_before: true, accepted_before: true }] });
    expect(knowsAt(t, 'opportunity_accepted', { beat: 1, line: 0 }, 'o1')).toBe(true);
    expect(t.facts.get('opportunity_accepted:o1').source).toBe('earlier_episode');
  });

  test('"start" is always known', () => {
    expect(knowsAt(knowledgeTimeline({}), 'start', { beat: 1, line: 0 })).toBe(true);
  });
});
