/**
 * T6 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2306), Evoni's ruling:
 * "Regenerate starts from the replaced episode's task list as it stands,
 * keeping its edits and completion flags, and adds any required
 * deliverable task the event's accepted terms include that the list lacks.
 * It does not restore deleted goals or ideas or generate new ones; fresh
 * ideas come from the Career Checklist's Regenerate."
 *
 * The generator is called as regenerate-episode calls it, with
 * replacingEpisodeId.
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
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('Regenerate starts from the replaced episode\'s task list (T6)', () => {
  const shows = [];

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

  // An event with three accepted deliverables: two required (reel, toast)
  // and one optional (story), and an episode already started from it.
  async function startEpisode() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `T6 show ${ids.show.slice(0, 8)}`, slug: `t6-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Launch', 'invite', 'ready', NOW(), NOW())`, ids);
    await insertEventDeliverables(sequelize, ids.event, [
      { description: 'One reel in the coat', required: true, owed_to: 'brand' },
      { description: 'Arrive before the toast', required: true, owed_to: 'host' },
      { description: 'A story if the night allows', required: false, owed_to: 'brand' },
    ]);
    const rows = await q(`SELECT id, description FROM event_deliverables WHERE event_id = :event`, ids);
    const idOf = (text) => rows.find((r) => r.description === text).id;
    ids.d = { reel: idOf('One reel in the coat'), toast: idOf('Arrive before the toast'), story: idOf('A story if the night allows') };

    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const first = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    ids.ep1 = first.episode.id;
    return ids;
  }

  const listOf = async (ep) => {
    const [row] = await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep });
    return row ? asJson(row.social_tasks) : null;
  };

  it('keeps the list as it stands and adds only the missing required deliverable', async () => {
    const ids = await startEpisode();
    // Evoni works the list: edits a goal and marks it done, deletes another,
    // removes the required "toast" deliverable task, and adds an idea of her own.
    const original = await listOf(ids.ep1);
    const firstGoal = original.find((t) => t.task_source === 'goal');
    const secondGoal = original.filter((t) => t.task_source === 'goal')[1];
    const worked = original
      .filter((t) => t.slot !== secondGoal.slot && t.deliverable_id !== ids.d.toast)
      .map((t) => (t.slot === firstGoal.slot ? { ...t, label: 'Edited by Evoni', completed: true } : t))
      .concat([{ slot: 'my_idea', label: 'My own idea', task_source: 'optional', required: false, completed: false }]);
    await run(`UPDATE episode_todo_lists SET social_tasks = CAST(:tasks AS jsonb) WHERE episode_id = :ep`,
      { ep: ids.ep1, tasks: JSON.stringify(worked) });

    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const second = await generateEpisodeFromEvent(event, models, { showId: ids.show, replacingEpisodeId: ids.ep1 });
    const regenerated = await listOf(second.episode.id);

    // The worked list, unchanged and in order, then the missing required deliverable.
    expect(regenerated.slice(0, worked.length)).toEqual(worked);
    const added = regenerated.slice(worked.length);
    expect(added.map((t) => [t.deliverable_id, t.required, t.task_source])).toEqual([[ids.d.toast, true, 'host_requirement']]);

    // Not restored: the deleted goal. Nothing new was generated.
    expect(regenerated.some((t) => t.slot === secondGoal.slot)).toBe(false);
    expect(regenerated.find((t) => t.slot === firstGoal.slot)).toMatchObject({ label: 'Edited by Evoni', completed: true });
    expect(regenerated.length).toBe(worked.length + 1);
  });

  it('an optional deliverable missing from the list is not added', async () => {
    const ids = await startEpisode();
    const original = await listOf(ids.ep1);
    const withoutStory = original.filter((t) => t.deliverable_id !== ids.d.story);
    await run(`UPDATE episode_todo_lists SET social_tasks = CAST(:tasks AS jsonb) WHERE episode_id = :ep`,
      { ep: ids.ep1, tasks: JSON.stringify(withoutStory) });

    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const second = await generateEpisodeFromEvent(event, models, { showId: ids.show, replacingEpisodeId: ids.ep1 });
    expect(await listOf(second.episode.id)).toEqual(withoutStory);
  });

  it('with no saved list on the replaced episode, the list is built as before', async () => {
    const ids = await startEpisode();
    await run(`DELETE FROM episode_todo_lists WHERE episode_id = :ep`, { ep: ids.ep1 });

    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const second = await generateEpisodeFromEvent(event, models, { showId: ids.show, replacingEpisodeId: ids.ep1 });
    const rebuilt = await listOf(second.episode.id);
    expect(rebuilt.filter((t) => t.deliverable_id).map((t) => t.deliverable_id).sort())
      .toEqual([ids.d.reel, ids.d.toast, ids.d.story].sort());
    expect(rebuilt.some((t) => t.task_source === 'goal')).toBe(true);
  });
});
