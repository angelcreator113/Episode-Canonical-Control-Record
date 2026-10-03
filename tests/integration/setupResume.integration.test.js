/**
 * Repairable episode setup (audit STATE-01, 2026-10-03). Beat 6 fails on
 * the first scene-plan pass: beats 1–5 and 7–14 stay, the episode's
 * setup_status reads partial and names beat 6; Resume setup makes exactly
 * beat 6, leaves the other rows untouched (same ids), ends with 14 unique
 * rows and a complete setup_status; a second resume changes nothing. The
 * episode is never duplicated. Through the real route on the migrated
 * database.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const generator = require('../../src/services/episodeGeneratorService');
const setupStatusMigration = require('../../src/migrations/20261003150000-episodes-setup-status');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Resume setup: a partly initialised episode is repaired, not duplicated', () => {
  const showId = uuid(); const episodeId = uuid(); const eventId = uuid(); const homeSet = uuid();
  let token;
  const resume = () => request(app).post(`/api/v1/episode-brief/${episodeId}/setup/resume`).set('Authorization', `Bearer ${token}`).send({});
  const beats = async () => (await run(`SELECT id, beat_number FROM scene_plans WHERE episode_id = :id ORDER BY beat_number`, { id: episodeId }))[0];
  const status = async () => (await run(`SELECT setup_status FROM episodes WHERE id = :id`, { id: episodeId }))[0][0].setup_status;

  beforeAll(async () => {
    await setupStatusMigration.up(sequelize.getQueryInterface(), require('sequelize'));
    token = TokenService.generateTokenPair({
      id: 'test-user-setup-resume', email: 'user@setupresume.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    // shows.name is unique: one name per run.
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`, { id: showId, name: `Resume show ${showId.slice(0, 8)}`, slug: `resume-${showId.slice(0, 8)}` });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at) VALUES (:id, 'Resume home', 'HOME_BASE', :show, 'complete', NOW(), NOW())`, { id: homeSet, show: showId });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, created_at, updated_at) VALUES (:id, :show, 'Resume gala', 'invite', NOW(), NOW())`, { id: eventId, show: showId });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, 'Resume episode', 1, 'draft', NOW(), NOW())`, { id: episodeId, show: showId });
    await run(`INSERT INTO episode_briefs (id, episode_id, event_id, created_at, updated_at) VALUES (:id, :ep, :ev, NOW(), NOW())`, { id: uuid(), ep: episodeId, ev: eventId });
  });

  afterEach(() => jest.restoreAllMocks());

  test('beat 6 fails: the rest stay and the setup reads partial; resume makes only beat 6; a second resume makes nothing', async () => {
    const realQuery = sequelize.query.bind(sequelize);
    jest.spyOn(sequelize, 'query').mockImplementation((sql, opts) => {
      if (/INSERT INTO scene_plans/.test(String(sql)) && opts?.replacements?.beat_number === 6) return Promise.reject(new Error('disk full'));
      return realQuery(sql, opts);
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const first = await generator.resumeEpisodeSetup(models, episodeId);
    jest.restoreAllMocks();
    expect(first.scene_plan).toMatchObject({ status: 'partial', created: 13, existing: 0, missing: [6], failed: [{ beat: 6, reason: 'disk full' }] });
    const before = await beats();
    expect(before.map((b) => b.beat_number)).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(await status()).toMatchObject({ complete: false, steps: { scene_plan: { status: 'partial', missing: [6] } } });
    errSpy.mockRestore();

    const res = await resume();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { scene_plan: { status: 'complete', created: 1, existing: 13, missing: [] } } });
    const after = await beats();
    expect(after.map((b) => b.beat_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    // Beats 1–5 (and 7–14) are the same rows, untouched.
    expect(after.filter((b) => b.beat_number !== 6).map((b) => b.id)).toEqual(before.map((b) => b.id));
    expect(await status()).toMatchObject({ complete: true });
    expect((await run(`SELECT COUNT(*)::int AS n FROM episodes WHERE show_id = :show`, { show: showId }))[0][0].n).toBe(1);

    const again = await resume();
    expect(again.body).toMatchObject({ success: true, data: { scene_plan: { status: 'complete', created: 0, existing: 14 } } });
    expect((await beats()).length).toBe(14);
  });

  test('an unknown episode is 404', async () => {
    const res = await request(app).post(`/api/v1/episode-brief/${uuid()}/setup/resume`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(404);
  });
});
