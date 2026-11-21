/**
 * Tick it, twice at once (Script tab audit 6, 2026-10-24): POST
 * /episodes/:id/todo/complete/:slot read social_tasks, changed one task and
 * wrote the list back, so two ticks at once each wrote their own copy and
 * one was lost. The read now locks the row in the write's transaction. On
 * the test database.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { enforcing, readOnlyTokens, expectWriteRefused } = require('../helpers/writeGuard');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const TAG = uuid().slice(0, 8);
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
// The refusal tests need the ADMIN write guard enforcing; with it off they are skipped.
const guardTest = enforcing() ? test : test.skip;
const SLOTS = ['relationship_guest', 'relationship_brand', 'relationship_host', 'follow_up_a', 'follow_up_b'];

(shouldSkip ? describe.skip : describe)('Tick it, at once', () => {
  const show = uuid();
  const ep = uuid();
  // Production writes are an ADMIN's (Evoni, 2026-11-15); an editor and a viewer are refused them (the last test here).
  let token;
  const readOnly = readOnlyTokens('tick');
  const tick = (slot, completed = true) => request(app).post(`/api/v1/episodes/${ep}/todo/complete/${slot}`)
    .set('Authorization', `Bearer ${token}`).send({ completed, source: 'script', beat: 11 });
  const tasks = async () => {
    const [[row]] = await run('SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep', { ep });
    return row.social_tasks;
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-tick', email: 'admin@tick.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Tick ${TAG}`, slug: `tick-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'The Gala', 3, 'draft', NOW(), NOW())`, { ep, show });
    const social = SLOTS.map((slot) => ({ slot, label: `Goal ${slot}`, task_source: 'goal', completed: false }));
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, social_tasks, status, created_at, updated_at)
      VALUES (:id, :ep, :show, CAST('[]' AS jsonb), CAST(:social AS jsonb), 'draft', NOW(), NOW())`, { id: uuid(), ep, show, social: JSON.stringify(social) });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM episode_todo_lists WHERE episode_id = :ep', { ep });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  test('every tick sent at once stays ticked', async () => {
    const res = await Promise.all(SLOTS.map((slot) => tick(slot)));
    expect(res.map((r) => r.status)).toEqual(SLOTS.map(() => 200));
    const after = await tasks();
    expect(after.filter((t) => t.completed).map((t) => t.slot).sort()).toEqual([...SLOTS].sort());
    expect(after.every((t) => t.completed_source === 'script' && t.completed_beat === 11)).toBe(true);
  });

  test('Untick (completed: false) opens one again and leaves the rest', async () => {
    const res = await tick('relationship_brand', false);
    expect(res.status).toBe(200);
    const after = await tasks();
    expect(after.find((t) => t.slot === 'relationship_brand')).toEqual({ slot: 'relationship_brand', label: 'Goal relationship_brand', task_source: 'goal', completed: false });
    expect(after.filter((t) => t.completed)).toHaveLength(SLOTS.length - 1);
  });

  guardTest('signed out, a viewer and an editor cannot tick or untick: the list is as it was', async () => {
    const state = async () => JSON.stringify((await run('SELECT social_tasks, tasks, status, updated_at FROM episode_todo_lists WHERE episode_id = :ep', { ep }))[0]);
    const before = await state();
    const url = (slot) => `/api/v1/episodes/${ep}/todo/complete/${slot}`;
    await expectWriteRefused(() => request(app).post(url('relationship_brand')).send({ completed: true, source: 'script', beat: 11 }), readOnly);
    await expectWriteRefused(() => request(app).post(url('relationship_guest')).send({ completed: false, source: 'script', beat: 11 }), readOnly);
    expect(await state()).toBe(before);
    expect((await tasks()).filter((t) => t.completed)).toHaveLength(SLOTS.length - 1);
  });
});
