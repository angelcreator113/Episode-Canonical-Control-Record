/**
 * T9 (docs/EVENT_EPISODE_FLOW.md §8(cc); Task #2395): "Lala's goal tasks
 * scale with the event: 2–3 for small or low-key events, 4–6 for major ones;
 * no fixed template lists."
 *
 * Start Episode (generateEpisodeFromEvent) writes the episode's list with
 * goals written from the event's fields, their count set by its prestige;
 * the Career Checklist's Regenerate (generateCareerList) writes only the
 * room left on Lala's combined goal list (T9 follow-up, 2026-09-30). S3 and the AI client are mocked. The Career List
 * asset row is seeded by SQL (see careerChecklistRegenerate.integration.test.js
 * for why Asset.create cannot run on the test database).
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

const crypto = require('crypto');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { generateCareerList } = require('../../src/services/todoListService');
const { insertEventDeliverables } = require('../../src/services/eventTermsService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const aiReturns = (n) => mockCreate.mockResolvedValueOnce({
  content: [{ text: JSON.stringify(Array.from({ length: n }, (_, i) => ({ slot: `idea_${i}`, label: `Career goal ${i}`, goal: true }))) }],
});

(shouldSkip ? describe.skip : describe)("Lala's goal tasks scale with the event (T9)", () => {
  const shows = [];

  beforeEach(() => {
    mockCreate.mockReset();
    // Any other AI call made by Start Episode fails, as it does with no key.
    mockCreate.mockRejectedValue(new Error('no AI in this test'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['assets', 'episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.error(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show })
        .catch((err) => console.error('cleanup event_deliverables:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedEvent(prestige) {
    const ids = { show: uuid(), event: uuid(), prestige };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `T9 show ${ids.show.slice(0, 8)}`, slug: `t9-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, description, format, theme, dress_code,
                 venue_name, host, host_brand, narrative_stakes, status, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Launch', 'brand_deal', :prestige,
                 'The spring collection unveiled on the rooftop. Press everywhere.', 'brand_launch', 'Garden noir',
                 'Black tie florals', 'The Glasshouse', 'Celeste Rue', 'Maison Rue',
                 'If Lala lands here, the fashion press takes her seriously.', 'ready', NOW(), NOW())`, ids);
    return ids;
  }

  async function startEpisode(ids) {
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const result = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    const [todo] = await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep: result.episode.id });
    return { episodeId: result.episode.id, tasks: parse(todo.social_tasks) };
  }

  const goals = (tasks) => tasks.filter((t) => !t.deliverable_id);

  it('Start Episode: a small event gets 2–3 goals, written from the event', async () => {
    const { tasks } = await startEpisode(await seedEvent(3));
    const g = goals(tasks);
    expect(g.length).toBeGreaterThanOrEqual(2);
    expect(g.length).toBeLessThanOrEqual(3);
    for (const t of g) expect(t).toMatchObject({ task_source: 'goal', required: false });
    expect(g.map((t) => t.label).join(' | ')).toMatch(/Black tie florals|The Glasshouse|Celeste Rue/);
  });

  it('Start Episode: a major event gets 4–6 goals; its deliverables stay required and outside the count', async () => {
    const ids = await seedEvent(9);
    await insertEventDeliverables(sequelize, ids.event, [
      { description: 'One reel in the Maison Rue coat', deliverable_type: 'reel', required: true, owed_to: 'brand' },
    ]);
    const { tasks } = await startEpisode(ids);
    const g = goals(tasks);
    expect(g.length).toBeGreaterThanOrEqual(4);
    expect(g.length).toBeLessThanOrEqual(6);
    expect(tasks.filter((t) => t.required).map((t) => t.label)).toEqual(['One reel in the Maison Rue coat']);
    // No fixed template slot survives.
    expect(g.map((t) => t.slot)).not.toEqual(expect.arrayContaining(['grwm']));
    expect(g.map((t) => t.slot)).not.toEqual(expect.arrayContaining(['go_live']));
  });

  async function seedCareerAsset(episodeId, showId) {
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, episode_id, show_id,
                 s3_url_raw, s3_url_processed, approval_status, is_global, metadata, created_at, updated_at)
               VALUES (:id, 'Old Career List', 'TODO_LIST', 'UI.OVERLAY.CAREER_LIST', 'EPISODE', 'EPISODE', :ep, :show,
                 'https://old/png', 'https://old/png', 'approved', false, '{}'::jsonb, NOW(), NOW())`,
    { id: uuid(), ep: episodeId, show: showId });
  }

  // Keep only the first `keep` of Lala's goals on the stored list (the
  // deliverables stay), as if the rest had been deleted by hand.
  async function keepGoals(episodeId, keep) {
    const [row] = await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep: episodeId });
    let n = 0;
    const kept = parse(row.social_tasks).filter((t) => t.deliverable_id || (n += 1) <= keep);
    await run(`UPDATE episode_todo_lists SET social_tasks = :tasks WHERE episode_id = :ep`, { ep: episodeId, tasks: JSON.stringify(kept) });
  }

  // T9 follow-up (Evoni, 2026-09-30): "The 2–3 / 4–6 limit applies to Lala's
  // combined goal list (Start Episode goals plus Career Checklist);
  // deliverables don't count toward it."
  it('Career Checklist: asks for the room left and holds the combined list to the maximum (small 3, major 6)', async () => {
    for (const [prestige, max, prompt] of [[2, 3, /Write 1 to 2 career tasks/], [8, 6, /Write 3 to 5 career tasks/]]) {
      const ids = await seedEvent(prestige);
      const { episodeId } = await startEpisode(ids);
      await keepGoals(episodeId, 1);
      await seedCareerAsset(episodeId, ids.show);
      mockCreate.mockReset();
      aiReturns(10);
      const { tasks } = await generateCareerList(episodeId, ids.show, models);
      expect(mockCreate.mock.calls[0][0].messages[0].content).toMatch(prompt);
      expect(tasks.filter((t) => t.generated_by === 'career')).toHaveLength(max - 1);
      expect(goals(tasks)).toHaveLength(max);
      const [row] = await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep: episodeId });
      expect(goals(parse(row.social_tasks))).toHaveLength(max);
    }
  });

  it('Career Checklist: Start Episode already filled the maximum, so no AI call and no career items; deliverables are not counted', async () => {
    const ids = await seedEvent(9);
    await insertEventDeliverables(sequelize, ids.event, [
      { description: 'One reel in the Maison Rue coat', deliverable_type: 'reel', required: true, owed_to: 'brand' },
    ]);
    const { episodeId, tasks: before } = await startEpisode(ids);
    expect(goals(before)).toHaveLength(6);
    await seedCareerAsset(episodeId, ids.show);
    mockCreate.mockReset();
    const { tasks } = await generateCareerList(episodeId, ids.show, models);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(tasks.filter((t) => t.generated_by === 'career')).toHaveLength(0);
    expect(goals(tasks)).toHaveLength(6);
    expect(tasks.filter((t) => t.required).map((t) => t.label)).toEqual(['One reel in the Maison Rue coat']);
  });

  it('Career Checklist: the AI fails, and the minimum is reached from the event\'s other fields, not repeated (small 2, major 4)', async () => {
    for (const [prestige, min] of [[3, 2], [9, 4]]) {
      const ids = await seedEvent(prestige);
      const { episodeId } = await startEpisode(ids);
      await keepGoals(episodeId, 1);
      await seedCareerAsset(episodeId, ids.show);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const { tasks } = await generateCareerList(episodeId, ids.show, models);
      const career = tasks.filter((t) => t.generated_by === 'career');
      expect(career).toHaveLength(min - 1);
      expect(goals(tasks)).toHaveLength(min);
      const labels = goals(tasks).map((t) => t.label);
      expect(new Set(labels).size).toBe(labels.length);
      expect(labels.join(' | ')).not.toMatch(/Capture the moment everyone will talk about/);
      for (const t of career) expect(t).toMatchObject({ task_source: 'goal', required: false });
    }
  });
});
