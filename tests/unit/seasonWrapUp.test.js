/**
 * The season wrap-up's prompt (services/seasonWrapUp): it reads the plain
 * recap only, with every part said even when empty, and the next season.
 */
const { recapLines, wrapUpPrompt, MODELS, MAX_TOKENS } = require('../../src/services/seasonWrapUp');

const RECAP = {
  season: { season_number: 2, title: 'Glow Up', complete: true },
  next_season_number: 3,
  episode_count: 4,
  finished_count: 4,
  goals: [
    { title: 'Earn brand trust', reached: true, status: 'completed', current_value: 6, target_value: 6, metric_label: 'Brand Trust',
      main_events: [{ name: 'Velvet Gala', label: 'S2 · E1' }], also_helps: [{ name: 'Pop-up', label: 'S2 · E3' }] },
    { title: 'Save coins', reached: false, status: 'failed', current_value: 100, target_value: 3000, metric_label: 'Coins', main_events: [], also_helps: [] },
  ],
  best_episodes: [{ label: 'S2 · E2', title: 'Runway Rush', tier: 'slay', score: 92, narrative_line: 'She owned it.' }],
  money: { income: 2400, spend: 400, net: 2000, top_earners: [{ title: 'Runway Rush', income: 2400 }], top_spenders: [] },
  open_threads: [],
  open_twists: [{ title: 'The torn invitation', status: 'planted', plant_label: 'S2 · E2', payoff_label: null }],
};

describe('season wrap-up prompt', () => {
  test('the recap lines carry the goals, their events, the best episodes, the money and what is open', () => {
    const text = recapLines(RECAP);
    expect(text).toContain('Season 2: Glow Up (complete); 4 of 4 episodes finished.');
    expect(text).toContain('- Earn brand trust (6 of 6 Brand Trust): REACHED. Main event: Velvet Gala (S2 · E1). Also helped: Pop-up (S2 · E3).');
    expect(text).toContain('- Save coins (100 of 3000 Coins): missed. No finished event moved it.');
    expect(text).toContain('- S2 · E2 "Runway Rush": SLAY, score 92 — "She owned it."');
    expect(text).toContain('- In: 2,400 coins; out: 400 coins; net: +2,000 coins.');
    expect(text).toContain('STORY THREADS STILL OPEN GOING INTO SEASON 3:\n- (none)');
    expect(text).toContain('- The torn invitation (planted; plant in S2 · E2)');
  });

  test('the prompt asks for a short plain recap and forbids inventing', () => {
    const prompt = wrapUpPrompt(RECAP);
    expect(prompt).toContain('never invent');
    expect(prompt).toContain('150 to 250 words');
    expect(prompt).toContain('going into Season 3');
    expect(MODELS).toEqual(['claude-sonnet-4-6']);
    expect(MAX_TOKENS).toBe(900);
  });
});
