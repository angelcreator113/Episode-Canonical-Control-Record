/**
 * services/threadInbox, its pure parts (Evoni, 2026-10-26: threads open by
 * themselves): the plain check's title match, the plain plan, the AI's plan
 * kept to the slots still to come, the check's answer kept to the show, the
 * beat a quote is in, and the check's prompt.
 */
const { sameTitle, plainPlan, planOf, readCheck, beatOf, checkPrompt, MODELS } = require('../../../src/services/threadInbox');

const slot = (n, phase, done = false) => ({ id: `s${n}`, slot_number: n, phase, done, label: `S1 · E${n}`, story_purpose: n === 5 ? 'Lala meets the buyer' : null });
const season = {
  phases: [{ phase: 1, title: 'Foundation', episode_start: 1, episode_end: 4 }, { phase: 2, title: 'Ascension', episode_start: 5, episode_end: 8 }],
  slots: [slot(1, 1, true), slot(2, 1, true), slot(3, 1), slot(4, 1), slot(5, 2), slot(6, 2), slot(7, 2), slot(8, 2)],
};

describe('threadInbox', () => {
  test('one model, the house one', () => {
    expect(MODELS).toEqual(['claude-sonnet-4-6']);
  });

  test('sameTitle: the same words, or most of them', () => {
    expect(sameTitle('Who sent the invitation?', 'who sent the invitation')).toBe(true);
    expect(sameTitle('Who sent the anonymous invitation?', 'Who sent the invitation? The anonymous one')).toBe(true);
    expect(sameTitle('Does Mo forgive Lala?', 'Who sent the invitation?')).toBe(false);
    expect(sameTitle('', 'anything')).toBe(false);
    // One shared word is not enough.
    expect(sameTitle('The ring', 'The gala')).toBe(false);
  });

  test('plainPlan: the next open slot carries it on; the last open slot of its part pays it off', () => {
    expect(plainPlan(season, 2)).toEqual({ carry_slot_id: 's3', payoff_slot_id: 's4', part: 1, by: 'plain' });
    // The carry slot is the last of its part: the next one pays it off.
    expect(plainPlan(season, 3)).toEqual({ carry_slot_id: 's4', payoff_slot_id: 's5', part: 1, by: 'plain' });
    expect(plainPlan(season, 6)).toEqual({ carry_slot_id: 's7', payoff_slot_id: 's8', part: 2, by: 'plain' });
    expect(plainPlan(season, 8)).toBeNull();
    expect(plainPlan(null, 0)).toBeNull();
  });

  test('planOf: the AI\'s slots only when still to come and in order', () => {
    expect(planOf(season, 2, { carry_slot: 4, payoff_slot: 7 })).toEqual({ carry_slot_id: 's4', payoff_slot_id: 's7', part: 1, by: 'ai' });
    // A payoff before the carry is dropped.
    expect(planOf(season, 2, { carry_slot: 6, payoff_slot: 4 })).toEqual({ carry_slot_id: 's6', payoff_slot_id: null, part: 2, by: 'ai' });
    // A done or past slot: the plain plan.
    expect(planOf(season, 2, { carry_slot: 1, payoff_slot: 4 })).toEqual(plainPlan(season, 2));
    expect(planOf(season, 2, {})).toEqual(plainPlan(season, 2));
  });

  test('readCheck: kept to the open threads and the parts; one item each; unreadable is null', () => {
    const candidates = [{ title: 'a' }, { title: 'b' }, { title: 'c' }, { title: 'd' }];
    const open = [{ id: 't1', title: 'Old' }];
    const raw = `Here: ${JSON.stringify({ items: [
      { n: 1, verdict: 'same', thread_id: 't1' },
      { n: 2, verdict: 'same', thread_id: 'made-up' },
      { n: 3, verdict: 'contradicts', reason: 'It reveals the ring.' },
      { n: 3, verdict: 'new' },
      { n: 4, verdict: 'contradicts' },
      { n: 9, verdict: 'new' },
    ] })}`;
    expect(readCheck(raw, { candidates, open, season })).toEqual([
      { verdict: 'same', thread_id: 't1' },
      // A thread that is not open: new.
      expect.objectContaining({ verdict: 'new' }),
      { verdict: 'left_out', reason: 'It reveals the ring.' },
      // Contradicts with no reason: new.
      expect.objectContaining({ verdict: 'new' }),
    ]);
    expect(readCheck('{"items":[{"n":1,"verdict":"new","part":7,"why":"Why"}]}', { candidates: [{ title: 'a' }], open, season })[0])
      .toMatchObject({ verdict: 'new', part: null, why: 'Why' });
    expect(readCheck('no json', { candidates, open, season })).toBeNull();
    expect(readCheck('{"nope": 1}', { candidates, open, season })).toBeNull();
  });

  test('beatOf: the beat whose words hold the quote', () => {
    const script = '## BEAT: 1 · Opening\nMAREN tucks her hand away.\n\n## BEAT: 11 · The Moment\nLALA: Who sent the invitation?';
    expect(beatOf(script, 'LALA: Who sent the invitation?')).toBe(11);
    expect(beatOf(script, '“Maren tucks her hand away”')).toBe(1);
    expect(beatOf(script, 'short')).toBeNull();
    expect(beatOf(script, 'not in the script at all')).toBeNull();
  });

  test('checkPrompt: the threads, what was left out, the story, the secrets and the slots still to come', () => {
    const prompt = checkPrompt({
      where: 'from the Velour Gala\'s seeds',
      candidates: [{ title: 'Will Maison Belle call?', note: 'a seed' }],
      open: [{ id: 't1', title: 'Old', description: 'Since E1' }],
      past: [{ title: 'Gone one', undone: true }, { title: 'Bad one', reason: 'Reveals the ring' }],
      story: 'What happened: the gala.',
      secrets: [{ name: 'Maren', text: 'She sold the ring', state: 'hidden', may: 'hidden' }],
      season, from: 3,
    });
    expect(prompt).toContain('came from the Velour Gala\'s seeds');
    expect(prompt).toContain('- [t1] Old: Since E1');
    expect(prompt).toContain('- Gone one (the author undid it)');
    expect(prompt).toContain('- Bad one (Reveals the ring)');
    expect(prompt).toContain('What happened: the gala.');
    expect(prompt).toContain('- Maren: She sold the ring (the audience: hidden; an episode may: hidden)');
    expect(prompt).toContain('- Part 2: Ascension, E5–E8');
    expect(prompt).toContain('- E5: part 2, Lala meets the buyer');
    expect(prompt).not.toContain('- E3:');
    expect(prompt).toContain('1. Will Maison Belle call? (a seed)');
  });
});
