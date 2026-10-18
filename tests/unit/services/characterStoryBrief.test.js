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

// Stage B: the revelation budget. Each kept secret with who knows it and what
// this layer may do with it; the ones a layer may reveal are cleared.
describe('storyBrief with secrets', () => {
  const RING = {
    text: 'She sold her mother’s ring to pay for the launch', status: 'confirmed', state: 'hinted', where: 'episode 3',
    permissions: { episode: 'hint', short_story: 'hint', chapter: 'reveal' }, known_by_people: [{ id: 'a', name: 'Mo' }],
  };
  const DEBT = { text: 'She owes the studio three months', status: 'confirmed', state: 'hidden', permissions: { episode: 'hidden' }, known_by_people: [] };
  const SEEN = { text: 'She was fired once', status: 'confirmed', state: 'revealed', where: 'the finale', permissions: {}, known_by_people: [] };

  test('each secret with its rule for the layer and who knows it', () => {
    const { text } = storyBrief(MAREN, { layer: 'episode', secrets: [RING, DEBT] });
    expect(text).toMatch(/^SECRETS \(only the people who know one/m);
    expect(text).toContain('- She sold her mother’s ring to pay for the launch [HINT ONLY: show it in what they do; nobody explains it. Known to: Mo. Already hinted (episode 3).]');
    expect(text).toContain('- She owes the studio three months [KEEP HIDDEN: nothing on the page points at it. No one else knows.]');
    expect(text).toContain('CLEARED TO REVEAL: nothing yet. Keep every private truth as subtext.');
  });

  test('a layer that may reveal one clears it; a scene uses the chapter’s', () => {
    for (const layer of ['chapter', 'scene']) {
      const { lines } = storyBrief(MAREN, { layer, secrets: [RING] });
      expect(lines.join('\n')).toContain('MAY BE REVEALED in this story');
      const at = lines.findIndex((l) => l.startsWith('CLEARED TO REVEAL in this story'));
      expect(at).toBeGreaterThan(0);
      expect(lines[at + 1]).toBe('- She sold her mother’s ring to pay for the launch');
    }
    expect(storyBrief(MAREN, { layer: 'short_story', secrets: [RING] }).text).not.toContain('CLEARED TO REVEAL in this story');
  });

  test('revealed ones are what the audience knows; candidates and retired ones are left out', () => {
    const { text } = storyBrief(MAREN, { secrets: [SEEN, { ...DEBT, status: 'candidate' }, { ...RING, status: 'retired' }] });
    expect(text).toContain('ALREADY REVEALED (the audience knows these; characters who were not told still do not):\n- She was fired once (revealed the finale). No one else knows.');
    expect(text).not.toContain('three months');
    expect(text).not.toContain('ring');
  });

  test('a permission not set is hint only', () => {
    expect(storyBrief(MAREN, { layer: 'chapter', secrets: [{ ...DEBT, permissions: {} }] }).text).toContain('[HINT ONLY');
  });
});

// Stage E: the season's reveal plan sets a secret's permission for this
// episode and marks it planned (services/seasonRevealPlan.withPlan).
describe('storyBrief with the season plan', () => {
  const { withPlan } = require('../../../src/services/seasonRevealPlan');
  const RING = { id: 's1', text: 'She sold the ring', status: 'confirmed', state: 'hidden', permissions: { episode: 'hidden', short_story: 'hint' }, known_by_people: [] };

  test('a planned hint overrides keep hidden, with how', () => {
    const secrets = withPlan([RING], new Map([['s1', { intent: 'hint', note: 'She hides her hand' }]]), 'episode');
    expect(storyBrief(MAREN, { layer: 'episode', secrets }).text)
      .toContain('- She sold the ring [HINT ONLY: show it in what they do; nobody explains it. No one else knows. Planned for this episode: She hides her hand.]');
  });

  test('a planned reveal clears it for that layer only; no plan changes nothing', () => {
    const plan = new Map([['s1', { intent: 'reveal', note: null }]]);
    expect(storyBrief(MAREN, { layer: 'short_story', secrets: withPlan([RING], plan, 'short_story') }).text).toContain('CLEARED TO REVEAL in this story');
    expect(storyBrief(MAREN, { layer: 'episode', secrets: withPlan([RING], plan, 'short_story') }).text).toContain('[KEEP HIDDEN');
    expect(withPlan([RING], new Map(), 'episode')).toEqual([RING]);
  });
});
