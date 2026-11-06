// ============================================================================
// A1.2a: src/utils/snapshotFreeze.js without a database (a stub sequelize).
// ============================================================================
const freeze = require('../../../src/utils/snapshotFreeze');
const { lockEpisodes } = require('../../../src/utils/episodeLocks');

const EP = '11111111-1111-4111-8111-111111111111';
function stub(frozenAt) {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, opts) => {
      calls.push({ sql, opts });
      if (/FROM episodes WHERE id IN/.test(sql)) return [[{ id: EP }]];
      if (/episode_raw_clips/.test(sql)) return [[{ frozen_at: frozenAt }]];
      return [[]];
    }),
  };
}
let n = 0;
const handle = () => `tx-${(n += 1)}`;

describe('snapshotFrozen', () => {
  test('needs the caller\'s transaction', async () => {
    await expect(freeze.snapshotFrozen(stub(null), EP, {})).rejects.toThrow(/caller's transaction/);
  });
  test('needs the episode locked FOR UPDATE by that transaction', async () => {
    const s = stub(null);
    const t = handle();
    await expect(freeze.snapshotFrozen(s, EP, { transaction: t })).rejects.toMatchObject({ code: 'SNAPSHOT_GUARD_WITHOUT_LOCK' });
    await lockEpisodes(s, [EP], { transaction: t, mode: 'share' });
    await expect(freeze.snapshotFrozen(s, EP, { transaction: t })).rejects.toMatchObject({ code: 'SNAPSHOT_GUARD_WITHOUT_LOCK' });
  });
  test('reads the earliest clip with no deleted_at filter, in the transaction', async () => {
    const s = stub(new Date('2026-10-23T20:23:51Z'));
    const t = handle();
    await lockEpisodes(s, [EP], { transaction: t });
    expect(await freeze.snapshotFrozen(s, EP, { transaction: t })).toEqual({ frozen: true, frozen_at: '2026-10-23T20:23:51.000Z' });
    const q = s.calls.find((c) => /episode_raw_clips/.test(c.sql));
    expect(q.sql).toMatch(/MIN\(created_at\)/);
    expect(q.sql).not.toMatch(/deleted_at/);
    expect(q.opts.transaction).toBe(t);
  });
  test('no rows: not frozen', async () => {
    const s = stub(null);
    const t = handle();
    await lockEpisodes(s, [EP], { transaction: t });
    expect(await freeze.snapshotFrozen(s, EP, { transaction: t })).toEqual({ frozen: false, frozen_at: null });
  });
});

describe('the refusals', () => {
  test.each([
    ['frozenError', () => freeze.frozenError(EP, '2026-10-23T20:23:51Z'), 'EPISODE_SNAPSHOT_FROZEN'],
    ['startRecordError', () => freeze.startRecordError(EP, '2026-10-23T20:23:51Z', ['season_number']), 'START_RECORD_FROZEN'],
    ['intentPendingAuditError', () => freeze.intentPendingAuditError(EP, '2026-10-23T20:23:51Z', ['designed_intent']), 'INTENT_EDIT_PENDING_AUDIT'],
    ['lateContextError', () => freeze.lateContextError(EP, '2026-10-23T20:23:51Z'), 'LATE_CONTEXT_NOT_AVAILABLE'],
  ])('%s: 409 with its code, the episode and frozen_at, never retryable', (_n, make, code) => {
    const err = make();
    expect(freeze.isFreezeError(err)).toBe(true);
    expect(err).toMatchObject({ status: 409, statusCode: 409, code });
    expect(err.toJSON()).toMatchObject({ success: false, code, episode_id: EP, frozen_at: '2026-10-23T20:23:51.000Z' });
    expect(err.name).not.toBe('RetryableConflictError');
  });
  test('the intent refusal says when it can be changed (B-1 = b)', () => {
    expect(freeze.intentPendingAuditError(EP, null, ['designed_intent']).message)
      .toBe('Intent on a filmed episode can be changed once the audited editor is available. Nothing was changed.');
  });
  test('the Start-record refusal names the fields', () => {
    expect(freeze.startRecordError(EP, '2026-10-23', ['arc_number', 'position_in_arc']).toJSON().fields).toEqual(['arc_number', 'position_in_arc']);
  });
});

describe('changedFields: an unchanged value is accepted', () => {
  const current = { arc_number: 1, position_in_arc: 1, event_difficulty: { strictness: 5, deadline: 'tight' }, designed_intent: 'slay', allowed_outcomes: ['slay', 'pass', 'safe'] };
  test.each([
    [{ arc_number: '1' }, []],
    [{ arc_number: 2 }, ['arc_number']],
    [{ event_difficulty: { deadline: 'tight', strictness: 5 } }, []],
    [{ event_difficulty: JSON.stringify({ deadline: 'tight', strictness: 5 }) }, []],
    [{ event_difficulty: { strictness: 6, deadline: 'tight' } }, ['event_difficulty']],
    [{ allowed_outcomes: ['slay', 'pass', 'safe'] }, []],
    [{ allowed_outcomes: ['safe', 'pass', 'slay'] }, ['allowed_outcomes']],
    [{ designed_intent: 'pass' }, ['designed_intent']],
    [{ narrative_purpose: 'anything' }, []],
  ])('%j → %j', (patch, changed) => {
    expect(freeze.changedFields(current, patch, ['arc_number', 'position_in_arc', 'event_difficulty', 'designed_intent', 'allowed_outcomes'])).toEqual(changed);
  });
  test('a stored null and an empty list or object or text are the same', () => {
    expect(freeze.sameValue(null, [])).toBe(true);
    expect(freeze.sameValue(null, {})).toBe(true);
    expect(freeze.sameValue(null, '')).toBe(true);
    expect(freeze.sameValue(null, 0)).toBe(false);
  });
});

test('the protected fields are exactly the confirmed list (V-1)', () => {
  expect(freeze.START_RECORD_FIELDS).toEqual({ episodes: ['season_number'], episode_briefs: ['event_difficulty', 'arc_number', 'position_in_arc'] });
  expect(freeze.FROZEN_INTENT_FIELDS).toEqual(['designed_intent', 'allowed_outcomes']);
  for (const editable of ['episode_archetype', 'narrative_purpose', 'forward_hook', 'lala_state_snapshot']) {
    expect(freeze.START_RECORD_FIELDS.episode_briefs).not.toContain(editable);
    expect(freeze.FROZEN_INTENT_FIELDS).not.toContain(editable);
  }
});

test('skip reports and the frozen-skip marker', () => {
  const skip = freeze.frozenSkip(EP, '2026-10-23T20:23:51Z', { label: 'S1 · E1' });
  expect(freeze.isFrozenSkip(skip)).toBe(true);
  expect(freeze.contextOf(skip)).toEqual({ label: 'S1 · E1' });
  expect(freeze.contextOf({ label: 'S1 · E2' })).toEqual({ label: 'S1 · E2' });
  expect(freeze.isFrozenSkip({ label: 'S1 · E2' })).toBe(false);
  expect(freeze.skipEntry(EP, '2026-10-23T20:23:51Z', 'S1 · E1')).toEqual({ episode_id: EP, label: 'S1 · E1', frozen_at: '2026-10-23T20:23:51.000Z', reason: 'snapshot_frozen' });
});
