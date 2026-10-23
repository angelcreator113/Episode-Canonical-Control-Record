/**
 * Episode 1 feeds Episode 2 (Evoni, 2026-10-23; services/storyCarryForward):
 * Episode 1's saved What changed card (a love interest, a thread, a
 * follow-up) reaches Episode 2's script writers; the follow-up joins
 * Episode 2's to-do list as a carried goal; ticking it there (the to-do
 * route, or Episode 2's own Save) marks the follow-up done in Episode 2,
 * and unticking it opens it again.
 *
 * The database is the local migrated test DB; no AI call is made.
 */
jest.unmock('uuid');
jest.mock('../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const models = require('../../src/models');
const { carryForEpisode, carriedGoalTasks, openFollowUps } = require('../../src/services/storyCarryForward');
const { approveRecord } = require('../../src/services/episodeStoryRecord');
const { loadScriptContext, storyContextBlocks } = require('../../src/services/episodeScriptWriterService');
const todoRoutes = require('../../src/routes/todoListRoutes');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Episode 1 feeds Episode 2', () => {
  const ids = { show: crypto.randomUUID(), ep1: crypto.randomUUID(), ep2: crypto.randomUUID(), todo: crypto.randomUUID() };
  const app = express();
  app.use(express.json());
  app.use('/api/v1', todoRoutes);
  let followUpId;

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show: ids.show, name: `Carry ${ids.show.slice(0, 8)}`, slug: `carry-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at) VALUES
               (:ep1, :show, 'Studio Night', 1, 'draft', 'LALA: Send me the lookbook.', NOW(), NOW()),
               (:ep2, :show, 'The Lookbook', 2, 'draft', :script, NOW(), NOW())`,
    { ...ids, script: '## BEAT: 3 · The Call\nLALA: Time to follow up with Studio Bystable about the collab.' });
    // Episode 1's card, ready to Save.
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, relationships, threads, follow_ups, created_at, updated_at)
               VALUES (:ep1, :show, 'draft', 'Lala met Truthville at Studio Bystable''s launch.', CAST(:rels AS jsonb), CAST(:threads AS jsonb), CAST(:follows AS jsonb), NOW(), NOW())`,
    { ...ids,
      rels: JSON.stringify([{ key: 'rel-k1', a: 'x', b: 'y', a_name: 'Lala', b_name: 'Marcus Hale', is_romantic: true, type: 'love_interest', stage_before: 'acquaintances', stage_after: 'flirting', note: 'He asks to see her again', keep: false }]),
      threads: JSON.stringify([{ key: 'th-k1', thread_id: null, title: 'Who sent the second invitation?', note: 'No name on it', action: 'new', keep: true }]),
      follows: JSON.stringify([{ key: 'fu-k1', person: null, name: '', text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode', keep: true }]) });
  });

  afterAll(async () => {
    await run('DELETE FROM episode_story_records WHERE episode_id IN (:ep1, :ep2)', ids);
    await run('DELETE FROM show_follow_ups WHERE show_id = :show', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM episode_todo_lists WHERE id = :todo', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const followUp = async () => (await run('SELECT status, done_episode_id FROM show_follow_ups WHERE id = :id', { id: followUpId }))[0][0];

  it('before Episode 1 is saved, Episode 2 carries nothing', async () => {
    expect(await carryForEpisode(sequelize, ids.ep2)).toBe('');
  });

  it('after Save, Episode 2\'s writers read Episode 1\'s story and what Lala owes', async () => {
    const out = await approveRecord(sequelize, ids.ep1, { by: 'evoni' });
    expect(out.result.written.map((w) => w.kind)).toEqual(['thread', 'follow_up']);
    const [open] = await Promise.all([openFollowUps(sequelize, ids.show, { before: 2 })]);
    expect(open.map((f) => f.text)).toEqual(['Follow up with Studio Bystable about the collab']);
    followUpId = open[0].id;

    const block = await carryForEpisode(sequelize, ids.ep2);
    expect(block).toContain('LAST EPISODE\'S STORY (Episode 1, "Studio Night"; approved)');
    expect(block).toContain('Left open:\n- Who sent the second invitation?: No name on it');
    expect(block).toContain('- Follow up with Studio Bystable about the collab (due: next episode) (from episode 1)');
    // An unticked relationship is not carried.
    expect(block).not.toContain('Marcus Hale');
    // Episode 1 itself carries nothing from before it.
    expect(await carryForEpisode(sequelize, ids.ep1)).toBe('');

    const context = await loadScriptContext(ids.ep2, ids.show, models, { lite: true });
    expect(storyContextBlocks(context, { withSeason: false })).toContain('What Lala still owes people:');
  });

  it('Start Episode\'s carried goal is ticked on the to-do list: done in Episode 2; unticked: open again', async () => {
    const tasks = await carriedGoalTasks(sequelize, ids.show, { before: 2 });
    expect(tasks).toEqual([expect.objectContaining({ slot: `follow_up_${followUpId}`, task_source: 'goal', follow_up_id: followUpId })]);
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, social_tasks, created_at, updated_at)
               VALUES (:todo, :ep2, :show, '[]'::jsonb, CAST(:tasks AS jsonb), NOW(), NOW())`, { ...ids, tasks: JSON.stringify(tasks) });

    const ticked = await request(app).post(`/api/v1/episodes/${ids.ep2}/todo/complete/${encodeURIComponent(tasks[0].slot)}`).send({ completed: true, source: 'script', beat: 3 });
    expect(ticked.status).toBe(200);
    expect(await followUp()).toEqual({ status: 'done', done_episode_id: ids.ep2 });
    // Done: no longer carried.
    expect(await carriedGoalTasks(sequelize, ids.show, { before: 3 })).toEqual([]);

    await request(app).post(`/api/v1/episodes/${ids.ep2}/todo/complete/${encodeURIComponent(tasks[0].slot)}`).send({ completed: false });
    expect(await followUp()).toEqual({ status: 'open', done_episode_id: null });
  });

  it('Episode 2\'s own Save ticks the carried goal and settles the follow-up', async () => {
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, goals, created_at, updated_at)
               VALUES (:ep2, :show, 'draft', 'Lala calls Studio Bystable.', CAST(:goals AS jsonb), NOW(), NOW())`,
    { ...ids, goals: JSON.stringify([{ key: 'g-k1', slot: `follow_up_${followUpId}`, label: 'Follow up with Studio Bystable about the collab', covered: true, beat: 3, keep: true }]) });
    const out = await approveRecord(sequelize, ids.ep2, { by: 'evoni' });
    expect(out.goals).toEqual([expect.objectContaining({ slot: `follow_up_${followUpId}`, follow_up_id: followUpId, completed: true, beat: 3 })]);
    expect(out.result.written).toEqual([{ kind: 'goal', text: 'Goal ticked: Follow up with Studio Bystable about the collab (beat 3)' }]);
    expect(await followUp()).toEqual({ status: 'done', done_episode_id: ids.ep2 });
  });
});
