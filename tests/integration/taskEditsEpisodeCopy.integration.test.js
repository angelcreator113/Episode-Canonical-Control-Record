/**
 * T5 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2304): after Start Episode,
 * task edits go to the episode's copy (episode_todo_lists.social_tasks),
 * keeping completion for tasks that carry over. Before it, the event's
 * copy is edited as before.
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
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const EVENT_TASKS = [
  { slot: 'grwm', label: 'Get Ready With Me', timing: 'before', task_source: 'goal', required: false, completed: false },
  { slot: 'arrival', label: 'Arrival Content', timing: 'during', task_source: 'goal', required: false, completed: false },
];
const EPISODE_TASKS = [
  { slot: 'grwm', label: 'Get Ready With Me', timing: 'before', task_source: 'goal', required: false, completed: true },
  { slot: 'arrival', label: 'Arrival Content', timing: 'during', task_source: 'goal', required: false, completed: false },
];

(shouldSkip ? describe.skip : describe)('task edits go to the episode after Start Episode (T5)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-t5', email: 'test@t5.dev', name: 'T5', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      await run(`DELETE FROM assets WHERE show_id = :show OR episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup assets:', err.message));
      for (const t of ['episode_briefs', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  // started: an episode whose brief names the event, with its own copy.
  async function seed({ started }) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), brief: uuid(), asset: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `T5 show ${ids.show.slice(0, 8)}`, slug: `t5-${ids.show.slice(0, 8)}` });
    const cc = JSON.stringify({ automation: { social_tasks: EVENT_TASKS } });
    if (started) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, ids);
    }
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Gala', 'invite', :status, :used, CAST(:cc AS jsonb), NOW(), NOW())`,
      { ...ids, status: started ? 'used' : 'ready', used: started ? ids.ep : null, cc });
    if (started) {
      await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
                 VALUES (:brief, :ep, :show, :event, 'draft', NOW(), NOW())`, ids);
      await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, status, created_at, updated_at)
                 VALUES (:id, :ep, :show, :event, '[]', CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
        { ...ids, id: uuid(), tasks: JSON.stringify(EPISODE_TASKS) });
    }
    return ids;
  }

  // What the Edit Tasks tab saves: a re-rendered asset whose metadata holds the edited list.
  async function editedAsset(ids, tasks) {
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, show_id, s3_url_raw, s3_url_processed,
                 approval_status, is_global, metadata, created_at, updated_at)
               VALUES (:asset, 'Edited', 'UI_OVERLAY', 'UI.OVERLAY.SOCIAL_TASKS', 'EPISODE', 'EPISODE', :show, 'https://x/png', 'https://x/png',
                 'pending', false, CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...ids, meta: JSON.stringify({ event_id: ids.event, tasks }) });
  }

  const eventTasks = async (ids) => asJson((await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, ids))[0].canon_consequences).automation.social_tasks;
  const episodeTasks = async (ids) => asJson((await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, ids))[0].social_tasks);
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('after Start Episode, an approved edit goes to the episode\'s copy and keeps completion', async () => {
    const ids = await seed({ started: true });
    const edited = [
      { slot: 'grwm', label: 'GRWM, edited', timing: 'before', task_source: 'goal', required: false, completed: false },
      { slot: 'arrival', label: 'Arrival, edited', timing: 'during', task_source: 'goal', required: false, completed: false },
      { slot: 'new_one', label: 'A new idea', timing: 'after', task_source: 'optional', required: false, completed: true },
    ];
    await editedAsset(ids, edited);

    const res = await request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/approve-overlay`).set(auth()).send({ assetId: ids.asset });
    expect(res.status).toBe(200);
    expect(res.body.savedTo).toBe('episode');

    expect((await episodeTasks(ids)).map((t) => [t.slot, t.label, t.completed])).toEqual([
      ['grwm', 'GRWM, edited', true],
      ['arrival', 'Arrival, edited', false],
      ['new_one', 'A new idea', true],
    ]);
    expect(await eventTasks(ids)).toEqual(EVENT_TASKS);
  });

  it('before Start Episode, an approved edit goes to the event\'s copy, as before', async () => {
    const ids = await seed({ started: false });
    const edited = [{ slot: 'grwm', label: 'GRWM, edited', timing: 'before', task_source: 'goal', required: false, completed: false }];
    await editedAsset(ids, edited);

    const res = await request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/approve-overlay`).set(auth()).send({ assetId: ids.asset });
    expect(res.status).toBe(200);
    expect(res.body.savedTo).toBe('event');
    expect(await eventTasks(ids)).toEqual(edited);
  });

  it('after Start Episode, the edit tab loads the episode\'s copy', async () => {
    const ids = await seed({ started: true });
    const res = await request(app).get(`/api/v1/world/${ids.show}/events/${ids.event}/overlay-tasks/social`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('episode');
    expect(res.body.tasks).toEqual(EPISODE_TASKS);
  });

  it('after Start Episode, Regenerate writes the episode\'s copy, keeping completion; the event copy is unchanged', async () => {
    const ids = await seed({ started: true });
    // T9 (Task #2395): goals are written from the event's own fields, not a
    // template, so this name-only event regenerates the name goals
    // ('presence', 'recap'). A completed 'presence' task must carry (T6).
    await run(`UPDATE episode_todo_lists SET social_tasks = CAST(:tasks AS jsonb) WHERE episode_id = :ep`, {
      ...ids,
      tasks: JSON.stringify([{ slot: 'presence', label: 'Post from Gala', timing: 'during', task_source: 'goal', required: false, completed: true }]),
    });
    const res = await request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/generate-social-checklist`).set(auth()).send({ force: true });
    expect(res.status).toBe(200);
    expect(res.body.data.savedTo).toBe('episode');
    expect(res.body.message).toMatch(/on the episode's task list/);

    const saved = await episodeTasks(ids);
    expect(saved).toEqual(res.body.data.tasks);
    expect(saved.find((t) => t.slot === 'presence').completed).toBe(true);
    expect(await eventTasks(ids)).toEqual(EVENT_TASKS);
  });
});
