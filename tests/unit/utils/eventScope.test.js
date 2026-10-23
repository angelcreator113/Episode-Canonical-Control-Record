/**
 * utils/eventScope.js — loadScopedEvent and assertTermsWritable, the shared
 * event read and terms check of the Event Package routes. Mocked sequelize.
 */

const { loadScopedEvent, assertTermsWritable } = require('../../../src/utils/eventScope');
const { EVENT_TERMS_LOCKED_CODE } = require('../../../src/utils/eventTermsLock');

const LOCK_EPISODE = { id: 'ep-1', title: 'Gala Night', episode_number: 3, show_id: 's1' };

function seq({ row = { id: 'e1', show_id: 's1' }, briefEpisode = null, reopened = false } = {}) {
  return {
    query: jest.fn(async (sql) => {
      if (/FROM world_events WHERE id = :eventId AND show_id = :showId/.test(sql)) return [row ? [row] : []];
      if (/FROM episode_briefs b/.test(sql)) return [briefEpisode ? [briefEpisode] : []];
      if (/^SELECT used_in_episode_id FROM world_events/.test(sql)) return [[{ used_in_episode_id: null }]];
      if (/^SELECT canon_consequences FROM world_events/.test(sql)) {
        return [[{ canon_consequences: reopened ? { terms_reopen: { at: 'now' } } : {} }]];
      }
      return [[]];
    }),
  };
}

describe('loadScopedEvent', () => {
  test('reads the live row in this show (id, show_id, deleted_at), one row', async () => {
    const s = seq();
    const row = await loadScopedEvent(s, { showId: 's1', eventId: 'e1' });
    expect(row).toEqual({ id: 'e1', show_id: 's1' });
    const [sql, opts] = s.query.mock.calls[0];
    expect(sql).toBe('SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1');
    expect(opts).toEqual({ replacements: { eventId: 'e1', showId: 's1' } });
  });

  test('null when absent (another show, deleted, or missing)', async () => {
    expect(await loadScopedEvent(seq({ row: null }), { showId: 's2', eventId: 'e1' })).toBeNull();
  });

  test('lock: FOR UPDATE inside the given transaction; a column list is kept', async () => {
    const s = seq();
    const t = { id: 'tx' };
    await loadScopedEvent(s, { showId: 's1', eventId: 'e1', transaction: t, lock: true, columns: 'id, show_id, deal_type' });
    const [sql, opts] = s.query.mock.calls[0];
    expect(sql).toBe('SELECT id, show_id, deal_type FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE');
    expect(opts.transaction).toBe(t);
  });

  test('refuses a lock without a transaction, and a column list that is not plain names', async () => {
    await expect(loadScopedEvent(seq(), { showId: 's1', eventId: 'e1', lock: true })).rejects.toThrow(/transaction/);
    await expect(loadScopedEvent(seq(), { showId: 's1', eventId: 'e1', columns: 'id; DROP TABLE x' })).rejects.toThrow(/column list/);
  });
});

describe('assertTermsWritable', () => {
  test('null when no episode locks the terms', async () => {
    expect(await assertTermsWritable(seq(), 'e1')).toBeNull();
  });

  test('a uniform 409 refusal with termsLockedBody when an episode locks them', async () => {
    const refusal = await assertTermsWritable(seq({ briefEpisode: LOCK_EPISODE }), 'e1', { fields: ['costs'] });
    expect(refusal.status).toBe(409);
    expect(refusal.lockEpisode).toEqual(LOCK_EPISODE);
    expect(refusal.body).toMatchObject({ success: false, code: EVENT_TERMS_LOCKED_CODE, fields: ['costs'], episode: { id: 'ep-1' } });
  });

  test('a caller may give its own 409 body', async () => {
    const refusal = await assertTermsWritable(seq({ briefEpisode: LOCK_EPISODE }), 'e1', { body: (ep) => ({ mine: ep.id }) });
    expect(refusal.body).toEqual({ mine: 'ep-1' });
  });

  test('reopened terms lift the lock', async () => {
    expect(await assertTermsWritable(seq({ briefEpisode: LOCK_EPISODE, reopened: true }), 'e1')).toBeNull();
  });
});
