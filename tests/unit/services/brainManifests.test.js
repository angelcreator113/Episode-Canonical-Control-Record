/**
 * Brain Manifests for every synced page (Brain Update step 2;
 * docs/BRAIN_OWNERSHIP.md): the shared builder's handling of lists,
 * records, whole values and presentation, and each manifest's keys.
 */
const { makeManifest } = require('../../../src/services/brainManifests/makeManifest');
const { MANIFESTS } = require('../../../src/services/brainSyncService');

const demo = makeManifest({
  SOURCE: 'demo', LABEL: 'Demo Page', PAGE_CONTENT: 'demo', SOURCE_DOCUMENT: 'demo-v1.0',
  PRESENTATION: ['letter'],
  DOMAINS: [
    { key: 'RULE', kind: 'rule', label: 'Core Rule', whole: true },
    { key: 'QUESTIONS', kind: 'questions', label: 'Questions', whole: true },
    { key: 'PROFILE', kind: 'profile', label: 'Profile', whole: true },
    { key: 'SHOWS', kind: 'show', label: 'Show', id: 'name' },
    { key: 'STEPS', kind: 'step', label: 'Step', name: (i) => `Step ${i.step}` },
    { key: 'FIELDS', kind: 'field', label: 'Field', id: 'field', humanizeName: true },
    { key: 'GROUPS', kind: 'group', label: 'Group', id: 'group' },
  ],
});

describe('makeManifest', () => {
  const { cards } = demo.buildCards({
    RULE: '  The Feed is always watching.  ',
    QUESTIONS: ['What layer?', 'What stage?'],
    PROFILE: { scores: { attentionSeeking: 75, ambition: 95 }, notes: ['Builds for her Besties.'], color: '#fff' },
    SHOWS: [{ name: 'Starlight Awards', month: 'November', categories: ['Creator of the Year', 'Fashion Icon'], color: { bg: '#fff', text: '#000' }, letter: 'S', desc: 'The main event.' }],
    STEPS: [{ step: 1, who: 'Tier 5-6' }],
    FIELDS: [{ field: 'self_narrative', function_: 'The story is partially wrong.' }],
    GROUPS: [{ group: 'Fashion Icons', icon: '👗', roles: [{ role: 'The Style Queen', fn: 'Defines fashion', color: '#d4789a' }] }],
    UNLISTED: [{ name: 'never sent' }],
  });
  const byKey = Object.fromEntries(cards.map((c) => [c.source_key, c]));

  test('a whole value is one card: a rule, a list of questions, a profile record', () => {
    expect(byKey['demo:rule']).toMatchObject({ title: 'Core Rule — Demo Page', content: 'Core Rule (Demo Page)\nThe Feed is always watching.' });
    expect(byKey['demo:questions'].content).toBe('Questions (Demo Page)\n- What layer?\n- What stage?');
    expect(byKey['demo:profile'].content).toBe('Profile (Demo Page)\nScores: Attention seeking: 75; Ambition: 95\nNotes: Builds for her Besties.');
  });

  test('lists join, abbreviations read as words, and presentation never travels, even inside a field', () => {
    expect(byKey['demo:show:starlight-awards'].content).toBe(
      'Starlight Awards (Show)\nCategories: Creator of the Year; Fashion Icon\nDescription: The main event.\nMonth: November');
    expect(byKey['demo:group:fashion-icons'].content).toBe('Fashion Icons (Group)\nRoles:\n- Role: The Style Queen · Fn: Defines fashion');
  });

  test('a computed or snake_case name, and only listed domains', () => {
    expect(byKey['demo:step:step-1'].title).toBe('Step 1 — Step');
    expect(byKey['demo:field:self-narrative'].content).toBe('Self narrative (Field)\nFunction: The story is partially wrong.');
    expect(cards.some((c) => /never sent/.test(c.content))).toBe(false);
    expect(cards).toHaveLength(7);
  });

  test('a missing or empty whole value makes no card', () => {
    expect(demo.buildCards({ RULE: '   ', QUESTIONS: [] }).cards).toEqual([]);
  });
});

describe('the registered manifests', () => {
  test('eight pages, each with its own key prefix, page content and legacy source document', () => {
    expect(Object.keys(MANIFESTS).sort()).toEqual([
      'character_depth_engine', 'character_life_simulation', 'cultural_calendar', 'cultural_memory',
      'social_personality', 'social_systems', 'social_timeline', 'world_foundation',
    ]);
    expect(MANIFESTS.world_foundation).toMatchObject({ PAGE_CONTENT: 'world_infrastructure', SOURCE_DOCUMENT: 'world-infrastructure-v1.0', LABEL: 'World Foundation' });
    expect(MANIFESTS.cultural_calendar.SOURCE_DOCUMENT).toBe('cultural-system-v2.0');
    for (const m of Object.values(MANIFESTS)) expect(m.buildCards({}).cards).toEqual([]);
  });

  test('World Foundation sends the DREAM cities, never the map letter, key or colors', () => {
    const { cards } = MANIFESTS.world_foundation.buildCards({
      DREAM_CITIES: [{ key: 'dazzle_district', letter: 'D', name: 'Dazzle District', color: '#d4789a', lightColor: '#fdf2f6', capitalOf: 'Fashion', majorEvents: ['Velvet Season'] }],
      CITIES: [{ name: 'Velvet City' }],
    });
    expect(cards.map((c) => c.source_key)).toEqual(['world_foundation:city:dazzle-district']);
    expect(cards[0].content).toBe('Dazzle District (DREAM City)\nCapital of: Fashion\nMajor events: Velvet Season');
  });

  test('Character Depth Engine shows snake_case ids as words', () => {
    const { cards } = MANIFESTS.character_depth_engine.buildCards({ BLINDSPOT_CATEGORIES: [{ cat: 'self_assessment', desc: 'Wrong about her own qualities' }] });
    expect(cards[0]).toMatchObject({ source_key: 'character_depth_engine:blindspot:self-assessment', title: 'Self assessment — Blind Spot' });
  });
});
