/**
 * Season Arc A10 (Evoni, 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff)):
 * "A slot can hold up to three story purposes, one marked primary, each
 * optionally tied to a story thread. [...] The script writer receives all
 * purposes, primary first".
 */
const { normalisePurposes, purposesOf, MAX_PURPOSES } = require('../../../src/services/seasonIntentionService');
const { buildSeasonPositionBlock } = require('../../../src/services/episodeScriptWriterService');

describe('normalisePurposes (A10)', () => {
  test('returns the primary first, drops empty entries and keeps a thread-only one', () => {
    expect(normalisePurposes([
      { text: ' Side ', primary: false },
      { text: '', primary: false },
      { text: 'Main', primary: true, story_thread_id: 't-1' },
      { text: '', story_thread_id: 't-2' },
    ])).toEqual([
      { text: 'Main', primary: true, story_thread_id: 't-1' },
      { text: 'Side', primary: false, story_thread_id: null },
      { text: '', primary: false, story_thread_id: 't-2' },
    ]);
  });

  test('with none marked, the first is primary', () => {
    expect(normalisePurposes([{ text: 'A' }, { text: 'B' }]).map((p) => p.primary)).toEqual([true, false]);
  });

  test(`refuses more than ${MAX_PURPOSES} purposes or more than one primary`, () => {
    expect(() => normalisePurposes([{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }])).toThrow(/up to 3/);
    expect(() => normalisePurposes([{ text: 'A', primary: true }, { text: 'B', primary: true }])).toThrow(/Only one/);
  });

  test('a slot written before A10 reads as one primary purpose, with the slot\'s source', () => {
    expect(purposesOf({ story_purpose: 'Old', story_thread_id: 't-1', story_purposes: null }))
      .toEqual([{ text: 'Old', primary: true, story_thread_id: 't-1', source: 'auto-drafted' }]);
    expect(purposesOf({ story_purpose: 'Mine', story_purposes: null, intention_source: 'edited' })[0].source).toBe('edited');
    // A purpose stored without a source takes the slot's; one stored with it keeps its own.
    expect(purposesOf({ intention_source: 'edited', story_purposes: [{ text: 'A', primary: true }, { text: 'B', source: 'auto-drafted' }] })
      .map((p) => p.source)).toEqual(['edited', 'auto-drafted']);
    expect(purposesOf({ story_purpose: null })).toEqual([]);
  });
});

describe('buildSeasonPositionBlock (A10)', () => {
  const sc = { label: 'S1 · E3', phase: { number: 1, title: 'Foundation' }, position_in_phase: 3, desired_pressure: 'High' };

  test('gives the script writer every purpose, primary first, with its thread', () => {
    const block = buildSeasonPositionBlock({
      ...sc,
      story_purpose: 'Lala bluffs her way in',
      story_purposes: [
        { text: 'The rival notices', primary: false, story_thread: 'The rival' },
        { text: 'Lala bluffs her way in', primary: true, story_thread: null },
        { text: '', primary: false, story_thread: 'Old debt' },
      ],
    });
    expect(block).toContain([
      'Story purposes (primary first):',
      '1. [Primary] Lala bluffs her way in',
      '2. The rival notices (continues the thread "The rival")',
      '3. Continue the thread "Old debt"',
    ].join('\n'));
    expect(block).toContain('Desired pressure: High');
    expect(block).toContain('the primary purpose leads, and the others are woven in');
  });

  test('one purpose, or a snapshot from before A10, keeps the single lines', () => {
    const block = buildSeasonPositionBlock({ ...sc, story_purpose: 'Face her', story_thread: 'The rival' });
    expect(block).toContain('Story purpose: Face her\nStory thread it continues: The rival\n');
    expect(block).not.toContain('primary first');
  });
});

// Q12 as amended (Evoni, 2026-11-12): what the automatic draft treats as an
// empty intention. All six fields empty and no source label; when in doubt,
// the slot is written.
describe('intentionOccupied', () => {
  const { intentionOccupied } = require('../../../src/services/seasonIntentionService');
  const EMPTY = { story_purpose: null, story_purposes: null, story_thread_id: null, career_focus: null, desired_pressure: null, outcome_range: null, intention_source: null };

  test('an untouched slot is empty, and so are blank text, an empty list and an empty or null range', () => {
    expect(intentionOccupied(EMPTY)).toBe(false);
    expect(intentionOccupied({})).toBe(false);
    for (const over of [
      { story_purpose: '   ' }, { career_focus: '' }, { desired_pressure: '' }, { intention_source: ' ' },
      { story_purposes: [] }, { story_purposes: '[]' }, { outcome_range: {} }, { outcome_range: '{}' }, { outcome_range: 'null' },
    ]) expect([over, intentionOccupied({ ...EMPTY, ...over })]).toEqual([over, false]);
  });

  test('each of the six fields alone makes it written', () => {
    for (const over of [
      { story_purpose: 'Mine' },
      { story_purposes: [{ text: 'A side story', primary: false }] },
      { story_purposes: JSON.stringify([{ text: '', story_thread_id: 't1' }]) },
      { story_thread_id: 't1' },
      { career_focus: 'reputation' },
      { desired_pressure: 'High' },
      { outcome_range: { min: 'pass', max: 'slay' } },
      { outcome_range: '{"min":"pass","max":"slay"}' },
    ]) expect([over, intentionOccupied({ ...EMPTY, ...over })]).toEqual([over, true]);
  });

  test('a source label alone, of any kind, makes it written', () => {
    for (const source of ['auto-drafted', 'edited', 'imported', 'AUTO-DRAFTED']) expect(intentionOccupied({ ...EMPTY, intention_source: source })).toBe(true);
  });

  test('when in doubt it is written: no slot, purposes that are not a list, values that cannot be read', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(intentionOccupied(null)).toBe(true);
    expect(intentionOccupied(undefined)).toBe(true);
    for (const over of [
      { story_purposes: { text: 'odd' } }, { story_purposes: '{"text":"odd"}' }, { story_purposes: 'not json' }, { story_purposes: 7 },
      { outcome_range: 'not json' }, { outcome_range: [] }, { outcome_range: 'pass' }, { outcome_range: 0 },
    ]) expect([over, intentionOccupied({ ...EMPTY, ...over })]).toEqual([over, true]);
    jest.restoreAllMocks();
  });
});
