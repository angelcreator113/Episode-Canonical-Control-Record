/**
 * POST /api/v1/episode-brief/:episodeId/feed-moments/retry re-runs the feed
 * moment save for the beats the brief records as failed and that still have
 * no moment — only those (§8(w) P5 follow-up; Task #2220).
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const KEPT_MOMENT = { type: 'post', marker: 'already saved before the retry' };

(shouldSkip ? describe.skip : describe)('retry unsaved feed moments (Task #2220)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-feed-moment-retry',
      email: 'test@feed-moment-retry.dev',
      name: 'Feed Moment Retry Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  // Beats 7 and 12 recorded as failed with no moment; beat 10 already has a
  // moment; beat 13 rolled none. All four have a phone-moment config.
  async function seed({ failed = [7, 12], withEvent = true } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), brief: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Retry moment show ${ids.show.slice(0, 8)}`, slug: `fmr-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Retry moment episode', 1, 'draft', NOW(), NOW())`, ids);
    if (withEvent) {
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, times_used, created_at, updated_at)
                 VALUES (:event, :show, 'Retry Gala', 'used', :ep, 1, NOW(), NOW())`, ids);
    }
    const save = JSON.stringify({
      feed_moment_save: { attempted: 4, saved: 4 - failed.length, failed: failed.map((b) => ({ beat_number: b, error: 'injected' })) },
    });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, event_metadata, created_at, updated_at)
               VALUES (:brief, :ep, :show, :eventId, 'draft', CAST(:save AS jsonb), NOW(), NOW())`,
      { ...ids, eventId: withEvent ? ids.event : null, save });
    ids.rows = {};
    for (const beat of [7, 10, 12, 13]) {
      ids.rows[beat] = uuid();
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, feed_moment, created_at, updated_at)
                 VALUES (:id, :ep, :beat, CAST(:moment AS jsonb), NOW(), NOW())`,
        { ...ids, id: ids.rows[beat], beat, moment: beat === 10 ? JSON.stringify(KEPT_MOMENT) : null });
    }
    return ids;
  }

  const moments = async (ids) => {
    const rows = await q(`SELECT beat_number, feed_moment FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number`, ids);
    return Object.fromEntries(rows.map((r) => [r.beat_number, r.feed_moment]));
  };
  const record = async (ids) => (await q(`SELECT event_metadata FROM episode_briefs WHERE id = :brief`, ids))[0].event_metadata.feed_moment_save;

  const retry = (ids) => request(app)
    .post(`/api/v1/episode-brief/${ids.ep}/feed-moments/retry`)
    .set('Authorization', `Bearer ${token}`);

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('writes only the missing beats and clears them from the record', async () => {
    const ids = await seed();

    const res = await retry(ids);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ attempted: 2, saved: 2, failed: [] });
    expect(res.body.feed_moment_missing).toEqual([]);
    const after = await moments(ids);
    expect(after[7]).toEqual(expect.objectContaining({ on_screen: expect.any(Object) }));
    expect(after[12]).toEqual(expect.objectContaining({ on_screen: expect.any(Object) }));
    expect(after[10]).toEqual(KEPT_MOMENT); // already saved: untouched
    expect(after[13]).toBeNull(); // rolled no moment: not rolled again
    const rec = await record(ids);
    expect(rec.failed).toEqual([]);
    expect(rec.saved).toBe(4);
    expect(typeof rec.retried_at).toBe('string');
    // The episode and its event link are untouched.
    const [ev] = await q(`SELECT used_in_episode_id, times_used FROM world_events WHERE id = :event`, ids);
    expect(ev).toEqual({ used_in_episode_id: ids.ep, times_used: 1 });
    const [ep] = await q(`SELECT deleted_at FROM episodes WHERE id = :ep`, ids);
    expect(ep.deleted_at).toBeNull();
  });

  it('a beat that fails again stays listed, with its new error', async () => {
    const ids = await seed();
    const original = sequelize.query.bind(sequelize);
    jest.spyOn(sequelize, 'query').mockImplementation((sql, opts, ...rest) => {
      const text = typeof sql === 'string' ? sql : sql?.query || '';
      // A real SQL error inside the retry's transaction: the per-beat
      // savepoint must keep the transaction usable for beat 7 and the record.
      if (/UPDATE scene_plans SET feed_moment/.test(text) && opts?.replacements?.id === ids.rows[12]) {
        return original(`UPDATE scene_plans SET no_such_column = 1 WHERE id = :id`, opts, ...rest);
      }
      return original(sql, opts, ...rest);
    });

    const res = await retry(ids);
    jest.restoreAllMocks();

    expect(res.status).toBe(200);
    expect(res.body.data.attempted).toBe(2);
    expect(res.body.data.saved).toBe(1);
    expect(res.body.data.failed).toEqual([{ beat_number: 12, error: expect.stringContaining('no_such_column') }]);
    expect(res.body.feed_moment_missing).toEqual([12]);
    const after = await moments(ids);
    expect(after[7]).not.toBeNull();
    expect(after[12]).toBeNull();
    expect((await record(ids)).failed).toEqual([{ beat_number: 12, error: expect.stringContaining('no_such_column') }]);
  });

  it('with nothing missing it writes nothing', async () => {
    const ids = await seed({ failed: [] });

    const res = await retry(ids);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ attempted: 0, saved: 0, failed: [] });
    const after = await moments(ids);
    expect(after[7]).toBeNull();
    expect(after[12]).toBeNull();
  });

  it('refuses in plain words when the source event is gone', async () => {
    const ids = await seed({ withEvent: false });

    const res = await retry(ids);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("This episode's source event is gone, so its feed moments cannot be generated again.");
    const after = await moments(ids);
    expect(after[7]).toBeNull();
  });
});
