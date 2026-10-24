// ============================================================================
// Season twists, 2nd round (services/seasonTwists, 2026-10-23): a written
// episode that has not planted or paid off its twist is a warning; what
// "written" means; the AI's drafts checked against the season; what
// markTwist refuses. No database: sequelize is mocked.
// ============================================================================

const {
  checkTwists, cleanDrafts, scriptWritten, markTwist, TwistError,
} = require('../../../src/services/seasonTwists');

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const slot = (n, more = {}) => ({ id: U(100 + n), slot_number: n, label: `S1 · E${n}`, done: false, ...more });

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('scriptWritten', () => {
  const script = '## BEAT: 1 · Opening\nLALA: Hi.\n\n## BEAT: 2 · Login\nLALA: In.';
  test('every beat approved is written; one open beat, or no script, is not', () => {
    expect(scriptWritten(script, [1, 2])).toBe(true);
    expect(scriptWritten(script, '[1,2]')).toBe(true);
    expect(scriptWritten(script, [1])).toBe(false);
    expect(scriptWritten('', [1, 2])).toBe(false);
    expect(scriptWritten(null, null)).toBe(false);
  });
});

describe('checkTwists: written episodes', () => {
  const twist = (more) => ({ id: U(1), title: 'The ring', status: 'planned', payoff_slot_id: U(104), planted_episode_id: null, ...more });

  test('a written plant episode, the twist still planned', () => {
    expect(checkTwists([twist({ plant: slot(1, { written: true }), payoff: slot(4) })]).map((w) => w.text))
      .toEqual(['Episode 1 is already written and doesn\'t plant "The ring" yet.']);
  });

  test('a written payoff episode, the twist not paid off', () => {
    expect(checkTwists([twist({ status: 'planted', planted_episode_id: U(9), plant: slot(1, { written: true }), payoff: slot(4, { written: true }) })]).map((w) => w.text))
      .toEqual(['Episode 4 is already written and doesn\'t pay off "The ring" yet.']);
  });

  test('marked done, dropped, or not written: no warning', () => {
    expect(checkTwists([twist({ status: 'paid_off', planted_episode_id: U(9), plant: slot(1, { written: true }), payoff: slot(4, { written: true }) })])).toEqual([]);
    expect(checkTwists([twist({ status: 'dropped', plant: slot(1, { written: true }), payoff: slot(4, { written: true }) })])).toEqual([]);
    expect(checkTwists([twist({ plant: slot(1), payoff: slot(4) })])).toEqual([]);
  });

  test('a written payoff before its plant is the order warning only', () => {
    expect(checkTwists([twist({ plant: slot(4), payoff: slot(2, { written: true }), payoff_slot_id: U(102) })]).map((w) => w.text))
      .toEqual(['"The ring" is paid off in S1 · E2, before it is planted in S1 · E4.']);
  });
});

describe('cleanDrafts', () => {
  const season = {
    slots: [slot(1, { done: true }), slot(2), slot(5), slot(9)],
    threads: [{ id: U(201), title: 'The money' }],
    characters: [{ id: U(301), name: 'Maren' }],
    twists: [{ title: 'The ring' }],
  };

  test('episode numbers become slot ids; unknown ids are dropped', () => {
    const drafts = cleanDrafts({ twists: [{
      title: ' The key ', description: 'A key on her chain', plant_episode: 2, payoff_episode: 9,
      thread_ids: [U(201), 'made-up'], character_ids: [U(301), U(999)],
    }] }, season);
    expect(drafts).toEqual([{
      title: 'The key', description: 'A key on her chain', plant_slot_id: U(102), payoff_slot_id: U(109),
      thread_ids: [U(201)], character_ids: [U(301)],
    }]);
  });

  test('a done or unknown plant is unchosen; a payoff not after its plant is unchosen', () => {
    const [done, early, unknown] = cleanDrafts({ twists: [
      { title: 'A', plant_episode: 1, payoff_episode: 5 },
      { title: 'B', plant_episode: 5, payoff_episode: 2 },
      { title: 'C', plant_slot_id: 'nope', payoff_episode: 40 },
    ] }, season);
    expect(done).toMatchObject({ plant_slot_id: null, payoff_slot_id: null });
    expect(early).toMatchObject({ plant_slot_id: U(105), payoff_slot_id: null });
    expect(unknown).toMatchObject({ plant_slot_id: null, payoff_slot_id: null });
  });

  test('no title, a twist already planned, a repeat: dropped; at most five', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, plant_episode: 2 }));
    expect(cleanDrafts({ twists: [{ title: '' }, { title: 'the ring' }, { title: 'X' }, { title: 'x' }] }, season).map((d) => d.title)).toEqual(['X']);
    expect(cleanDrafts({ twists: many }, season)).toHaveLength(5);
    expect(cleanDrafts({}, season)).toEqual([]);
  });
});

describe('markTwist refuses', () => {
  const db = (...answers) => ({ query: jest.fn(async () => answers.shift() || [[]]) });

  test('a bad id or a bad mark, before reading anything', async () => {
    const sequelize = db();
    await expect(markTwist(sequelize, 'x', U(1), 'planted')).rejects.toThrow('episodeId must be a UUID');
    await expect(markTwist(sequelize, U(1), U(2), 'done')).rejects.toBeInstanceOf(TwistError);
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  test('an episode not in the season, a twist not due in it', async () => {
    await expect(markTwist(db([[]]), U(1), U(2), 'planted')).rejects.toMatchObject({ status: 404, message: 'This episode is not in the season.' });
    await expect(markTwist(db([[{ id: U(101) }]], [[]]), U(1), U(2), 'planted')).rejects.toMatchObject({ status: 404 });
  });

  test('planted where it is paid off, paid off where it is planted, a dropped twist', async () => {
    const row = (more) => [[{ id: U(2), status: 'planned', plant_slot_id: U(101), payoff_slot_id: U(104), ...more }]];
    await expect(markTwist(db([[{ id: U(104) }]], row()), U(1), U(2), 'planted')).rejects.toMatchObject({ status: 409 });
    await expect(markTwist(db([[{ id: U(101) }]], row()), U(1), U(2), 'paid_off')).rejects.toMatchObject({ status: 409 });
    await expect(markTwist(db([[{ id: U(101) }]], row({ status: 'dropped' })), U(1), U(2), 'planted')).rejects.toMatchObject({ status: 409 });
  });
});

// Undo for Mark planted / Mark paid off (Script tab audit 6, 2026-10-24).
describe('markTwist undo', () => {
  const calls = [];
  const db = (...answers) => ({ query: jest.fn(async (sql) => { calls.push(sql); return answers.shift() || [[]]; }) });
  const row = (more) => [[{ id: U(2), status: 'planted', plant_slot_id: U(101), payoff_slot_id: U(104), ...more }]];
  beforeEach(() => { calls.length = 0; });

  test('planted goes back to planned, clearing the episode that planted it', async () => {
    await markTwist(db([[{ id: U(101) }]], row()), U(1), U(2), 'planted', { undo: true });
    expect(calls.some((q) => /SET status = 'planned', planted_episode_id = NULL/.test(q))).toBe(true);
  });
  test('a paid-off twist is not unplanted: undo the payoff first', async () => {
    await expect(markTwist(db([[{ id: U(101) }]], row({ status: 'paid_off' })), U(1), U(2), 'planted', { undo: true }))
      .rejects.toMatchObject({ status: 409, message: 'That twist is paid off: undo the payoff first.' });
  });
  test('paid off goes back to planted (or planned when never planted)', async () => {
    await markTwist(db([[{ id: U(104) }]], row({ status: 'paid_off' })), U(1), U(2), 'paid_off', { undo: true });
    expect(calls.some((q) => /CASE WHEN planted_episode_id IS NULL THEN 'planned' ELSE 'planted' END/.test(q) && /paid_off_episode_id = NULL/.test(q))).toBe(true);
  });
  test('taking back a mark that is not there writes nothing', async () => {
    await markTwist(db([[{ id: U(101) }]], row({ status: 'planned' })), U(1), U(2), 'planted', { undo: true });
    expect(calls.some((q) => /UPDATE season_twists/.test(q))).toBe(false);
  });
});
