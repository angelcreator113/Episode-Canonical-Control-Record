/**
 * My Little List ♡ against Postgres (Evoni, 2026-10-26, Phase 1): the
 * personal_list migration is applied; the list at three points of Episode 1
 * (before the invitation, after the deal, after the outfit and the Reel);
 * her reminder added, ticked, edited and removed with the row locked; the
 * deal's tick refused; a hidden key a 404; social_tasks and the deliverable
 * untouched by any of it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const ep1 = require('../fixtures/myLittleListEpisode1');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('My Little List ♡ (Phase 1)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-mll', email: 'test@mll.dev', name: 'MLL', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM episode_todo_lists WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup todo:', err.message));
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup episode_wardrobe:', err.message));
      await run('DELETE FROM wardrobe WHERE show_id = :show', { show }).catch((err) => console.warn('cleanup wardrobe:', err.message));
      await run('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show }).catch((err) => console.warn('cleanup deliverables:', err.message));
      await run('DELETE FROM opportunities WHERE show_id = :show', { show }).catch((err) => console.warn('cleanup opportunities:', err.message));
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch((err) => console.warn('cleanup events:', err.message));
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), reel: uuid(), dress: uuid(), shoes: uuid(), opp: uuid() };
    shows.push(ids.show);
    // The fixture's script, with this run's ids in its cues.
    const script = ep1.SCRIPT.replace('p-dress', ids.dress).replace('p-shoes', ids.shoes).replace('d-reel', ids.reel).replace('opp-runway', ids.opp);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `MLL show ${ids.show.slice(0, 8)}`, slug: `mll-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Studio Day', 1, 'draft', :script, NOW(), NOW())`, { ...ids, script });
    await run(`INSERT INTO world_events (id, show_id, name, host, host_brand, venue_name, deal_type, deal_components, used_in_episode_id, created_at, updated_at)
               VALUES (:event, :show, :name, :host, :host, :venue, 'brand_partnership', CAST(:components AS jsonb), :ep, NOW(), NOW())`,
      { ...ids, name: ep1.EVENT.name, host: ep1.EVENT.host, venue: ep1.EVENT.venue_name, components: JSON.stringify(['paid_for_content']) });
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, quantity, required, status, episode_id, created_at, updated_at)
               VALUES (:reel, :event, :description, 'pulse_video', 1, true, 'pending', :ep, NOW(), NOW())`, { ...ids, description: ep1.DELIVERABLES[0].description });
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, created_at, updated_at)
               VALUES (:opp, :show, :name, 'brand_deal', 'offered', 'Maison Rue', NOW(), NOW())`, { ...ids, name: ep1.OPPORTUNITIES[0].name });
    await run(`INSERT INTO wardrobe (id, show_id, name, clothing_category, created_at, updated_at)
               VALUES (:dress, :show, 'Silver mesh slip', 'dress', NOW(), NOW()), (:shoes, :show, 'Gold Mara heels', 'shoes', NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
               VALUES (:a, :ep, :dress, 'approved', NOW(), NOW()), (:b, :ep, :shoes, 'approved', NOW(), NOW())`, { ...ids, a: uuid(), b: uuid() });
    const social = ep1.SOCIAL_TASKS.map((t) => (t.deliverable_id ? { ...t, slot: `deliverable_${ids.reel}`, deliverable_id: ids.reel } : t));
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, social_tasks, status, created_at, updated_at)
               VALUES (:id, :ep, :show, CAST(:tasks AS jsonb), CAST(:social AS jsonb), 'generated', NOW(), NOW())`,
      { ...ids, id: uuid(), tasks: JSON.stringify(ep1.WARDROBE_TASKS), social: JSON.stringify(social) });
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const listAt = (ids, beat, line = 0) => auth(request(app).get(`/api/v1/episodes/${ids.ep}/my-little-list?beat=${beat}&line=${line}`));

  it('the migration added personal_list, NOT NULL with {} for existing rows', async () => {
    const [col] = await q(`SELECT is_nullable, column_default FROM information_schema.columns
                            WHERE table_name = 'episode_todo_lists' AND column_name = 'personal_list'`);
    expect(col).toBeTruthy();
    expect(col.is_nullable).toBe('NO');
    expect(col.column_default).toMatch(/'\{\}'::jsonb/);
  });

  it('A / B / C: before the invitation, after the deal, after the outfit and the Reel', async () => {
    const ids = await seed();
    const titles = async (beat, line) => (await listAt(ids, beat, line)).body.items.map((i) => [i.title, i.done]);
    expect(await titles(3)).toEqual([]);
    expect(await titles(5, 3)).toEqual([
      ['Find something to wear', false], ['Meet some interesting people', false], ['Get some good footage', false], ['Look into that video offer', false],
    ]);
    expect(await titles(6, 1)).toContainEqual(['Film my video', false]);
    expect(await titles(12)).toEqual([
      ['Find something to wear', true], ['Meet some interesting people', false], ['Get some good footage', false], ['Film my video', true],
    ]);
    const body = JSON.stringify((await listAt(ids, 12)).body).toLowerCase();
    for (const secret of [ids.reel, ids.event, ids.opp, 'sponsored', 'strategic', 'studio by sable', 'brand_deliverable', 'maison rue']) {
      expect(body).not.toContain(secret.toLowerCase());
    }
  });

  it('her reminder: add, tick, edit, remove; the deal refused; a hidden key 404; social_tasks and the deliverable untouched', async () => {
    const ids = await seed();
    const socialBefore = asJson((await q('SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep', ids))[0].social_tasks);

    const added = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/my-little-list/items`)).send({ title: 'Check my coins' });
    expect(added.status).toBe(201);
    const { key } = added.body;
    const patch = (k, body) => auth(request(app).patch(`/api/v1/episodes/${ids.ep}/my-little-list/items/${k}`)).send(body);
    expect((await patch(key, { done: true, beat: 3 })).status).toBe(200);
    expect((await patch(key, { title: 'Check my coins twice', beat: 3 })).status).toBe(200);
    expect((await listAt(ids, 3)).body.items).toEqual([expect.objectContaining({ key, title: 'Check my coins twice', done: true })]);

    const deal = (await listAt(ids, 12)).body.items.find((i) => i.title === 'Film my video');
    const refused = await patch(deal.key, { done: false, beat: 12 });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('COMPLETION_FROM_GAMEPLAY');
    expect((await patch(deal.key, { done: true, beat: 3 })).status).toBe(404);

    expect((await auth(request(app).delete(`/api/v1/episodes/${ids.ep}/my-little-list/items/${key}?beat=3`))).status).toBe(200);
    expect((await listAt(ids, 3)).body.items).toEqual([]);

    const [row] = await q('SELECT social_tasks, personal_list FROM episode_todo_lists WHERE episode_id = :ep', ids);
    expect(asJson(row.social_tasks)).toEqual(socialBefore);
    expect(asJson(row.personal_list).reminders).toEqual([]);
    const [{ status }] = await q('SELECT status FROM event_deliverables WHERE id = :reel', ids);
    expect(status).toBe('pending');
  });
});
