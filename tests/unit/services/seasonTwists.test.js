// ============================================================================
// Season twists (services/seasonTwists, 2026-10-23): what the list warns
// about, which twists a slot plants or pays off, the prompt block the script
// writers read, and what setTwist refuses. No database: sequelize is mocked.
// ============================================================================

const {
  checkTwists, twistsForSlot, renderTwistBlock, twistBlock, setTwist, TwistError,
} = require('../../../src/services/seasonTwists');

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const slot = (n, more = {}) => ({ id: U(100 + n), slot_number: n, label: `S1 · E${n}`, done: false, ...more });

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('checkTwists', () => {
  const twist = (more) => ({ id: U(1), title: 'The ring', status: 'planned', payoff_slot_id: null, planted_episode_id: null, ...more });

  test('a plant with a later payoff, or none yet, is fine', () => {
    expect(checkTwists([twist({ plant: slot(1), payoff: slot(4), payoff_slot_id: U(104) })])).toEqual([]);
    expect(checkTwists([twist({ plant: slot(1), payoff: null })])).toEqual([]);
  });

  test('a payoff before its plant, or in the same episode', () => {
    expect(checkTwists([twist({ plant: slot(4), payoff: slot(2), payoff_slot_id: U(102) })]).map((w) => w.text))
      .toEqual(['"The ring" is paid off in S1 · E2, before it is planted in S1 · E4.']);
    expect(checkTwists([twist({ plant: slot(3), payoff: slot(3), payoff_slot_id: U(103) })]).map((w) => w.text))
      .toEqual(['"The ring" is planted and paid off in the same episode, S1 · E3. Pay it off later.']);
  });

  test('a payoff with no plant, and slots no longer in the season', () => {
    expect(checkTwists([twist({ plant: null, payoff: slot(5), payoff_slot_id: U(105) })]).map((w) => w.text))
      .toEqual(['"The ring" is paid off in S1 · E5 with no plant: its plant episode is no longer in the season.']);
    expect(checkTwists([twist({ plant: null, payoff: null })]).map((w) => w.text))
      .toEqual(['"The ring": the episode it is planted in is no longer in the season.']);
    expect(checkTwists([twist({ plant: slot(1), payoff: null, payoff_slot_id: U(999) })]).map((w) => w.text))
      .toEqual(['"The ring": the episode it is paid off in is no longer in the season.']);
  });

  test('paid off but never planted; a dropped twist is not checked', () => {
    expect(checkTwists([twist({ status: 'paid_off', plant: slot(1), payoff: slot(4), payoff_slot_id: U(104) })])[0])
      .toEqual({ twist_id: U(1), text: '"The ring" is marked paid off but was never planted in an episode.' });
    expect(checkTwists([twist({ status: 'dropped', plant: slot(4), payoff: slot(2), payoff_slot_id: U(102) })])).toEqual([]);
  });
});

describe('twistsForSlot', () => {
  const here = { id: U(104), slot_number: 4 };
  const rows = [
    { id: 'a', status: 'planned', plant_slot_id: U(104), payoff_slot_id: U(108), plant_number: 4 },
    { id: 'b', status: 'planted', plant_slot_id: U(101), payoff_slot_id: U(104), plant_number: 1 },
    { id: 'c', status: 'planned', plant_slot_id: U(106), payoff_slot_id: U(104), plant_number: 6 },
    { id: 'd', status: 'planned', plant_slot_id: U(999), payoff_slot_id: U(104), plant_number: null },
    { id: 'e', status: 'dropped', plant_slot_id: U(104), payoff_slot_id: null, plant_number: 4 },
  ];
  test('plants here; pays off only what was planted before; never a dropped one', () => {
    const out = twistsForSlot(rows, here);
    expect(out.plant.map((r) => r.id)).toEqual(['a']);
    expect(out.payoff.map((r) => r.id)).toEqual(['b']);
  });
});

describe('the twist block', () => {
  test('empty with none', () => {
    expect(renderTwistBlock({ plant: [], payoff: [] })).toBe('');
    expect(renderTwistBlock()).toBe('');
  });

  test('plant and pay off, each with its words', () => {
    const block = renderTwistBlock({
      plant: [{ title: 'The ring', description: 'Maren is not wearing it', characters: ['Maren'], note: null }],
      payoff: [{ title: 'The rent', description: 'The landlord texts at the gala', characters: [], note: 'On the phone screen', planted_in: { episode_number: 1 } }],
    });
    expect(block).toContain('═══ SEASON TWISTS ═══');
    expect(block).toContain('PLANT (subtly; do not explain): The ring — Maren is not wearing it (with Maren)');
    expect(block).toContain('PAY OFF: The rent — The landlord texts at the gala (planted in episode 1) Note: On the phone screen');
    expect(block).toMatch(/SCRIPT DIRECTIVE: a plant is a detail .+; a payoff makes the earlier plant land/);
    expect(block.indexOf('PLANT')).toBeLessThan(block.indexOf('PAY OFF'));
  });

  test("reads the episode's slot; '' with no slot, a bad id, or no table yet", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([[{ id: U(104), arc_id: U(9), slot_number: 4 }]])
      .mockResolvedValueOnce([[
        { id: 'b', title: 'The rent', description: null, status: 'planted', plant_slot_id: U(101), payoff_slot_id: U(104), plant_number: 1, character_ids: '[]' },
      ]]);
    expect(await twistBlock({ query }, U(50))).toContain('PAY OFF: The rent (planted in episode 1)');
    expect(await twistBlock({ query: jest.fn().mockResolvedValueOnce([[]]) }, U(50))).toBe('');
    expect(await twistBlock({ query: jest.fn() }, 'nope')).toBe('');
    expect(await twistBlock({ query: jest.fn().mockRejectedValue(new Error('relation "season_twists" does not exist')) }, U(50))).toBe('');
  });
});

describe('setTwist refuses', () => {
  const SHOW = U(7);
  const slots = [
    { id: U(101), arc_id: U(9), slot_number: 1, episode_id: null, accepted_at: null },
    { id: U(104), arc_id: U(9), slot_number: 4, episode_id: null, accepted_at: null },
    { id: U(105), arc_id: U(9), slot_number: 5, episode_id: null, accepted_at: new Date() },
  ];
  const db = () => ({ query: jest.fn(async (sql, { replacements }) => [slots.filter((s) => replacements.ids?.includes(s.id))]) });
  const refuse = async (body, status, message) => {
    const err = await setTwist(db(), SHOW, body).catch((e) => e);
    expect(err).toBeInstanceOf(TwistError);
    expect(err.status).toBe(status);
    if (message) expect(err.message).toMatch(message);
  };

  test('no title, no plant, a bad status', async () => {
    await refuse({ plant_slot_id: U(101) }, 400, /title/);
    await refuse({ title: 'x' }, 400, /plants it/);
    await refuse({ title: 'x', plant_slot_id: U(101), status: 'shouted' }, 400, /planned, planted/);
  });

  test('a payoff before or at its plant; a slot of another show; a done episode', async () => {
    await refuse({ title: 'x', plant_slot_id: U(104), payoff_slot_id: U(101) }, 400, /payoff comes after the plant/);
    await refuse({ title: 'x', plant_slot_id: U(104), payoff_slot_id: U(104) }, 400, /payoff comes after the plant/);
    await refuse({ title: 'x', plant_slot_id: U(555) }, 404, /not in this show/);
    await refuse({ title: 'x', plant_slot_id: U(101), payoff_slot_id: U(105) }, 409, /done/);
    await refuse({ title: 'x', plant_slot_id: U(101), status: 'paid_off' }, 400, /pays it off/);
  });
});
