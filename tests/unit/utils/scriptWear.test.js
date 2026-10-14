/**
 * The Shopping list as of a beat (Task #3188; Evoni, 2026-10-14, phone phase
 * 3 rulings 1 and 2): what Lala has put on by a beat and line of the script,
 * and the list crossed off from it.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());
// The shopping list's overlay draws with canvas; nothing here draws.
jest.mock('canvas', () => ({ createCanvas: jest.fn(), registerFont: jest.fn(), loadImage: jest.fn() }));

const { scriptBeats, wornByBeat } = require('../../../src/utils/scriptWear');
const { getTodoList } = require('../../../src/services/todoListService');

const LOOK = [
  { id: 'dress-1', name: 'Crimson Gown', clothing_category: 'dress' },
  { id: 'shoe-1', name: 'Satin Pump', clothing_category: 'shoes' },
  { id: 'bag-1', name: 'Pearl Clutch', clothing_category: 'clutch' },
  { id: 'ear-1', name: 'Pearl Drop', clothing_category: 'jewelry' },
  { id: 'ear-2', name: 'Pearl Drop', clothing_category: 'jewelry' },
];
const SCRIPT = [
  '[EVENT: name="Gala"]',
  '## BEAT: 7 · Interruption Pulse 2',
  'Lala: "A deal?"',
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  '[WEAR: dress-1]',
  'Lala: "This one."',
  '[UI:SELECT Item satin pump]',
  '[UI:SELECT Item Pearl Drop]',
  '',
  '## BEAT: 10 · Location',
  'Lala: "Ready."',
].join('\n');

describe('the beats, numbered as the Script tab numbers them', () => {
  test('a numbered header names its beat; its lines are the non-empty ones after the header', () => {
    expect(scriptBeats(SCRIPT).map((b) => [b.number, b.lines.length])).toEqual([[7, 1], [8, 5], [10, 1]]);
    expect(scriptBeats('## BEAT: Opening\nLala: "Hi"\n## BEAT: Close\nPrime: "Bye"').map((b) => b.number)).toEqual([1, 2]);
    expect(scriptBeats('')).toEqual([]);
  });
});

describe('worn by a beat and line', () => {
  const ids = (r) => r.worn.map((p) => p.id).sort();

  test('a [WEAR] piece from its line on; a legacy select by its exact name; an ambiguous name never', () => {
    expect(ids(wornByBeat(SCRIPT, LOOK, 8, 0))).toEqual([]);
    expect(ids(wornByBeat(SCRIPT, LOOK, 8, 1))).toEqual(['dress-1']);
    expect(ids(wornByBeat(SCRIPT, LOOK, 8, 3))).toEqual(['dress-1', 'shoe-1']);
  });

  test('a piece no cue puts on comes on at the last getting-ready beat (here the closet beat, 8), and is listed as uncued', () => {
    const before = wornByBeat(SCRIPT, LOOK, 7);
    expect(ids(before)).toEqual([]);
    expect(before.uncued.map((p) => p.id).sort()).toEqual(['bag-1', 'ear-1', 'ear-2']);
    expect(ids(wornByBeat(SCRIPT, LOOK, 8))).toEqual(['bag-1', 'dress-1', 'ear-1', 'ear-2', 'shoe-1']);
    expect(ids(wornByBeat(SCRIPT, LOOK, 10))).toEqual(['bag-1', 'dress-1', 'ear-1', 'ear-2', 'shoe-1']);
  });

  test('a wear cue after the closet beat moves the getting-ready beat to it', () => {
    const later = `${SCRIPT}\n## BEAT: 11 · Arrival\n[WEAR: bag-1]`;
    expect(ids(wornByBeat(later, LOOK, 10))).toEqual(['dress-1', 'shoe-1']);
    expect(ids(wornByBeat(later, LOOK, 11))).toEqual(['bag-1', 'dress-1', 'ear-1', 'ear-2', 'shoe-1']);
  });

  test('with no closet beat and no cue, an uncued piece counts from the start; a beat not in the script wears nothing', () => {
    expect(ids(wornByBeat('## BEAT: 2 · Login\nLala: "Hi"', LOOK, 2))).toEqual(['bag-1', 'dress-1', 'ear-1', 'ear-2', 'shoe-1']);
    expect(wornByBeat(SCRIPT, LOOK, 13)).toMatchObject({ worn: [], beatFound: false });
  });
});

describe('getTodoList as of a beat', () => {
  const TASKS = [
    { slot: 'dress', label: 'The look', required: true },
    { slot: 'shoes', label: 'Heels', required: true },
    { slot: 'purse', label: 'A clutch', required: false },
  ];
  function fakeModels() {
    const query = jest.fn(async (sql) => {
      if (sql.includes('FROM episode_todo_lists')) return [{ id: 't1', episode_id: 'ep1', tasks: TASKS }];
      if (sql.includes('SELECT script_content')) return [{ script_content: SCRIPT }];
      if (sql.includes("ew.approval_status = 'approved'")) return LOOK;
      if (sql.includes('FROM episode_wardrobe')) return LOOK.map((p) => ({ clothing_category: p.clothing_category }));
      throw new Error(`unexpected SQL: ${sql}`);
    });
    return { sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
  }

  test('each line is crossed off from the line its piece is put on, never before', async () => {
    const done = async (beat, line) => (await getTodoList('ep1', fakeModels(), { beat, line })).tasks.map((t) => [t.slot, t.completed]);
    expect(await done(8, 0)).toEqual([['dress', false], ['shoes', false], ['purse', false]]);
    expect(await done(8, 1)).toEqual([['dress', true], ['shoes', false], ['purse', false]]);
    expect(await done(8, 3)).toEqual([['dress', true], ['shoes', true], ['purse', false]]);
    // The whole closet beat: the uncued clutch comes on there.
    expect(await done(8, null)).toEqual([['dress', true], ['shoes', true], ['purse', true]]);
  });

  test('as of a beat it says what was worn and which pieces were never put on screen', async () => {
    const list = await getTodoList('ep1', fakeModels(), { beat: 7 });
    expect(list.as_of).toMatchObject({ beat: 7, line: null, beat_found: true, worn: [] });
    expect(list.as_of.uncued.map((p) => p.name)).toEqual(['Pearl Clutch', 'Pearl Drop', 'Pearl Drop']);
    expect(list.completion).toMatchObject({ total: 3, completed: 0 });
  });

  test('with no beat, the list follows the look as it is now, as before', async () => {
    const list = await getTodoList('ep1', fakeModels());
    expect(list.as_of).toBeUndefined();
    expect(list.tasks.every((t) => t.completed)).toBe(true);
  });
});
