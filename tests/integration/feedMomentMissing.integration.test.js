/**
 * GET /api/v1/episode-brief/:episodeId/plan reports, in feed_moment_missing,
 * the beats whose feed moment the generator could not save and that still
 * have none (§8(w) P5 follow-up; Task #2216). The Scenes tab shows them as a
 * warning. Moments are rolled per beat, so an empty scene_plans.feed_moment
 * alone is not a failure; only beats recorded as failed on the brief count.
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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('plan route reports beats missing their feed moment (Task #2216)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-feed-moment-missing',
      email: 'test@feed-moment-missing.dev',
      name: 'Feed Moment Missing Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  // An episode with a brief recording `failed` beats, and plan rows for
  // beats 3, 7 and 9; `withMoment` beats have a saved feed moment.
  async function seed({ failed, withMoment = [] }) {
    const ids = { show: uuid(), ep: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Missing moment show ${ids.show.slice(0, 8)}`, slug: `fmm-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Missing moment episode', 1, 'draft', NOW(), NOW())`, ids);
    const save = failed === undefined ? null : JSON.stringify({
      feed_moment_save: { attempted: failed.length, saved: 0, failed: failed.map((b) => ({ beat_number: b, error: 'injected' })) },
    });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, event_metadata, created_at, updated_at)
               VALUES (:id, :ep, :show, 'draft', CAST(:save AS jsonb), NOW(), NOW())`, { ...ids, id: uuid(), save });
    for (const beat of [3, 7, 9]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, feed_moment, created_at, updated_at)
                 VALUES (:id, :ep, :beat, CAST(:moment AS jsonb), NOW(), NOW())`,
        { ...ids, id: uuid(), beat, moment: withMoment.includes(beat) ? JSON.stringify({ type: 'post' }) : null });
    }
    return ids;
  }

  // The plan list itself includes sceneSet.base_still_url, which canon has
  // (EvidenceNote_Canon_Schema_Capture_2026-09-17) but the test database
  // lacks: its migration sits in a dead tree (FD-66). Stub only that list;
  // the feed moment check under test runs real SQL on real rows.
  beforeEach(() => {
    jest.spyOn(models.ScenePlan, 'findAll').mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  const plan = (ids) => request(app)
    .get(`/api/v1/episode-brief/${ids.ep}/plan`)
    .set('Authorization', `Bearer ${token}`);

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('lists the failed beats that still have no feed moment', async () => {
    const ids = await seed({ failed: [9, 3, 7], withMoment: [7] });

    const res = await plan(ids);

    expect(res.status).toBe(200);
    expect(res.body.feed_moment_missing).toEqual([3, 9]);
  });

  it('lists nothing when no save failed, even for beats that rolled no moment', async () => {
    const ids = await seed({ failed: [], withMoment: [3] });

    const res = await plan(ids);

    expect(res.status).toBe(200);
    expect(res.body.feed_moment_missing).toEqual([]);
  });

  it('lists nothing for an episode generated before the outcome was recorded', async () => {
    const ids = await seed({ failed: undefined });

    const res = await plan(ids);

    expect(res.status).toBe(200);
    expect(res.body.feed_moment_missing).toEqual([]);
  });
});
