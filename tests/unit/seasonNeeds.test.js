/**
 * Planner PR 3 (2026-10-24), the pure parts: who a purpose names, the
 * season's needs before and after they are looked up, a slot seed's why,
 * and the slot draft's "plan around it" block.
 */
const { nameMatcher, pairsOf, needsFrom, classify } = require('../../src/services/seasonNeeds');
const { slotWhy } = require('../../src/services/relationshipSeeds');
const { aroundBlock } = require('../../src/services/seasonIntentionService');
const { relationshipLine } = require('../../src/services/relationshipTruth');

const people = [
  { id: 'a', name: 'Lala' }, { id: 'b', name: 'Marcus Hale' }, { id: 'c', name: 'Jade Monroe' },
  { id: 'd', name: 'Jade Price' }, { id: 'e', name: 'Mo' },
];

describe('nameMatcher', () => {
  const match = nameMatcher(people);
  test('full names and unique first names, whole words, in the order named', () => {
    expect(match("Marcus's ring and Lala's lie")).toEqual(['b', 'a']);
    expect(match('marcus hale meets LALA')).toEqual(['b', 'a']);
    expect(match('Lalaland and Marcusian')).toEqual([]);
  });
  test('a first name two people share needs the full name; a short one is never enough alone', () => {
    expect(match('Jade and Lala')).toEqual(['a']);
    expect(match('Jade Price and Lala')).toEqual(['d', 'a']);
    expect(match('Mo calls Lala')).toEqual(['e', 'a']);
    expect(match('')).toEqual([]);
  });
});

describe('needsFrom and classify', () => {
  const slot = (n, state = 'needs_event', purposes = []) => ({ id: `s${n}`, slot_number: n, label: `S1 · E${n}`, state, intention: { story_purposes: purposes } });
  const slots = [
    slot(1, 'done', [{ text: 'Lala and Mo fall out' }]),
    slot(3, 'needs_event', [{ text: 'Lala and Marcus at the launch' }]),
    slot(5, 'needs_event', [{ text: 'Quiet one', story_thread: { id: 't1' } }]),
  ];
  const twists = [
    { id: 'w1', title: 'The ring', status: 'planned', character_ids: ['b', 'e'], plant: { id: 's3' }, payoff: { id: 's5' } },
    { id: 'w2', title: 'The list', status: 'planted', character_ids: ['a', 'b', 'e'], plant: { id: 's1' }, payoff: null },
    { id: 'w3', title: 'Done plant', status: 'planned', character_ids: ['a', 'e'], plant: { id: 's1' }, payoff: null },
    { id: 'w4', title: 'Paid', status: 'paid_off', character_ids: ['a', 'e'], plant: { id: 's3' }, payoff: { id: 's5' } },
  ];
  const threads = [{ id: 't1', title: 'Mo and Marcus Hale', status: 'open' }, { id: 't2', title: 'Lala and Mo', status: 'closed' }];
  const needs = needsFrom({ slots, twists, threads, matcher: nameMatcher(people) });

  test('each source gives its pairs and the slot each is needed by', () => {
    const brief = needs.map((n) => `${n.kind}:${n.title}:${[n.a, n.b].join('-')}:${n.slot?.slot_number ?? '-'}`);
    expect(brief).toEqual([
      'twist:The ring:b-e:3',
      'twist:The list:a-b:-', 'twist:The list:a-e:-', 'twist:The list:b-e:-',
      'thread:Mo and Marcus Hale:e-b:5',
      'purpose:Lala and Marcus at the launch:a-b:3',
    ]);
    expect(needs[0].seed_why).toBe('Needed by E3: The ring');
    expect(needs[1].seed_why).toBe('Needed for The list');
  });

  test('there beats a seed; the rest are missing; sorted by slot, missing first', () => {
    const rows = [
      { id: 'r1', character_id_a: 'e', character_id_b: 'b', confirmed: false, relationship_type: 'rival', seed_state: 'later' },
      { id: 'r2', character_id_a: 'b', character_id_b: 'a', confirmed: true, relationship_type: 'friend', stage: 'flirting', tension_state: 'calm', is_romantic: true },
      { id: 'r3', character_id_a: 'a', character_id_b: 'b', confirmed: false, relationship_type: 'rival' },
    ];
    const names = new Map(people.map((p) => [p.id, p.name]));
    const { needs: out, counts } = classify(needs, rows, names);
    expect(counts).toEqual({ there: 2, seed: 3, missing: 1 });
    const ring = out.find((n) => n.title === 'The ring');
    expect(ring).toMatchObject({ state: 'seed', relationship: { id: 'r1', seed_state: 'later' }, a: { name: 'Marcus Hale' }, b: { name: 'Mo' } });
    const launch = out.find((n) => n.kind === 'purpose');
    expect(launch).toMatchObject({ state: 'there', relationship: { id: 'r2', type: 'friend', stage: 'flirting', tension_state: 'calm', is_romantic: true } });
    expect(out.map((n) => n.slot?.slot_number ?? null)).toEqual([3, 3, 5, null, null, null]);
    expect(out.slice(3).map((n) => n.state)).toEqual(['missing', 'seed', 'there']);
  });

  test('pairsOf: every pair once, capped', () => {
    expect(pairsOf(['a', 'b', 'a', 'c'])).toEqual([['a', 'b'], ['a', 'c'], ['b', 'c']]);
    expect(pairsOf(['1', '2', '3', '4', '5'])).toHaveLength(6);
  });
});

describe("a slot seed's why", () => {
  test('always starts "Needed by E12: ", never twice, at most 140 characters', () => {
    expect(slotWhy('Jade watches the fight', { slot_number: 12 })).toBe('Needed by E12: Jade watches the fight');
    expect(slotWhy('Needed by E12 - the betrayal lands', { slot_number: 12 })).toBe('Needed by E12: the betrayal lands');
    expect(slotWhy(null, { slot_number: 3 })).toBe('Needed by E3: the relationship this episode depends on');
    const long = slotWhy('x'.repeat(300), { slot_number: 4 });
    expect(long).toHaveLength(140);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe("the slot draft's plan around it", () => {
  test('event, twists, reveals, later purposes and relationships; nothing when empty', () => {
    expect(aroundBlock({})).toBe('');
    const text = aroundBlock({
      event: { name: 'The Gala', event_type: 'invite', host: 'Maison', dress_code: 'black tie' },
      twists: { plant: [{ title: 'The ring', description: 'Not on her finger', characters: ['Jade'] }], payoff: [{ title: 'The list', planted_in: { episode_number: 2 }, characters: [] }] },
      reveals: [{ intent: 'reveal', character_name: 'Jade', text: 'She pawned it', note: null }],
      later: [{ slot_number: 9, story_purpose: 'The truth' }],
      relationships: "RELATIONSHIPS BETWEEN THE SEASON'S PEOPLE (confirmed):\n- A and B: rival\n",
    });
    expect(text).toContain('The event pencilled into this slot: The Gala (invite), hosted by Maison; dress code: black tie');
    expect(text).toContain('- PLANT: The ring — Not on her finger (with Jade)');
    expect(text).toContain('- PAY OFF: The list (planted in E2)');
    expect(text).toContain("- Reveal Jade's secret: She pawned it");
    expect(text).toContain('- E9: The truth');
    expect(text).toContain('- A and B: rival');
  });

  test('relationshipLine names the type, romance, stage and tension', () => {
    const names = { a: 'Lala', b: 'Marcus' };
    expect(relationshipLine({ character_id_a: 'a', character_id_b: 'b', relationship_type: 'love_interest', is_romantic: true, stage: 'close_friends', tension_state: 'volatile' }, (id) => names[id]))
      .toBe('- Lala and Marcus: love interest, romantic, now close friends, volatile');
    expect(relationshipLine({ character_id_a: 'a', character_id_b: 'x' }, (id) => names[id])).toBe('- Lala and ?: connected');
  });
});
