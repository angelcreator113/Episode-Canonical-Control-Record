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

  test('a slot written before A10 reads as one primary purpose', () => {
    expect(purposesOf({ story_purpose: 'Old', story_thread_id: 't-1', story_purposes: null }))
      .toEqual([{ text: 'Old', primary: true, story_thread_id: 't-1' }]);
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
