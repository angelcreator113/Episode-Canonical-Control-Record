/**
 * The feed-moment beat step of generateEpisodeFromEvent persists each beat's
 * feed moment onto its scene_plans row, or reports the failure
 * (docs/EVENT_EPISODE_FLOW.md §8(w) P5; Task #2213).
 *
 * It used to call row.update() on the plain objects createScenePlanRows
 * returns, which threw "row.update is not a function" for every beat; each
 * throw was logged as non-blocking and nothing was saved.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('feed-moment beat step saves or reports (§8(w) P5)', () => {
  const shows = [];

  async function seedEvent() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Feed moment show ${ids.show.slice(0, 8)}`, slug: `fm-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, status, created_at, updated_at)
               VALUES (:event, :show, 'Feed Moment Gala', 'ready', NOW(), NOW())`, ids);
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    return { ids, event };
  }

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('each beat with a feed moment has it saved on its scene_plans row', async () => {
    const { ids, event } = await seedEvent();

    const result = await generateEpisodeFromEvent(event, models, { showId: ids.show });

    const momentBeats = Object.keys(result.feedMoments || {}).map(Number).filter((n) => result.feedMoments[n]);
    expect(momentBeats.length).toBeGreaterThan(0);
    const rows = await q(
      `SELECT beat_number, feed_moment FROM scene_plans WHERE episode_id = :ep AND beat_number IN (:beats) ORDER BY beat_number`,
      { ep: result.episode.id, beats: momentBeats }
    );
    expect(rows.map((r) => r.beat_number)).toEqual(momentBeats.sort((a, b) => a - b));
    for (const r of rows) expect(r.feed_moment).toEqual(result.feedMoments[r.beat_number]);
    expect(result.feedMomentSave).toEqual({ attempted: momentBeats.length, saved: momentBeats.length, failed: [] });
    // The outcome is recorded on the brief for the Scenes tab (Task #2216).
    const [brief] = await q(`SELECT event_metadata FROM episode_briefs WHERE episode_id = :ep`, { ep: result.episode.id });
    expect(brief.event_metadata.feed_moment_save).toMatchObject({ attempted: momentBeats.length, saved: momentBeats.length, failed: [] });
  });

  it('a failed save is reported, not counted as saved', async () => {
    const { ids, event } = await seedEvent();
    const original = sequelize.query.bind(sequelize);
    jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
      const text = typeof sql === 'string' ? sql : sql?.query || '';
      if (/UPDATE scene_plans SET feed_moment/.test(text)) return Promise.reject(new Error('injected feed moment save failure'));
      return original(sql, ...rest);
    });

    const result = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    jest.restoreAllMocks();

    expect(result.feedMomentSave.saved).toBe(0);
    expect(result.feedMomentSave.failed.length).toBe(result.feedMomentSave.attempted);
    expect(result.feedMomentSave.failed.length).toBeGreaterThan(0);
    expect(result.feedMomentSave.failed[0].error).toContain('injected feed moment save failure');
    const saved = await q(`SELECT count(*)::int AS n FROM scene_plans WHERE episode_id = :ep AND feed_moment IS NOT NULL`, { ep: result.episode.id });
    expect(saved[0].n).toBe(0);
    // The failed beats are recorded on the brief for the Scenes tab (Task #2216).
    const [brief] = await q(`SELECT event_metadata FROM episode_briefs WHERE episode_id = :ep`, { ep: result.episode.id });
    expect(brief.event_metadata.feed_moment_save.failed.map((f) => f.beat_number))
      .toEqual(result.feedMomentSave.failed.map((f) => f.beat_number));
  });
});
