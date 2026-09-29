/**
 * T1 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2292): Start Episode writes
 * social tasks whose only required entries are the event's accepted
 * deliverables (event_deliverables rows). Generated tasks are goals or
 * optional ideas; "Sponsored Post 1/2 (required)" is no longer invented.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { insertEventDeliverables } = require('../../src/services/eventTermsService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

// What an event saved before T1 carries: generated tasks marked required,
// including the retired Sponsored Post slots.
const PRE_T1_SAVED_TASKS = [
  { slot: 'brand_post_1', label: 'Sponsored Post 1', platform: 'instagram', timing: 'during', required: true, completed: false },
  { slot: 'brand_post_2', label: 'Sponsored Post 2', platform: 'tiktok', timing: 'during', required: true, completed: false },
  { slot: 'brand_stories', label: 'Brand Stories', platform: 'instagram', timing: 'during', required: true, completed: false },
  { slot: 'teaser', label: 'Brand Teaser', platform: 'instagram', timing: 'before', required: false, completed: false },
];

(shouldSkip ? describe.skip : describe)('Start Episode: required social tasks come only from deliverables (T1)', () => {
  const shows = [];

  async function seedEvent({ savedTasks = null } = {}) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `T1 show ${ids.show.slice(0, 8)}`, slug: `t1-${ids.show.slice(0, 8)}` });
    const cc = savedTasks ? JSON.stringify({ automation: { social_tasks: savedTasks } }) : null;
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Launch', 'brand_deal', :cc, 'ready', NOW(), NOW())`, { ...ids, cc });
    return ids;
  }

  async function startEpisode(ids) {
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const result = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    const [todo] = await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep: result.episode.id });
    const tasks = typeof todo.social_tasks === 'string' ? JSON.parse(todo.social_tasks) : todo.social_tasks;
    return tasks;
  }

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show })
        .catch((err) => console.warn('cleanup event_deliverables:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('an event with no deliverables gets no required tasks', async () => {
    const tasks = await startEpisode(await seedEvent());

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.filter((t) => t.required)).toEqual([]);
    expect(tasks.map((t) => t.slot)).not.toEqual(expect.arrayContaining(['brand_post_1']));
    expect(tasks.map((t) => t.slot)).not.toEqual(expect.arrayContaining(['brand_post_2']));
    for (const t of tasks) expect(['goal', 'optional']).toContain(t.task_source);
  });

  it("a pre-T1 saved list loses its invented required tasks and its Sponsored Posts", async () => {
    const tasks = await startEpisode(await seedEvent({ savedTasks: PRE_T1_SAVED_TASKS }));

    expect(tasks.filter((t) => t.required)).toEqual([]);
    expect(tasks.map((t) => [t.slot, t.task_source])).toEqual([
      ['brand_stories', 'goal'],
      ['teaser', 'optional'],
    ]);
  });

  it('an event with a real deliverable gets exactly that task required', async () => {
    const ids = await seedEvent({ savedTasks: PRE_T1_SAVED_TASKS });
    await insertEventDeliverables(sequelize, ids.event, [
      { description: 'One Instagram reel wearing the Maison Rue coat', deliverable_type: 'instagram_reel', due_date: 'launch night', required: true },
    ]);
    const [row] = await q(`SELECT id FROM event_deliverables WHERE event_id = :event`, ids);

    const tasks = await startEpisode(ids);

    const required = tasks.filter((t) => t.required);
    expect(required).toHaveLength(1);
    expect(required[0]).toMatchObject({
      deliverable_id: row.id,
      task_source: 'deliverable',
      label: 'One Instagram reel wearing the Maison Rue coat',
      description: 'instagram_reel · due launch night',
    });
  });
});
