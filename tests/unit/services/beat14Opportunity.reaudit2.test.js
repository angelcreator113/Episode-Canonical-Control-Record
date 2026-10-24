// ============================================================================
// Beat 14 stays final, second pass (Script page re-audit, 2026-10-19): an
// attach that raced a completion is refused under the episode's lock; one
// left held on a completed episode (its resolve failed) is resolved on the
// next completion call (the read resolved it too until Script page audit 3); after an evaluation reset the 409 says what
// happened. Mocked models; no database.
// ============================================================================

const EVENT = { id: 'ev-1', name: 'Studio Session' };
jest.mock('../../../src/services/episodeMoneyService', () => ({ findSourceEvent: jest.fn(async () => EVENT) }));
jest.mock('../../../src/utils/eventAttendees', () => ({ eventAttendees: () => [7] }));
jest.mock('../../../src/utils/eventOrganizer', () => ({ eventCreatorOrganizer: () => ({ profileId: 7 }) }));

const { attachBeat14, detachBeat14, getBeat14, resolveHeldAfterCompletion, Beat14Error } = require('../../../src/services/beat14Opportunity');

const ids = { showId: 'show-1', episodeId: 'ep-1' };
const opp = (status, history = []) => {
  const o = { id: 'opp-1', name: 'Sable Campaign Shoot', status, status_history: history, offered_in_episode_id: 'ep-1' };
  o.update = jest.fn(async (u) => Object.assign(o, u));
  o.destroy = jest.fn(async () => {});
  return o;
};
// `first`: the episode as read before the transaction; `locked`: as read FOR UPDATE inside it.
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
    create: jest.fn(async (row) => ({ id: 'opp-new', ...row })),
  },
});

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('an attach that read the episode before completion committed is refused under the lock', async () => {
  const m = models({ first: 'computed', locked: 'accepted' });
  const err = await attachBeat14(m, { ...ids, create: { name: 'Late', connector_profile_id: 7 } }).catch((e) => e);
  expect(err).toBeInstanceOf(Beat14Error);
  expect(err.status).toBe(409);
  expect(m.Opportunity.create).not.toHaveBeenCalled();
  const lockSql = m.sequelize.query.mock.calls.find(([sql]) => /FOR UPDATE/.test(sql));
  expect(lockSql[1]).toMatchObject({ replacements: { episodeId: 'ep-1' }, transaction: { id: 'tx' } });
});

test('after an evaluation reset, the 409 says it was offered at completion, not that the episode is completed', async () => {
  const current = opp('offered', [{ status: 'held', source: 'beat14' }, { status: 'offered' }]);
  const err = await detachBeat14(models({ first: null, current }), ids).catch((e) => e);
  expect(err.status).toBe(409);
  expect(err.message).toBe("Its beat 14 opportunity was already offered when the episode was completed (its evaluation has been reset since), so it can't be changed or removed here.");
  expect(current.update).not.toHaveBeenCalled();
});

// Script page audit 3, 2026-10-19: the read no longer resolves it (it wrote
// unlocked, on a GET); the next Complete call does (resolveHeldAfterCompletion).
test('a read of a completed episode with its opportunity still held leaves it for the next Complete', async () => {
  const current = opp('held', [{ status: 'held', source: 'beat14' }]);
  const m = models({ first: 'accepted', evaluation: JSON.stringify({ tier_final: 'slay' }), current });
  const out = await getBeat14(m, ids);
  expect(current.update).not.toHaveBeenCalled();
  expect(out.opportunity.status).toBe('held');
  await resolveHeldAfterCompletion(m, { episodeId: 'ep-1' });
  expect(current.status_history[current.status_history.length - 1]).toMatchObject({ status: 'offered', tier: 'slay', source_event_id: 'ev-1' });
});

// Evoni, 2026-10-23: one completed without a recorded tier stayed held for
// good; it is now offered, as if the episode landed.
test('a failed tier expires it; with no recorded tier it is offered', async () => {
  const failed = opp('held', [{ status: 'held', source: 'beat14' }]);
  await expect(resolveHeldAfterCompletion(models({ first: 'accepted', evaluation: { tier_final: 'fail' }, current: failed }), { episodeId: 'ep-1' }))
    .resolves.toMatchObject({ status: 'expired' });
  const unknown = opp('held', [{ status: 'held', source: 'beat14' }]);
  await expect(resolveHeldAfterCompletion(models({ first: 'accepted', evaluation: null, current: unknown }), { episodeId: 'ep-1' })).resolves.toMatchObject({ status: 'offered' });
  expect(unknown.status_history[unknown.status_history.length - 1]).toMatchObject({ status: 'offered', tier: null, source_event_id: 'ev-1', note: 'Completed without a recorded tier; offered' });
});

test('an episode not completed, or nothing held, changes nothing', async () => {
  const held = opp('held');
  await expect(resolveHeldAfterCompletion(models({ first: 'computed', evaluation: { tier_final: 'pass' }, current: held }), { episodeId: 'ep-1' })).resolves.toBeNull();
  const offered = opp('offered');
  await expect(resolveHeldAfterCompletion(models({ first: 'accepted', evaluation: { tier_final: 'pass' }, current: offered }), { episodeId: 'ep-1' })).resolves.toBeNull();
  expect(held.update).not.toHaveBeenCalled();
  expect(offered.update).not.toHaveBeenCalled();
});
