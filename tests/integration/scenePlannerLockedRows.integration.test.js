/**
 * B2 (Evoni, 2026-10-02): "The scene planner never deletes locked plan rows
 * on a rewrite." generateScenePlan deleted every plan row of the episode
 * (locked ones included) and recreated them all unlocked. Through
 * POST /api/v1/episode-brief/:episodeId/generate-plan, with the AI faked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));

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
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('The scene planner keeps locked beats on a rewrite (B2)', () => {
  const show = uuid(); const ep = uuid(); const home = uuid(); const venue = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-planner-b2', email: 'user@planner-b2.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `B2 ${show.slice(0, 8)}`, slug: `b2-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala', 1, 'draft', NOW(), NOW())`, { ep, show });
    for (const [id, name, type] of [[home, 'Lala apartment', 'HOME_BASE'], [venue, 'The Glasshouse', 'EVENT_LOCATION']]) {
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at)
                 VALUES (:id, :name, :type, :show, 'complete', NOW(), NOW())`, { id, name, type, show });
    }
    await models.EpisodeBrief.create({ episode_id: ep });
    // Evoni's plan so far: beat 3 locked on the venue's WIDE, beat 4 unlocked.
    await models.ScenePlan.bulkCreate([
      { episode_id: ep, beat_number: 3, beat_name: 'Welcome', scene_set_id: venue, angle_label: 'WIDE', emotional_intent: 'Mine', locked: true, sort_order: 2 },
      { episode_id: ep, beat_number: 4, beat_name: 'Interruption Pulse 1', scene_set_id: venue, angle_label: 'WIDE', locked: false, sort_order: 3 },
    ]);
    const beats = Array.from({ length: 14 }, (_, i) => ({
      beat_number: i + 1, beat_name: `Beat ${i + 1}`, scene_set_id: home, angle_label: 'CLOSE', shot_type: 'medium', emotional_intent: 'AI', confidence: 0.8,
    }));
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify(beats) }] });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM scene_plans WHERE episode_id = :ep', { ep });
    await run('DELETE FROM episode_briefs WHERE episode_id = :ep', { ep });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM scene_sets WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  it('rewrites the unlocked beats and leaves the locked one as Evoni set it', async () => {
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`)).send({});

    expect(res.status).toBe(200);
    const plan = await rows(`SELECT beat_number, scene_set_id, angle_label, emotional_intent, locked
                               FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number`, { ep });
    expect(plan).toHaveLength(14);
    expect(plan.find((p) => p.beat_number === 3)).toEqual({ beat_number: 3, scene_set_id: venue, angle_label: 'WIDE', emotional_intent: 'Mine', locked: true });
    expect(plan.find((p) => p.beat_number === 4)).toEqual(expect.objectContaining({ scene_set_id: home, angle_label: 'CLOSE', locked: false }));
    // The response reports the plan as saved, the locked beat included.
    expect(res.body.data.find((b) => b.beat_number === 3)).toEqual(expect.objectContaining({ scene_set_id: venue, locked: true }));
  });
});
