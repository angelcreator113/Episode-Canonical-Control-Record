/**
 * The wardrobe shopping list's Purse line (Evoni, 2026-10-06: "separate
 * Purse and Accessories lines"). A piece ticks its line by the wardrobe's
 * own category names and aliases; before, a line ticked only on an exact
 * match, and no bag is ever saved as 'accessories', so the bag line never
 * ticked.
 */
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: jest.fn() } })));

const Anthropic = require('@anthropic-ai/sdk');
const { listSlotOf, listSlotsFilled, taskFilled, getTodoList, generateTasks } = require('../../../src/services/todoListService');

describe('listSlotOf', () => {
  it.each([
    ['bag', 'purse'], ['Handbag', 'purse'], ['purse', 'purse'], ['clutch', 'purse'], ['evening clutch', 'purse'], ['tote', 'purse'],
    ['accessory', 'accessories'], ['accessories', 'accessories'], ['belt', 'accessories'], ['silk scarf', 'accessories'],
    ['jewelry', 'jewelry'], ['earrings', 'jewelry'], ['perfume', 'perfume'], ['fragrance', 'perfume'],
    ['shoes', 'shoes'], ['heels', 'shoes'], ['dress', 'dress'], ['gown', 'dress'], ['top', 'top'], ['skirt', 'bottom'],
    ['outerwear', null], [null, null], ['', null],
  ])('%s → %s', (category, slot) => {
    expect(listSlotOf(category)).toBe(slot);
  });
});

describe('listSlotsFilled and taskFilled', () => {
  it('a top and a bottom fill the main outfit', () => {
    const filled = listSlotsFilled(['top', 'skirt', 'handbag']);
    expect(filled.has('dress')).toBe(true);
    expect(filled.has('purse')).toBe(true);
    expect(filled.has('accessories')).toBe(false);
  });

  it('a bag ticks Purse, not Accessories, on a list with both lines', () => {
    const filled = listSlotsFilled(['bag']);
    expect(taskFilled('purse', filled)).toBe(true);
    expect(taskFilled('accessories', filled)).toBe(false);
  });

  it("a list saved before the Purse line: its Accessories line takes a bag or an accessory", () => {
    expect(taskFilled('accessories', listSlotsFilled(['bag']), { legacyAccessories: true })).toBe(true);
    expect(taskFilled('accessories', listSlotsFilled(['belt']), { legacyAccessories: true })).toBe(true);
    expect(taskFilled('accessories', listSlotsFilled(['shoes']), { legacyAccessories: true })).toBe(false);
  });
});

describe('getTodoList ticks lines from the outfit', () => {
  const run = (tasks, categories) => {
    const sequelize = {
      QueryTypes: { SELECT: 'SELECT' },
      query: jest.fn()
        .mockResolvedValueOnce([{ id: 'l1', episode_id: 'ep', tasks: JSON.stringify(tasks) }])
        .mockResolvedValueOnce(categories.map((c) => ({ clothing_category: c }))),
    };
    return getTodoList('ep', { sequelize });
  };
  const task = (slot, required = false) => ({ slot, label: slot, required, completed: false });

  it('a bag ticks the Purse line; a scarf ticks Accessories', async () => {
    const list = await run([task('dress', true), task('shoes', true), task('purse'), task('accessories')], ['dress', 'heels', 'clutch']);
    const done = Object.fromEntries(list.tasks.map((t) => [t.slot, t.completed]));
    expect(done).toEqual({ dress: true, shoes: true, purse: true, accessories: false });
    expect(list.completion).toMatchObject({ total: 4, completed: 3, all_required_done: true });
  });

  it('an older list (no Purse line) ticks Accessories for a bag', async () => {
    const list = await run([task('dress', true), task('accessories')], ['bag']);
    expect(list.tasks.find((t) => t.slot === 'accessories').completed).toBe(true);
  });
});

describe('generateTasks falls back with a Purse line', () => {
  it('the fallback list has Purse and Accessories as separate lines', async () => {
    Anthropic.mockImplementation(() => ({ messages: { create: jest.fn().mockResolvedValue({ content: [{ text: 'not json' }] }) } }));
    const tasks = await generateTasks({ name: 'Gala', prestige: 8 });
    expect(tasks.map((t) => t.slot)).toEqual(['dress', 'shoes', 'purse', 'accessories', 'jewelry', 'perfume', 'top', 'bottom']);
    expect(tasks.find((t) => t.slot === 'purse').label).toBe('Find a clutch that holds secrets and lipstick');
  });
});
