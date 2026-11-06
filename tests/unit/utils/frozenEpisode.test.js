// ============================================================================
// A1.2c: src/utils/frozenEpisode.js and where deletion and Start use it.
// No database (a stub sequelize); the controller is read as text.
// ============================================================================
const fs = require('fs');
const path = require('path');
const frozen = require('../../../src/utils/frozenEpisode');
const { startBlockersFrom, startRefusalError } = require('../../../src/services/startReadinessService');

const EP = '11111111-1111-4111-8111-111111111111';
const EV = '22222222-2222-4222-8222-222222222222';
const ROOT = path.join(__dirname, '..', '..', '..');

test('filmedAt reads the earliest clip with no deleted_at filter, in the caller\'s transaction', async () => {
  const query = jest.fn(async () => [[{ frozen_at: new Date('2026-10-23T20:23:51Z') }]]);
  expect(await frozen.filmedAt({ query }, EP, { transaction: 't' })).toBe('2026-10-23T20:23:51.000Z');
  const [sql, opts] = query.mock.calls[0];
  expect(sql).toMatch(/MIN\(created_at\) AS frozen_at FROM episode_raw_clips WHERE episode_id = :episodeId$/);
  expect(opts.transaction).toBe('t');
  expect(await frozen.filmedAt({ query: async () => [[{ frozen_at: null }]] }, EP)).toBeNull();
});

test('findFrozenDeletedEpisode looks at deleted episodes only, linked by the event or a brief', async () => {
  const query = jest.fn(async () => [[{ id: EP, title: 'Filmed', episode_number: 1, frozen_at: '2026-10-23T20:23:51Z' }]]);
  expect(await frozen.findFrozenDeletedEpisode({ query }, EV)).toEqual({ id: EP, title: 'Filmed', episode_number: 1, frozen_at: '2026-10-23T20:23:51.000Z' });
  const [sql] = query.mock.calls[0];
  expect(sql).toMatch(/e\.deleted_at IS NOT NULL/);
  expect(sql).toMatch(/used_in_episode_id FROM world_events WHERE id = :eventId/);
  expect(sql).toMatch(/episode_id FROM episode_briefs WHERE event_id = :eventId/);
  expect(sql).toMatch(/JOIN episode_raw_clips c ON c\.episode_id = e\.id/);
  expect(sql).not.toMatch(/c\.deleted_at/);
});

test('the refusals: 409 with their codes, never retryable', () => {
  const d = frozen.deleteRefusal(EP, '2026-10-23T20:23:51Z');
  expect(d).toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
  expect(d.toJSON()).toMatchObject({ success: false, code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: EP, frozen_at: '2026-10-23T20:23:51.000Z' });
  const r = frozen.restartRefusal(EV, { id: EP, title: 'Filmed', episode_number: 1, frozen_at: '2026-10-23T20:23:51.000Z' });
  expect(r.toJSON()).toMatchObject({ code: 'EVENT_EPISODE_FROZEN', event_id: EV, episode_id: EP });
  expect(r.message).toMatch(/^Episode 1 "Filmed" was filmed \(since 2026-10-23\)/);
  expect(frozen.isFrozenEpisodeError(d) && frozen.isFrozenEpisodeError(r)).toBe(true);
});

describe('the Start blocker (startBlockersFrom, pure)', () => {
  const ep = { id: EP, title: 'Filmed', episode_number: 1, frozen_at: '2026-10-23T20:23:51.000Z' };
  test('a deleted filmed episode blocks Start, and Start throws EVENT_EPISODE_FROZEN', () => {
    const [b] = startBlockersFrom({ frozenDeleted: ep, eventId: EV });
    expect(b).toMatchObject({ key: 'episode_frozen', event_id: EV, episode: ep });
    expect(startRefusalError(b)).toMatchObject({ status: 409, code: 'EVENT_EPISODE_FROZEN' });
  });
  test('never on a Regenerate (it replaces a live episode)', () => {
    expect(startBlockersFrom({ frozenDeleted: ep, eventId: EV, replacingEpisodeId: 'x' })).toEqual([]);
  });
  test('none without one', () => {
    expect(startBlockersFrom({ eventId: EV })).toEqual([]);
  });
});

test('DELETE /episodes/:id locks the episode, asks filmedAt, then deletes, in one transaction', () => {
  const text = fs.readFileSync(path.join(ROOT, 'src', 'controllers', 'episodeController.js'), 'utf8');
  const start = text.indexOf('async deleteEpisode(');
  const body = text.slice(start, text.indexOf('// Log activity', start));
  const lock = body.indexOf('lockEpisodes(');
  const ask = body.indexOf('filmedAt(');
  const refuse = body.indexOf('throw deleteRefusal(');
  expect(lock).toBeGreaterThan(body.indexOf('Episode.sequelize.transaction('));
  expect(ask).toBeGreaterThan(lock);
  expect(refuse).toBeGreaterThan(ask);
  expect(body.indexOf('episode.destroy({ force: true, transaction })')).toBeGreaterThan(refuse);
  expect(body.indexOf('episode.softDelete({ transaction })')).toBeGreaterThan(refuse);
  // No role can skip it: the check is not behind any role or query condition.
  expect(body.slice(0, refuse)).not.toMatch(/ADMIN|req\.user\?\.role/);
});

test('there is no switch that turns it off', () => {
  expect(fs.readFileSync(path.join(ROOT, 'src', 'utils', 'frozenEpisode.js'), 'utf8')).not.toMatch(/process\.env/);
});
