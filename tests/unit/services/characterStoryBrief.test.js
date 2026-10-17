// The Character Story Brief (stage A): one account of a character's inner
// life for every writer, split into what they show and the private author
// truth, at the depth each layer allows, with nothing cleared to reveal.

const { storyBrief, LAYERS, BRIEF_COLUMNS } = require('../../../src/services/characterStoryBrief');

const MAREN = {
  mask_persona: 'Effortless, always booked',
  the_mask: { description: 'The calm studio owner' },
  want_architecture: { surface_want: 'To be the stylist everyone books', real_want: 'To be chosen for herself', forbidden_want: 'To stop' },
  wound: { description: 'Her mother’s shop closed and she pretended it was a choice', downstream_effects: 'Hides anything unfinished' },
  core_wound: 'older wound text',
  truth_persona: 'Afraid to be seen before it is perfect',
  extra_fields: { dilemma: { central_tension: 'Image or honesty', option_a: 'Protect the image', option_b: 'Show the work' } },
  triggers: ['Someone photographing an unfinished room', { label: 'Silence after a draft' }],
  experience_of_joy: 'Five minutes before a show',
  change_capacity: { mobility: 'conditionally_open', conditions_for_change: 'someone sees the mess and stays' },
  time_orientation: 'future_obsessed',
  living_state: { current_situation: 'Between leases', active_tension: 'Hiding it' },
  blind_spot: 'She keeps score',
};

describe('storyBrief', () => {
  test('what they show, then the private author truth, then nothing cleared', () => {
    const { lines, text } = storyBrief(MAREN, { layer: 'episode' });
    expect(lines[0]).toMatch(/^WHAT THEY SHOW/);
    expect(text).toContain('- Public self: Effortless, always booked');
    const truth = lines.findIndex((l) => l.startsWith('PRIVATE AUTHOR TRUTH'));
    expect(truth).toBeGreaterThan(0);
    expect(lines[truth]).toContain(LAYERS.episode);
    expect(lines[lines.length - 1]).toBe('CLEARED TO REVEAL: nothing yet. Keep every private truth as subtext.');
  });

  test('reads every part of the inner life from its home', () => {
    const { text } = storyBrief(MAREN);
    expect(text).toContain('- Actually needs: To be chosen for herself');
    expect(text).toContain('- Will not admit wanting: To stop');
    // The wound record wins over the older core_wound.
    expect(text).toContain('- Wound: Her mother’s shop closed');
    expect(text).not.toContain('older wound text');
    expect(text).toContain('- Central dilemma: Image or honesty');
    expect(text).toContain('- Torn between: Protect the image / Show the work');
    expect(text).toContain('- What gets to them: Someone photographing an unfinished room; Silence after a draft');
    expect(text).toContain('- How far they can change: conditionally open; would change if someone sees the mess and stays');
    // An older time name, in the five.
    expect(text).toContain('- How they live in time: future oriented');
    expect(text).toContain('- Right now: Between leases; Hiding it');
  });

  test('the blind spot is never in a brief, nor is its column offered', () => {
    expect(storyBrief(MAREN).text).not.toContain('keeps score');
    expect(BRIEF_COLUMNS).not.toContain('blind_spot');
  });

  test('each layer says how deep it may go', () => {
    for (const layer of Object.keys(LAYERS)) expect(storyBrief(MAREN, { layer }).text).toContain(LAYERS[layer]);
    expect(LAYERS.episode).toMatch(/Never state it/);
    expect(LAYERS.short_story).toMatch(/Hint/);
  });

  test('a character with no inner life gets no brief; long text is clipped', () => {
    expect(storyBrief({})).toEqual({ lines: [], text: '' });
    const long = storyBrief({ truth_persona: 'x'.repeat(500) }).text;
    expect(long).toMatch(/x…$/m);
  });

  test('a model instance is read as plain data', () => {
    const row = { get: () => ({ truth_persona: 'Underneath' }) };
    expect(storyBrief(row).text).toContain('- Who they are underneath: Underneath');
  });
});
