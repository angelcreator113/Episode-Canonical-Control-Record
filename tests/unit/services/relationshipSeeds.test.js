/**
 * Relationship seeds, without a database: what the generator is told
 * (services/seedContext contextBlock, basisCatalog; each part empty when
 * its table is not there yet) and what is kept of its answer
 * (services/relationshipSeeds: the prompt, the type list, the skip rule,
 * invented basis ids dropped).
 */
const {
  loadSeedContext, contextBlock, basisCatalog, CAP,
} = require('../../../src/services/seedContext');
const {
  skipWhy, aimOf, seedPrompt, basisOf, whyOf, cleanSeeds, APP_TYPES, SeedError,
} = require('../../../src/services/relationshipSeeds');
const {
  normalizeType, familyRoleOf, canonicalType, isKnownType,
} = require('../../../src/services/relationshipTypes');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const EP = '44444444-4444-4444-8444-444444444444';
const TH = '55555555-5555-4555-8555-555555555555';
const TW = '66666666-6666-4666-8666-666666666666';

const characters = [
  { id: A, display_name: 'Lala', role_type: 'protagonist', core_belief: 'Style is a language' },
  { id: B, display_name: 'Truthville', selected_name: 'Marcus Hale', role_type: 'pressure', feed_profile_id: 7 },
  { id: C, display_name: 'Jade', role_type: 'support', feed_profile_id: 8 },
];
const names = new Map([[A, 'Lala'], [B, 'Marcus Hale'], [C, 'Jade']]);
const ctx = (over = {}) => ({
  names,
  records: [{
    episode: { id: EP, number: 3, title: 'The Gala' }, what: 'Lala wins the gala; Marcus watches from the rail.',
    relationships: ['Lala and Marcus Hale (love interest, romantic, acquaintances → flirting): a look across the room'],
    threads: ['Who leaked the guest list'],
  }],
  threads: [{ id: TH, title: 'Who leaked the guest list', description: '', status: 'open' }],
  twists: [{ id: TW, title: 'Jade was the leak', description: 'She sold it to the blog', status: 'planted', character_ids: [C] }],
  secrecy: ['Lala and Marcus Hale\'s romance is SECRET: only Jade knows. Nobody else mentions it.'],
  families: [],
  confirmed: [{ character_id_a: A, character_id_b: B, relationship_type: 'love_interest', is_romantic: true, stage: 'flirting' }],
  pulse: ['Marcus Hale and Jade: shade'],
  dismissals: [{ character_id_a: B, character_id_b: C, relationship_type: 'friend', dismiss_reason: 'wrong_for_them', dismiss_note: 'he would never' }],
  episode: null, guests: [], twist: null,
  ...over,
});
const emptyIndex = () => ({ live: new Set(), blocked: new Map(), heldTypes: new Set() });
const aim = (over = {}) => ({ kind: 'any', focus_character_id: null, episode_id: null, twist_id: null, count: 5, ...over });

describe('seedContext', () => {
  it('writes each part as a section, the ids in brackets, and the dismissals with her reasons', () => {
    const block = contextBlock(ctx());
    expect(block).toContain(`[episode ${EP}] Episode 3 "The Gala": Lala wins the gala`);
    expect(block).toContain('What moved between people: Lala and Marcus Hale');
    expect(block).toContain(`[thread ${TH}] Who leaked the guest list`);
    expect(block).toContain(`[twist ${TW}] Jade was the leak: She sold it to the blog (planted, not paid off yet); involves Jade`);
    expect(block).toContain('- Lala and Marcus Hale: love interest, romantic, now flirting');
    expect(block).toContain('SECRET: only Jade knows');
    expect(block).toContain('Marcus Hale and Jade: shade');
    expect(block).toContain('- Marcus Hale and Jade as friend: wrong for them ("he would never")');
    expect(block).toMatch(/FAMILY[^\n]*\n\(none\)/);
  });

  it('keeps each part to its cap', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ character_id_a: A, character_id_b: B, relationship_type: `type ${i}`, is_romantic: false }));
    const block = contextBlock(ctx({ confirmed: many }));
    const lines = block.split('\n').filter((l) => l.startsWith('- Lala and Marcus Hale: type'));
    expect(lines.length).toBeLessThanOrEqual(CAP.confirmed.rows);
    // The whole block stays near the prompt budget even when every part is full.
    expect(block.length).toBeLessThan(24000);
  });

  it('lists the episodes, threads and twists a seed may cite, the aimed ones too', () => {
    const cat = basisCatalog(ctx({ episode: { id: C, number: 9, title: 'Finale' }, twist: { id: A, title: 'Aimed twist' } }));
    expect([...cat.episodes.keys()]).toEqual([EP, C]);
    expect(cat.episodes.get(EP)).toEqual({ id: EP, number: 3, title: 'The Gala' });
    expect([...cat.threads.keys()]).toEqual([TH]);
    expect([...cat.twists.keys()]).toEqual([TW, A]);
  });

  it('answers empty parts when every read fails (tables not made yet), and never throws', async () => {
    const failing = { query: jest.fn().mockRejectedValue(new Error('relation "season_twists" does not exist')) };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await loadSeedContext(failing, { cast: characters, episodeId: EP, twistId: TW });
    spy.mockRestore();
    expect(out).toMatchObject({
      records: [], threads: [], twists: [], secrecy: [], families: [], confirmed: [], pulse: [], dismissals: [],
      episode: null, guests: [], twist: null, show_id: null,
    });
    expect(contextBlock(out)).toContain('(none)');
  });
});

describe('the type list', () => {
  it.each([
    ['rival', 'rival', false], ['Best Friend', 'best friend', false], ['love_interest', 'love_interest', true],
    ['wife', 'wife', true], ['sister', 'sister', false], ['cousin', 'cousin', false],
    ['emotional affair', 'love_interest', true], ['business partner', 'collaborator', false],
    ['nemesis', 'rival', false], ['bestie', 'best friend', false], ['feud', 'rival', false],
    ['couple', 'love_interest', true], ['mentee', 'mentor', false], ['ex-partner', 'love_interest', true],
    ['Fidelity test', 'love_interest', true], ['The one who stayed', 'love_interest', true], ['Subject turned critic', 'rival', false],
    ['Rival', 'rival', false], ['best_friend', 'best friend', false],
    // Words seen on Evoni's live page (2026-10-24) and their like.
    ['transactional_symbiosis', 'collaborator', false], ['estranged_kin', 'family', false],
    ['old flame', 'love_interest', true], ['protégé', 'mentor', false], ['reluctant_ally', 'friend', false],
    ['shared bloodline', 'family', false], ['brand patron', 'collaborator', false], ['sworn enemy', 'rival', false],
  ])('%s reads as %s', (raw, type, romantic) => {
    expect(normalizeType(raw)).toMatchObject({ type, is_romantic: romantic });
  });

  it('keeps the words that said more as flavour, and drops what it cannot place', () => {
    expect(normalizeType('emotional affair').flavour).toBe('Emotional affair');
    expect(normalizeType('Subject turned critic').flavour).toBe('Subject turned critic');
    expect(normalizeType('Rival').flavour).toBeNull();
    expect(normalizeType('keeper of keys')).toBeNull();
    // Short stems match whole words only.
    expect(normalizeType('making waves')).toBeNull();
    expect(normalizeType('next door')).toBeNull();
    expect(normalizeType('keeper of keys', { keepUnknown: true })).toMatchObject({ type: 'keeper of keys' });
    expect(normalizeType('', { romantic: true })).toMatchObject({ type: 'love_interest', is_romantic: true });
  });

  it('knows a family role from a partner', () => {
    expect(familyRoleOf('Sister')).toBe('sister');
    expect(familyRoleOf('step-mother')).toBe('step-mother');
    expect(familyRoleOf('wife')).toBeNull();
    expect(familyRoleOf('rival')).toBeNull();
    expect(APP_TYPES).toContain('love_interest');
  });

  it('knows the list spelling, and what is already a type the app writes', () => {
    expect(canonicalType('Best_Friend')).toBe('best friend');
    expect(canonicalType('critic')).toBeNull();
    expect(isKnownType('rival')).toBe(true);
    expect(isKnownType('Rival')).toBe(false);
    expect(isKnownType('cousin')).toBe(true);
    expect(isKnownType('family')).toBe(true);
    expect(isKnownType('Fidelity test')).toBe(false);
  });
});

describe('the skip rule', () => {
  const index = {
    live: new Set([[A, B].sort().join('|')]),
    blocked: new Map([[[B, C].sort().join('|'), 'already_covered']]),
    heldTypes: new Set([`${[A, C].sort().join('|')}|rival`]),
  };
  it('skips a live pair, a pair dismissed for good, and a type dismissed before', () => {
    expect(skipWhy(index, B, A, 'friend')).toMatchObject({ code: 'already_there' });
    expect(skipWhy(index, C, B, 'mentor')).toMatchObject({ code: 'dismissed_already_covered' });
    expect(skipWhy(index, C, A, 'rival')).toMatchObject({ code: 'dismissed_same_type' });
    expect(skipWhy(index, C, A, 'mentor')).toBeNull();
  });
});

describe('the aim', () => {
  it('checks kind, focus and ids, and keeps count to 3..8', () => {
    expect(aimOf({}, [A])).toEqual({ kind: 'any', focus_character_id: null, episode_id: null, twist_id: null, slot_id: null, phase: null, show_id: null, count: 5 });
    // A season slot, or a part of the active season with its show (planner PR 3).
    expect(aimOf({ slot_id: EP }, [A])).toMatchObject({ slot_id: EP, phase: null });
    expect(aimOf({ phase: '2', show_id: TH }, [A])).toMatchObject({ phase: 2, show_id: TH });
    expect(() => aimOf({ phase: 2 }, [A])).toThrow(/needs its show_id/);
    expect(() => aimOf({ phase: 12, show_id: TH }, [A])).toThrow(/part number/);
    expect(() => aimOf({ slot_id: 'nope' }, [A])).toThrow(/not a valid id/);
    expect(aimOf({ kind: 'romance', focus_character_id: A, count: 20 }, [A]).count).toBe(8);
    expect(aimOf({ count: 1 }, [A]).count).toBe(3);
    expect(() => aimOf({ kind: 'enemies' }, [A])).toThrow(SeedError);
    expect(() => aimOf({ focus_character_id: B }, [A])).toThrow(/not in the cast/);
    expect(() => aimOf({ episode_id: 'nope' }, [A])).toThrow(/not a valid id/);
  });
});

describe('the prompt', () => {
  it('names the cast, the grounding, the rules, the aim and the type list', () => {
    const p = seedPrompt({
      characters, lalaId: A,
      ctx: ctx({ episode: { id: EP, number: 3, title: 'The Gala', event: 'Gala night' }, guests: [C], twist: { id: TW, title: 'Jade was the leak', description: '', character_ids: [C] } }),
      aim: aim({ kind: 'rivals', focus_character_id: C, count: 4 }),
    });
    expect(p).toContain(`[${B}] Marcus Hale`);
    expect(p).toContain(`[${A}] Lala (Lala, the protagonist)`);
    expect(p).toContain('Lala wins the gala');
    expect(p).toContain('No romance between family');
    expect(p).toContain('Never repeat a pair Evoni turned down as "wrong for them" or "already covered"');
    expect(p).toContain('"not this type" may come back only as a different type');
    expect(p).toContain('EVONI TURNED THESE DOWN');
    expect(p).toContain('Kind: rivalries.');
    expect(p).toContain(`Every seed involves Jade [${C}]`);
    expect(p).toContain(`its guests Jade [${C}]`);
    expect(p).toContain(`Built to pay off [twist ${TW}] "Jade was the leak"`);
    expect(p).toContain('Suggest 4 NEW seeds');
    expect(p).toContain(APP_TYPES.join(', '));
    expect(p).toContain('at most 140 characters');
  });

  it('asks for family roles when aimed at family', () => {
    const p = seedPrompt({ characters, ctx: ctx(), aim: aim({ kind: 'family' }) });
    expect(p).toContain('"family_role"');
    expect(p).not.toContain('"relationship_type": "one of');
  });
});

describe('what is kept of the answer', () => {
  const run = (seeds, over = {}) => cleanSeeds({ seeds }, { characters, ctx: ctx(), aim: aim(over.aim), index: over.index || emptyIndex() });

  it('keeps basis ids that exist, with their labels, and drops invented ones', () => {
    const basis = basisOf({ episodes: [EP, 'made-up', EP], threads: [{ id: TH }], twists: ['nope'], facts: ['She lied', '', 7] }, basisCatalog(ctx()));
    expect(basis).toEqual({
      episodes: [{ id: EP, number: 3, title: 'The Gala' }], threads: [{ id: TH, title: 'Who leaked the guest list' }], twists: [], facts: ['She lied'],
    });
  });

  it('keeps the why to 140 characters, or builds one from the basis', () => {
    expect(whyOf('x'.repeat(300), { episodes: [], threads: [], twists: [] })).toHaveLength(140);
    expect(whyOf('', { episodes: [{ number: 3, title: 'The Gala' }], threads: [], twists: [] })).toBe('Builds on Episode 3 "The Gala"');
  });

  it('normalises types, sets romance, carries flavour into the situation', () => {
    const { seeds, skipped } = run([
      { a: B, b: C, relationship_type: 'emotional affair', situation: 'Late texts.', seed_why: 'Ep 3 left them alone', basis: { episodes: [EP], twists: ['invented'] } },
      { character_a_id: A, character_b_id: C, relationship_type: 'Rival', tension_state: 'boiling', connection_mode: 'Online Only' },
    ]);
    expect(skipped).toEqual([]);
    expect(seeds[0]).toMatchObject({
      relationship_type: 'love_interest', is_romantic: true, situation: 'Emotional affair: Late texts.', seed_source: 'generate',
      seed_why: 'Ep 3 left them alone', seed_basis: { episodes: [{ id: EP, number: 3, title: 'The Gala' }], twists: [] },
    });
    expect(seeds[1]).toMatchObject({ relationship_type: 'rival', is_romantic: false, tension_state: null, connection_mode: 'Online Only' });
  });

  it('skips by reason: not in the cast, the same person, a type it cannot place, the wrong kind, a twice-listed pair, family romance, the skip rule', () => {
    const index = { live: new Set([[A, B].sort().join('|')]), blocked: new Map(), heldTypes: new Set() };
    const { seeds, skipped } = run([
      { a: A, b: '99999999-9999-4999-8999-999999999999', relationship_type: 'rival' },
      { a: C, b: C, relationship_type: 'rival' },
      { a: B, b: C, relationship_type: 'keeper of keys' },
      { a: B, b: C, relationship_type: 'sister', is_romantic: true },
      { a: A, b: B, relationship_type: 'rival' },
      { a: B, b: C, relationship_type: 'rival' },
      { a: C, b: B, relationship_type: 'rival' },
    ], { index });
    expect(skipped.map((s) => [s.index, s.code])).toEqual([
      [0, 'not_in_cast'], [1, 'same_person'], [2, 'unknown_type'], [3, 'family_romance'], [4, 'already_there'], [6, 'duplicate'],
    ]);
    expect(seeds).toHaveLength(1);
    const romance = run([{ a: B, b: C, relationship_type: 'rival' }, { a: A, b: C, relationship_type: 'love_interest' }], { aim: { kind: 'romance' } });
    expect(romance.skipped.map((s) => s.code)).toEqual(['not_this_kind']);
    const focused = run([{ a: B, b: C, relationship_type: 'rival' }], { aim: { focus_character_id: A } });
    expect(focused.skipped.map((s) => s.code)).toEqual(['not_this_kind']);
  });

  it('saves family roles as Propose Family did: the role both ways, its kind, a marriage as romance', () => {
    const { seeds, skipped } = run([
      { a: B, b: C, family_role: 'stepbrother', relationship_type: 'resentful stepbrother', conflict_summary: 'The will' },
      { a: A, b: C, family_role: 'sister', is_blood_relation: true },
      { a: A, b: B, family_role: 'wife' },
      { a: A, b: B, family_role: 'nemesis' },
    ], { aim: { kind: 'family' } });
    expect(skipped.map((s) => [s.index, s.code])).toEqual([[3, 'unknown_type']]);
    expect(seeds[0]).toMatchObject({
      relationship_type: 'family', family_role: 'stepbrother', reverse_family_role: 'stepsibling', family_kind: 'step',
      is_blood_relation: false, is_romantic: false, seed_source: 'family', conflict_summary: 'The will', situation: 'Resentful stepbrother',
    });
    expect(seeds[1]).toMatchObject({ relationship_type: 'sister', family_role: 'sister', family_kind: 'blood', is_blood_relation: true });
    expect(seeds[2]).toMatchObject({ relationship_type: 'wife', family_role: 'wife', is_romantic: true, reverse_family_role: null, family_kind: null });
  });

  it('reads the older answer shapes too', () => {
    const { seeds } = cleanSeeds({ candidates: [{ character_a_id: B, character_b_id: C, relationship_type: 'mentor' }] },
      { characters, ctx: ctx(), aim: aim(), index: emptyIndex() });
    expect(seeds.map((s) => s.relationship_type)).toEqual(['mentor']);
  });
});

describe('type tidy-up proposals', () => {
  const { proposalFor } = require('../../../src/services/relationshipTypeTidy');
  const row = (over) => ({ id: 'r', a_name: 'A', b_name: 'B', confirmed: true, is_romantic: false, ...over });

  it('reads the type first, and says so', () => {
    const p = proposalFor(row({ relationship_type: 'estranged_kin', situation: 'They share a bloodline.' }));
    expect(p).toMatchObject({ proposed_type: 'family', proposed_from: 'type', flavour: 'Estranged kin' });
    expect(p.situation_after).toBe('Estranged kin: They share a bloodline.');
  });

  it('guesses from the situation when the type says nothing it knows, keeping the old words', () => {
    const p = proposalFor(row({ relationship_type: 'mirror_image', situation: 'Velour Atelier commissions Sable to document their process.' }));
    expect(p).toMatchObject({ proposed_type: 'collaborator', proposed_from: 'situation', flavour: 'Mirror image' });
    expect(p.situation_after).toBe('Mirror image: Velour Atelier commissions Sable to document their process.');
  });

  it('leaves it to her when neither the type nor the situation decides', () => {
    expect(proposalFor(row({ relationship_type: 'keeper of keys', situation: 'They meet at noon.' })))
      .toMatchObject({ proposed_type: null, proposed_from: null });
    expect(proposalFor(row({ relationship_type: 'keeper of keys', situation: null })).proposed_type).toBeNull();
  });
});
