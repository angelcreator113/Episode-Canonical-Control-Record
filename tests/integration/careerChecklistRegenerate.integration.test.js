/**
 * T4 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2300): Regenerate replaces
 * the Career Checklist's image instead of adding another asset row, and the
 * saved image comes back with the saved list. The AI suggests only goals
 * and ideas; deliverables come from the event's terms.
 *
 * S3 and the AI client are mocked; the PNG is rendered for real (canvas).
 *
 * Each case seeds the episode's Career List asset row by SQL. The test
 * database is built from src/migrations, which lack two columns the Asset
 * model writes (processing_status, s3_key_processed; production has both,
 * EvidenceNote_Canon_Schema_Capture_2026-09-17.txt), so Asset.create cannot
 * run here. The create-when-none path is covered by
 * tests/unit/services/todoListService.careerAsset.test.js.
 */
jest.unmock('uuid');

const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input) => input),
}));

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateCareerList } = require('../../src/services/todoListService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const aiReturns = (tasks) => mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(tasks) }] });

(shouldSkip ? describe.skip : describe)('Career Checklist regenerate replaces its image (T4)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-career-t4', email: 'test@career-t4.dev', name: 'Career T4', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      await run(`DELETE FROM assets WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup assets:', err.message));
      await run(`DELETE FROM episode_todo_lists WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup todo:', err.message));
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show })
        .catch((err) => console.warn('cleanup event_deliverables:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), deliv: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `T4 show ${ids.show.slice(0, 8)}`, slug: `t4-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, used_in_episode_id, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Launch', 'brand_deal', 'used', :ep, NOW(), NOW())`, ids);
    await run(`INSERT INTO event_deliverables (id, event_id, description, required, owed_to, status, created_at, updated_at)
               VALUES (:deliv, :event, 'One reel in the coat', true, 'brand', 'pending', NOW(), NOW())`, ids);
    ids.asset = uuid();
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, episode_id, show_id,
                 s3_url_raw, s3_url_processed, approval_status, is_global, metadata, created_at, updated_at)
               VALUES (:asset, 'Old Career List', 'TODO_LIST', 'UI.OVERLAY.CAREER_LIST', 'EPISODE', 'EPISODE', :ep, :show,
                 'https://old/png', 'https://old/png', 'approved', false, '{"source":"career-list-generator","kept":"yes"}'::jsonb, NOW(), NOW())`, ids);
    return ids;
  }

  const careerAssets = (ep) => q(
    `SELECT id, s3_url_processed FROM assets WHERE episode_id = :ep AND asset_role = 'UI.OVERLAY.CAREER_LIST' AND deleted_at IS NULL`,
    { ep }
  );

  it('regenerating updates the episode\'s asset row in place; no row is added', async () => {
    const ids = await seed();
    mockS3Send.mockClear();
    aiReturns([{ slot: 'content_main', label: 'Film the venue walkthrough', goal: true }]);
    const first = await generateCareerList(ids.ep, ids.show, models);
    aiReturns([{ slot: 'network', label: 'Meet the editor', goal: false }]);
    const second = await generateCareerList(ids.ep, ids.show, models);

    const rows = await careerAssets(ids.ep);
    expect(rows.map((r) => r.id)).toEqual([ids.asset]);
    expect(first.assetId).toBe(ids.asset);
    expect(second.assetId).toBe(ids.asset);
    expect(second.assetUrl).not.toBe(first.assetUrl);
    expect(rows[0].s3_url_processed).toBe(second.assetUrl);
    expect(mockS3Send).toHaveBeenCalledTimes(2);

    const [row] = await q(`SELECT name, s3_url_raw, metadata FROM assets WHERE id = :id`, { id: ids.asset });
    expect(row.name).toBe('Maison Rue Launch — Career List');
    expect(row.s3_url_raw).toBe(second.assetUrl);
    expect(row.metadata).toMatchObject({ kept: 'yes', source: 'career-list-generator', list_type: 'career', event_id: ids.event });
  });

  it('the AI\'s items are goals or ideas; the only required item is the real deliverable', async () => {
    const ids = await seed();
    aiReturns([
      { slot: 'content_main', label: 'Film the venue walkthrough', goal: true },
      { slot: 'brand_money_shot', label: 'Deliver the sponsored reel', goal: true, required: true },
    ]);
    const { tasks } = await generateCareerList(ids.ep, ids.show, models);

    const required = tasks.filter((t) => t.required);
    expect(required.map((t) => t.deliverable_id)).toEqual([ids.deliv]);
    for (const t of tasks.filter((x) => x.generated_by === 'career')) {
      expect(['goal', 'optional']).toContain(t.task_source);
      expect(t.required).toBe(false);
    }
  });

  it('GET /todo/social returns the saved list and the saved image', async () => {
    const ids = await seed();
    aiReturns([{ slot: 'content_main', label: 'Film the venue walkthrough', goal: true }]);
    const { assetUrl, tasks } = await generateCareerList(ids.ep, ids.show, models);

    const res = await request(app).get(`/api/v1/episodes/${ids.ep}/todo/social`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.career_asset_url).toBe(assetUrl);
    expect(res.body.social_tasks).toEqual(tasks);
  });

  it('an episode with no career image returns career_asset_url null', async () => {
    const ids = await seed();
    await run(`DELETE FROM assets WHERE id = :asset`, ids);
    const res = await request(app).get(`/api/v1/episodes/${ids.ep}/todo/social`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.career_asset_url).toBeNull();
  });
});
