// Season arc proposals (Evoni, 2026-10-17): the model's answer is kept to
// what the season allows, and the prompt carries what moved on the feed.

const { parseProposal, buildPrompt, signalsHash } = require('../../../src/services/seasonArcProposals');

const SEASON = {
  arc: { id: 'arc-1', title: 'Soft Luxury Ascension', tagline: 'Rise', current_phase: 2 },
  phases: [
    { phase: 1, title: 'Foundation', status: 'completed' },
    { phase: 2, title: 'Ascension', status: 'active', tagline: 'Up', emotional_arc: 'Hungry' },
    { phase: 3, title: 'Legacy', status: 'upcoming' },
  ],
  threads: [{ id: 't-1', title: 'The rival studio', status: 'open' }],
  openSlots: [{ slot_number: 9, phase: 2, story_purpose: null }, { slot_number: 10, phase: 2, story_purpose: 'x' }],
  goals: [{ title: 'Reach 10 reputation', current_value: 4, target_value: 10, target_metric: 'reputation' }],
  debt: [],
};
const SIGNALS = {
  followers: [{ handle: 'slowsift', change: 12000, now: 48000 }],
  states: [{ handle: 'slowsift', from: 'rising', to: 'peaking' }],
  storylines: [{ title: 'The copied look', status: 'paid_off', thread: 'The rival studio' }],
  met: [{ handle: 'slowsift', episode_number: 4 }],
  lala: { coins: 900, reputation: 4, brand_trust: 3, influence: 5, stress: 2 },
};

describe('parseProposal', () => {
  const answer = (changes) => JSON.stringify({ summary: 'Sift is peaking.', changes });

  test('keeps valid changes of each kind, with why', () => {
    const { summary, changes } = parseProposal(`Here you go: ${answer([
      { kind: 'phase_theme', phase: 2, tagline: 'Rivals rising', why: 'slowsift +12000' },
      { kind: 'thread_open', title: 'Sift and Lala', description: 'A friendship tested', why: 'met in E4' },
      { kind: 'thread_close', thread_id: 't-1', why: 'storyline paid off' },
      { kind: 'slot_intention', slot_number: 9, story_purpose: 'Lala faces Sift at the launch', why: 'peaking' },
    ])}`, SEASON);
    expect(summary).toBe('Sift is peaking.');
    expect(changes.map((c) => c.kind)).toEqual(['phase_theme', 'thread_open', 'thread_close', 'slot_intention']);
    expect(changes[0]).toMatchObject({ phase: 2, phase_title: 'Ascension', tagline: 'Rivals rising', emotional_arc: null, why: 'slowsift +12000' });
    expect(changes[2]).toMatchObject({ thread_id: 't-1', thread_title: 'The rival studio' });
  });

  test('drops what the season does not allow', () => {
    const { changes } = parseProposal(answer([
      { kind: 'phase_theme', phase: 1, tagline: 'Redo the past' },          // completed phase
      { kind: 'phase_theme', phase: 7, tagline: 'Nope' },                   // no such phase
      { kind: 'phase_theme', phase: 3 },                                    // nothing to change
      { kind: 'thread_open', title: 'The rival studio' },                   // already open
      { kind: 'thread_close', thread_id: 't-404' },                         // unknown thread
      { kind: 'slot_intention', slot_number: 3, story_purpose: 'Past' },    // not an open slot
      { kind: 'slot_intention', slot_number: 9, story_purpose: '' },        // no purpose
      { kind: 'rewrite_everything' },                                       // unknown kind
      { kind: 'slot_intention', slot_number: 9, story_purpose: 'First' },
      { kind: 'slot_intention', slot_number: 9, story_purpose: 'Twice' },   // same slot again
    ]), SEASON);
    expect(changes).toEqual([{ kind: 'slot_intention', slot_number: 9, story_purpose: 'First', why: '' }]);
  });

  test('at most eight changes; unreadable answers throw', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: 'thread_open', title: `Thread ${i}` }));
    expect(parseProposal(answer(many), SEASON).changes).toHaveLength(8);
    expect(() => parseProposal('no json here', SEASON)).toThrow(/unreadable/);
  });
});

describe('buildPrompt', () => {
  test('carries the season and what moved on the feed, and only the offered slots', () => {
    const prompt = buildPrompt(SEASON, SIGNALS);
    expect(prompt).toContain('Phase 2 (active): Ascension');
    expect(prompt).toContain('[t-1] The rival studio (open)');
    expect(prompt).toContain('E9: phase 2, no purpose yet');
    expect(prompt).toContain('@slowsift +12000 (now 48000)');
    expect(prompt).toContain('@slowsift: rising → peaking');
    expect(prompt).toContain('The copied look (paid_off), follows thread "The rival studio"');
    expect(prompt).toContain('@slowsift in E4');
    expect(prompt).toContain('reputation 4');
  });
});

describe('signalsHash', () => {
  test('the same feed, the same hash; any move, a new one', () => {
    expect(signalsHash(SIGNALS)).toBe(signalsHash(JSON.parse(JSON.stringify(SIGNALS))));
    expect(signalsHash({ ...SIGNALS, lala: { ...SIGNALS.lala, stress: 3 } })).not.toBe(signalsHash(SIGNALS));
  });
});
