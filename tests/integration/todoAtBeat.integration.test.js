/**
 * GET /episodes/:id/todo/at?beat= (Task #3191), against the test database:
 * the list Lala's phone shows at a beat, and the deal checklist ticked from
 * its [DELIVER] cues. Reading it never moves a deliverable's status.
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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('To-do list at a beat (Task #3191)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep: uuid(), event: uuid(), reel: uuid(), story: uuid() };
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-todo-at', email: 'ed@todo-at.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `TodoAt ${tag}`, slug: `todo-at-${tag}` });
    const script = [
      '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', 'Lala: "This one."',
      '## BEAT: 10 · Location', 'Lala: "Rolling."', `[DELIVER: ${ids.reel}]`,
      '## BEAT: 11 · Arrival', '[TODO_MODE: career]',
    ].join('\n');
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Launch', 1, 'draft', :script, NOW(), NOW())`, { ...ids, script });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, used_in_episode_id, host, host_brand, venue_name, created_at, updated_at)
               VALUES (:event, :show, 'Studio Launch', 'brand_deal', 'used', :ep, 'Sable Reyes', 'STUDIO BY SABLE', 'Studio', NOW(), NOW())`, ids);
    for (const [id, description] of [[ids.reel, 'One reel in the coat'], [ids.story, 'Three stories']]) {
      await run(`INSERT INTO event_deliverables (id, event_id, description, required, owed_to, status, created_at, updated_at)
                 VALUES (:id, :event, :description, true, 'brand', 'pending', NOW(), NOW())`, { id, event: ids.event, description });
    }
  });

  afterAll(async () => {
    await run('DELETE FROM event_deliverables WHERE event_id = :event', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const get = (q2 = '') => request(app).get(`/api/v1/episodes/${ids.ep}/todo/at${q2}`).set('Authorization', `Bearer ${token}`);

  test('Shopping at the closet beat, the deal after it, a beat cue wins; each item ticked at its cue, status untouched', async () => {
    expect((await get('?beat=8')).body.data.mode).toBe('shopping');
    const ten = (await get('?beat=10')).body.data;
    expect(ten.mode).toBe('deal');
    expect(ten.deal.label).toBe("At STUDIO BY SABLE's Studio");
    expect(ten.deal.locked).toBe(true);
    expect(ten.deal.items.map((i) => [i.deliverable_id, i.delivered, i.ready_to_approve])).toEqual([[ids.reel, true, true], [ids.story, false, false]]);
    expect((await get('?beat=11')).body.data).toMatchObject({ mode: 'career', mode_source: 'cue' });
    const rows = await q('SELECT status FROM event_deliverables WHERE event_id = :event', ids);
    expect(rows.map((r) => r.status)).toEqual(['pending', 'pending']);
  });

  test('a bad beat is refused; no token, no list', async () => {
    expect((await get('?beat=0')).status).toBe(400);
    expect((await request(app).get(`/api/v1/episodes/${ids.ep}/todo/at?beat=10`)).status).toBe(401);
  });
});
