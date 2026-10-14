/**
 * GET /episodes/:id/todo?beat=&line= (Task #3188), against the test
 * database: the Shopping list crossed off from the line each piece of the
 * locked look is put on in the saved script; without a beat, from the look
 * as it is now; a bad beat or line is a 400.
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

(shouldSkip ? describe.skip : describe)('Shopping list as of a beat (Task #3188)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep: uuid() };
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-todo-beat', email: 'ed@todo-beat.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `Todo ${tag}`, slug: `todo-${tag}` });
    const dress = await models.Wardrobe.create({ name: `Crimson Gown ${tag}`, clothing_category: 'dress', show_id: ids.show });
    const shoes = await models.Wardrobe.create({ name: `Satin Pump ${tag}`, clothing_category: 'shoes', show_id: ids.show });
    const bag = await models.Wardrobe.create({ name: `Pearl Clutch ${tag}`, clothing_category: 'clutch', show_id: ids.show });
    ids.dress = dress.id; ids.shoes = shoes.id; ids.bag = bag.id;
    const script = [
      '## BEAT: 7 · Interruption Pulse 2', 'Lala: "A deal?"',
      // A line after the select, so line 2 is not the beat's end (the
      // uncued clutch comes on at its last line).
      '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', `[WEAR: ${dress.id}]`, `[UI:SELECT Item Satin Pump ${tag}]`, 'Lala: "Perfect."',
      '## BEAT: 10 · Location', 'Lala: "Ready."',
    ].join('\n');
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala', 1, 'draft', :script, NOW(), NOW())`, { ...ids, script });
    for (const w of [dress, shoes, bag]) {
      await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
                 VALUES (:id, :ep, :w, 'approved', NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: w.id });
    }
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, status, created_at, updated_at)
               VALUES (:id, :ep, :show, CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
    { id: uuid(), ...ids, tasks: JSON.stringify([
      { slot: 'dress', label: 'The look', required: true, order: 1 },
      { slot: 'shoes', label: 'Heels', required: true, order: 2 },
      { slot: 'purse', label: 'A clutch', required: false, order: 3 },
    ]) });
  });

  afterAll(async () => {
    await run('DELETE FROM episode_todo_lists WHERE episode_id = :ep', ids);
    await run('DELETE FROM episode_wardrobe WHERE episode_id = :ep', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM wardrobe WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const get = (q = '') => request(app).get(`/api/v1/episodes/${ids.ep}/todo${q}`).set('Authorization', `Bearer ${token}`);
  const crossed = (res) => res.body.data.tasks.map((t) => [t.slot, t.completed]);

  test('each line is crossed off from the line its piece is put on; the uncued clutch at the end of the closet beat', async () => {
    expect(crossed(await get('?beat=7'))).toEqual([['dress', false], ['shoes', false], ['purse', false]]);
    expect(crossed(await get('?beat=8&line=1'))).toEqual([['dress', true], ['shoes', false], ['purse', false]]);
    expect(crossed(await get('?beat=8&line=2'))).toEqual([['dress', true], ['shoes', true], ['purse', false]]);
    const end = await get('?beat=8');
    expect(crossed(end)).toEqual([['dress', true], ['shoes', true], ['purse', true]]);
    expect(end.body.data.as_of.uncued.map((p) => p.id)).toEqual([ids.bag]);
  });

  test('without a beat, from the look as it is now; a bad beat or line is refused', async () => {
    const now = await get('');
    expect(now.body.data.as_of).toBeUndefined();
    expect(crossed(now)).toEqual([['dress', true], ['shoes', true], ['purse', true]]);
    expect((await get('?beat=15')).status).toBe(400);
    expect((await get('?beat=8&line=-1')).status).toBe(400);
    expect((await request(app).get(`/api/v1/episodes/${ids.ep}/todo?beat=8`)).status).toBe(401);
  });
});
