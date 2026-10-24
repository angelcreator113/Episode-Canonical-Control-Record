/**
 * The shopping list and career plan writers (2026-10-24 rework):
 *   - the shopping list's lines come from the look (a line per piece, the
 *     main outfit as a dress or a top and a bottom, outerwear when worn,
 *     the essentials it lacks), worded by a forced tool call; a piece she
 *     has is a "pull" line; a budget shortfall asks for rent / borrow /
 *     swap wording; a budget refusal is thrown; the fallback names pieces;
 *   - the career writer states the deal's money (never "Unpaid event" on a
 *     deal), keeps goal / optional, keeps a goal link only to one of her
 *     goals, and throws a budget refusal;
 *   - one shopping line can be re-worded on its own.
 * The AI client is mocked.
 */
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn((input) => input),
}));
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const {
  generateTasks, generateCareerTasks, redraftDocumentLine, defaultShoppingTasks, shoppingPlan, readJsonReply,
} = require('../../../src/services/todoListService');

const tool = (name, input) => ({ content: [{ type: 'tool_use', name, input }] });
const EVENT = { name: 'Maison Rue Launch', host: 'Celeste Rue', host_brand: 'Maison Rue', venue_name: 'The Glasshouse', dress_code: 'Black tie florals', prestige: 8 };
const LOOK = {
  total: 640,
  pieces: [
    { id: 'p-top', name: 'Ivory silk camisole', category: 'top', charge: null, free_because: 'owned' },
    { id: 'p-skirt', name: 'Black satin midi skirt', category: 'skirt', charge: { amount: 400 } },
    { id: 'p-heels', name: 'Gold Mara heels', category: 'heels', charge: { amount: 240 } },
    { id: 'p-coat', name: 'Cream opera coat', category: 'jacket', charge: null, free_because: 'gifted' },
    { id: 'p-odd', name: 'Mystery thing', category: 'zzz' },
  ],
};
const budgetErr = () => Object.assign(new Error('AI daily budget exceeded'), { code: 'AI_BUDGET_EXCEEDED', status: 429 });

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('shoppingPlan', () => {
  test('from the look: a line per piece, top and bottom as the main outfit, outerwear, the essentials it lacks', () => {
    const plan = shoppingPlan(LOOK);
    expect(plan.map((l) => l.slot)).toEqual(['top', 'bottom', 'outerwear', 'shoes', 'perfume', 'hair']);
    expect(plan.find((l) => l.slot === 'bottom').piece.id).toBe('p-skirt');
    // A piece of no known line is left to the list's own "another piece" line.
    expect(plan.some((l) => l.piece?.id === 'p-odd')).toBe(false);
  });

  test('a look with no main outfit gets a line to find one', () => {
    expect(shoppingPlan({ pieces: [{ id: 'h', category: 'shoes' }] }).map((l) => l.slot)).toEqual(['dress', 'shoes', 'perfume', 'hair']);
  });

  test('without a look: the standard lines, with no separate Top and Bottom', () => {
    expect(shoppingPlan(null).map((l) => l.slot)).toEqual(['dress', 'shoes', 'purse', 'accessories', 'jewelry', 'perfume', 'hair']);
  });
});

describe('defaultShoppingTasks (no AI; Start Episode uses it without an approved list)', () => {
  test('names the pieces: hers are pulled from the closet, the rest picked up; lines carry their piece', () => {
    const tasks = defaultShoppingTasks(EVENT, LOOK);
    expect(tasks.find((t) => t.slot === 'top')).toMatchObject({ label: 'Pull my Ivory silk camisole from the closet', piece_id: 'p-top' });
    expect(tasks.find((t) => t.slot === 'shoes')).toMatchObject({ label: 'Pick up the Gold Mara heels', required: true, piece_id: 'p-heels' });
    expect(tasks.map((t) => t.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('generateTasks', () => {
  test('asks for exactly the planned lines with a forced tool call, and matches the reply by slot', async () => {
    mockCreate.mockResolvedValueOnce(tool('write_shopping_list', { lines: [
      { slot: 'shoes', label: 'Slip into the Gold Mara heels for the front row', description: 'Gold for the cameras' },
      { slot: 'top', label: 'Pull the ivory camisole that never misses', description: 'Already mine' },
    ] }));
    const tasks = await generateTasks(EVENT, { look: LOOK });
    const req = mockCreate.mock.calls[0][0];
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'write_shopping_list' });
    const prompt = req.messages[0].content;
    expect(prompt).toMatch(/top — "Ivory silk camisole": already hers \(owned\), she pulls it from her closet/);
    expect(prompt).toMatch(/bottom — "Black satin midi skirt": to buy, 400 coins/);
    expect(prompt).toMatch(/Never write a price/);
    expect(tasks.find((t) => t.slot === 'shoes').label).toBe('Slip into the Gold Mara heels for the front row');
    expect(tasks.find((t) => t.slot === 'top').label).toBe('Pull the ivory camisole that never misses');
    // A line the reply left out keeps its own fallback words.
    expect(tasks.find((t) => t.slot === 'bottom').label).toBe('Pick up the Black satin midi skirt');
  });

  test('a shortfall asks for rent, borrow or swap wording', async () => {
    mockCreate.mockResolvedValueOnce(tool('write_shopping_list', { lines: [] }));
    mockCreate.mockResolvedValueOnce(tool('write_shopping_list', { lines: [{ slot: 'top', label: 'x' }] }));
    await generateTasks(EVENT, { look: LOOK, budget: { balance: 300, total: 640 } });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toMatch(/She is 340 coins short/);
  });

  test('a budget refusal is thrown, not papered over', async () => {
    mockCreate.mockRejectedValueOnce(budgetErr());
    await expect(generateTasks(EVENT, { look: LOOK })).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
  });

  test('an API error on both tries is logged and the list is written from the look', async () => {
    mockCreate.mockRejectedValue(new Error('overloaded'));
    const tasks = await generateTasks(EVENT, { look: LOOK });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(tasks.find((t) => t.slot === 'shoes').label).toBe('Pick up the Gold Mara heels');
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Shopping list attempt 1 of 2 failed/), 'overloaded');
  });
});

describe('generateCareerTasks', () => {
  const DEAL = { ...EVENT, deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true };

  test('states the deal\'s money, not "Unpaid event"', async () => {
    mockCreate.mockResolvedValueOnce(tool('write_career_tasks', { tasks: [{ slot: 'a', label: 'Greet Celeste first', goal: true }] }));
    await generateCareerTasks(DEAL);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('We will pay you an appearance fee of 500 Prime Coins.');
    expect(prompt).not.toContain('Unpaid event');
    expect(mockCreate.mock.calls[0][0].tool_choice).toEqual({ type: 'tool', name: 'write_career_tasks' });
  });

  test('uses the money statement the caller loaded with the terms rows', async () => {
    mockCreate.mockResolvedValueOnce(tool('write_career_tasks', { tasks: [{ slot: 'a', label: 'x', goal: true }] }));
    await generateCareerTasks(DEAL, { money: 'For your content, we will pay 300 Prime Coins for 1 Pulse video.' });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('300 Prime Coins for 1 Pulse video');
  });

  test('keeps goal / optional and a goal link only to one of her goals', async () => {
    mockCreate.mockResolvedValueOnce(tool('write_career_tasks', { tasks: [
      { slot: 'a', label: 'Pitch the Maison Rue team', goal: true, goal_id: 'g-1' },
      { slot: 'b', label: 'Snap the florals', goal: false, goal_id: 'not-hers' },
      { slot: 'c', label: 'Thank Celeste after', goal: true },
    ] }));
    const tasks = await generateCareerTasks(EVENT, { goals: [{ id: 'g-1', title: 'Land a brand partnership' }] });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toMatch(/g-1: Land a brand partnership/);
    expect(tasks.map((t) => [t.task_source, t.goal_id || null])).toEqual([['goal', 'g-1'], ['optional', null], ['goal', null]]);
  });

  test('a budget refusal is thrown', async () => {
    mockCreate.mockRejectedValueOnce(budgetErr());
    await expect(generateCareerTasks(EVENT)).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
  });
});

describe('redraftDocumentLine', () => {
  test('a shopping line: the same piece, the rest of the list shown so it repeats none', async () => {
    mockCreate.mockResolvedValueOnce(tool('write_line', { label: 'Find heels that outshine the chandelier', description: 'Gold, always' }));
    const items = [{ slot: 'shoes', label: 'Pick up the Gold Mara heels', piece_id: 'p-heels' }, { slot: 'perfume', label: 'Find a scent' }];
    const out = await redraftDocumentLine(EVENT, { type: 'shopping_list', items, index: 0, look: LOOK });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatch(/"Gold Mara heels": to buy, 240 coins/);
    expect(prompt).toMatch(/- Find a scent/);
    expect(out).toEqual({ label: 'Find heels that outshine the chandelier', description: 'Gold, always' });
  });

  test('no answer on both tries: a 502, the document is left as it is', async () => {
    mockCreate.mockResolvedValue({ content: [] });
    await expect(redraftDocumentLine(EVENT, { items: [{ slot: 'shoes', label: 'Old' }], index: 0 })).rejects.toMatchObject({ status: 502 });
  });

  test('a missing line is a 404', async () => {
    await expect(redraftDocumentLine(EVENT, { items: [], index: 3 })).rejects.toMatchObject({ status: 404 });
  });
});

describe('readJsonReply', () => {
  test('reads the tool call, else JSON written as text', () => {
    expect(readJsonReply(tool('t', { a: 1 }), 't')).toEqual({ a: 1 });
    expect(readJsonReply({ content: [{ text: 'Sure:\n```json\n[1,2]\n```' }] }, 't')).toEqual([1, 2]);
    expect(() => readJsonReply({ content: [{ text: 'no' }] }, 't')).toThrow(/no JSON/);
  });
});
