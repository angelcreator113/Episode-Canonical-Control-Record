// ============================================================================
// Beat 14, third pass (Script page audit 3, 2026-10-19):
// - a failed episode's invitation stays gone once its expired opportunity is
//   archived (decided from the completion's own history entry);
// - detach locks the episode and refuses once it is completed, so it cannot
//   slip in between completion's commit and its resolve;
// - the read writes nothing (completion's repeat call is the retry).
// Mocked models; no database.
// ============================================================================

const EVENT = { id: 'ev-1', name: 'Studio Session' };
jest.mock('../../../src/services/episodeMoneyService', () => ({ findSourceEvent: jest.fn(async () => EVENT) }));
jest.mock('../../../src/utils/eventAttendees', () => ({ eventAttendees: () => [7] }));
jest.mock('../../../src/utils/eventOrganizer', () => ({ eventCreatorOrganizer: () => ({ profileId: 7 }) }));

const { detachBeat14, getBeat14, beat14Context, loadForScript, Beat14Error } = require('../../../src/services/beat14Opportunity');
const { beat14Outcome } = require('../../../src/utils/beat14Invitation');
const { coverageFacts } = require('../../../src/services/groundedScriptGeneratorService');

const ids = { showId: 'show-1', episodeId: 'ep-1' };
const opp = (status, history = []) => {
  const o = { id: 'opp-1', name: 'Sable Campaign Shoot', status, status_history: history, offered_in_episode_id: 'ep-1', contact_name: 'Sable' };
  o.update = jest.fn(async (u) => Object.assign(o, u));
  o.destroy = jest.fn(async () => {});
  return o;
};
const models = ({ first = 'draft', locked = first, evaluation = null, current = null } = {}) => ({
  sequelize: {
    QueryTypes: { SELECT: 'SELECT' },
    query: jest.fn(async (sql) => {
      if (/FOR UPDATE/.test(sql)) return [{ evaluation_status: locked }];
      if (/FROM episodes/.test(sql)) return [{ id: 'ep-1', show_id: 'show-1', title: 'The Studio', evaluation_status: first, evaluation_json: evaluation }];
      if (/FROM social_profiles/.test(sql)) return [{ id: 7, handle: 'sable', display_name: 'Sable Reyes' }];
      return [];
    }),
    transaction: async (fn) => fn({ id: 'tx' }),
  },
  Opportunity: {
    findOne: jest.fn(async ({ where }) => (where.offered_in_episode_id ? current : null)),
    findAll: jest.fn(async () => []),
  },
});

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('a failed episode\'s invitation stays gone', () => {
  const EXPIRED_THEN_ARCHIVED = [
    { status: 'held', source: 'beat14' },
    { status: 'expired', tier: 'fail', source_event_id: 'ev-1', note: 'The episode did not land; the offer never came' },
    { status: 'archived', from: 'expired' },
  ];

  test('archived after it expired at completion, beat 14 still withholds it', () => {
    expect(beat14Outcome({ status: 'archived', status_history: EXPIRED_THEN_ARCHIVED }, 'pass')).toBe('withheld');
  });

  test('offered at completion and declined or archived later, it still came', () => {
    const offered = [{ status: 'held' }, { status: 'offered', tier: 'pass' }, { status: 'declined' }, { status: 'archived' }];
    expect(beat14Outcome({ status: 'archived', status_history: offered }, 'fail')).toBe('invitation');
  });

  test('the writer reads what completion decided (completion_status), as the Script tab does', async () => {
    const read = await loadForScript({ Opportunity: { findOne: async () => opp('archived', EXPIRED_THEN_ARCHIVED) } }, { episodeId: 'ep-1' });
    expect(read.completion_status).toBe('expired');
    expect(beat14Outcome(read, 'pass')).toBe('withheld');
    expect(beat14Context(read, 'pass')).toContain('This episode did not land, so the invitation does not come');
    expect(coverageFacts({ beat14: read, brief: { designed_intent: 'pass' } }).opportunity).toBeNull();
  });

  test('held and never decided, it follows the designed intent as before', () => {
    expect(beat14Outcome({ status: 'held', status_history: [{ status: 'held' }] }, 'fail')).toBe('withheld');
    expect(beat14Outcome({ status: 'held', status_history: [{ status: 'held' }] }, 'pass')).toBe('invitation');
  });
});

describe('detach takes the episode lock and refuses a completed episode', () => {
  test('a detach that read the episode before completion committed is refused under the lock', async () => {
    const current = opp('held', [{ status: 'held', source: 'beat14' }]);
    const m = models({ first: 'computed', locked: 'accepted', current });
    const err = await detachBeat14(m, ids).catch((e) => e);
    expect(err).toBeInstanceOf(Beat14Error);
    expect(err.status).toBe(409);
    expect(current.update).not.toHaveBeenCalled();
    expect(current.destroy).not.toHaveBeenCalled();
    const lockSql = m.sequelize.query.mock.calls.find(([sql]) => /FOR UPDATE/.test(sql));
    expect(lockSql[1]).toMatchObject({ replacements: { episodeId: 'ep-1' }, transaction: { id: 'tx' } });
  });

  test('while the episode is not completed, a held one is still let go', async () => {
    const current = opp('held', [{ status: 'held', source: 'beat14' }]);
    await expect(detachBeat14(models({ current }), ids)).resolves.toEqual({ opportunity: null });
    expect(current.destroy).toHaveBeenCalled();
  });
});

test('the read writes nothing, even with one still held on a completed episode', async () => {
  const current = opp('held', [{ status: 'held', source: 'beat14' }]);
  const m = models({ first: 'accepted', evaluation: JSON.stringify({ tier_final: 'slay' }), current });
  const out = await getBeat14(m, ids);
  expect(current.update).not.toHaveBeenCalled();
  expect(out.opportunity.status).toBe('held');
});
