/**
 * Goals line up with the events that move them (Evoni, 2026-10-25: "a, b
 * and c, with pinning, show me first"), on the test database:
 *   GET    /api/v1/world/:showId/season/goal-coverage[?event_id=]
 *   GET    /api/v1/world/:showId/season/goals/:goalId/events
 *   PUT    /api/v1/world/:showId/season/events/:eventId/goals/:goalId/pin
 *   DELETE /api/v1/world/:showId/season/events/:eventId/goals/:goalId/pin
 * Pins live in world_events.canon_consequences.pinned_goal_ids; every other
 * key is kept, and the Event Package's save never overwrites them. The pencil
 * ranking and the placement preview prefer an event that covers a goal no
 * event in the slot's part moves.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Season goal coverage and pinning (Evoni, 2026-10-25)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Goals ${show.slice(0, 8)}`, slug: `goals-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 2, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function goal(show, fields) {
    const id = uuid();
    const f = { type: 'secondary', current_value: 0, episode_range: null, ...fields };
    await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, current_value, target_value, starting_value, episode_range, status, created_at, updated_at)
               VALUES (:id, :show, :title, :type, :metric, :current_value, :target, 0, CAST(:episode_range AS jsonb), 'active', NOW(), NOW())`,
      { id, show, ...f, episode_range: f.episode_range ? JSON.stringify(f.episode_range) : null });
    return id;
  }
  async function event(show, fields) {
    const id = uuid();
    const f = { prestige: 3, is_paid: false, payment_amount: 0, rewards: {}, canon: {}, ...fields };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, is_paid, payment_amount,
                 rewards, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'draft', :prestige, 5, 0, :is_paid, :payment_amount,
                 CAST(:rewards AS jsonb), CAST(:canon AS jsonb), NOW(), NOW())`,
      { id, show, ...f, rewards: JSON.stringify(f.rewards), canon: JSON.stringify(f.canon) });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const pencil = async (show, arcId, n, eventId) => {
    const res = await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, n)}/event`)).send({ event_id: eventId });
    expect(res.status).toBe(200);
  };
  const coverage = async (show, q = '') => {
    const res = await auth(request(app).get(`/api/v1/world/${show}/season/goal-coverage${q}`));
    expect(res.status).toBe(200);
    return res.body;
  };
  const pinPath = (show, ev, g) => `/api/v1/world/${show}/season/events/${ev}/goals/${g}/pin`;
  const canonOf = async (id) => (await rows('SELECT canon_consequences, updated_at FROM world_events WHERE id = :id', { id }))[0];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-goal-coverage', email: 'user@goal-coverage.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  afterAll(async () => {
    for (const show of shows) {
      for (const table of ['season_slots', 'show_arcs', 'character_state', 'career_goals']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup', table, err.message));
      }
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('movers, projection and part gaps; pin and unpin keep every other key; the event page\'s save cannot drop a pin', async () => {
    const { show, arcId } = await seedShow();
    const coins = await goal(show, { title: 'Save 3,000 coins', type: 'primary', metric: 'coins', current_value: 600, target: 3000 });
    const trust = await goal(show, { title: 'Earn brand trust', metric: 'brand_trust', current_value: 2, target: 6 });
    const paid = await event(show, { name: 'Paid runway', is_paid: true, payment_amount: 2400 });
    const dinner = await event(show, {
      name: 'Studio visit',
      canon: { automation: { venue_name: 'Atelier', social_tasks: [{ id: 't1' }] }, documents: [{ type: 'brief' }], invitation_text: 'Come by' },
    });
    await pencil(show, arcId, 3, paid);
    await pencil(show, arcId, 11, dinner);

    let body = await coverage(show);
    const byId = (b) => Object.fromEntries(b.goals.map((g) => [g.id, g]));
    expect(body.season).toEqual(expect.objectContaining({ season_number: 1 }));
    expect(byId(body)[coins].movers.map((m) => [m.code, m.name, m.via])).toEqual([['E3', 'Paid runway', 'fit']]);
    expect(byId(body)[coins].projection).toEqual(expect.objectContaining({ current: 600, gain: 2400, projected: 3000, target: 3000, on_track: true }));
    expect(byId(body)[trust].movers).toEqual([]);
    expect(body.parts.map((p) => [p.phase, p.gaps.map((g) => g.goal_id)])).toEqual([[1, [trust]], [2, [coins, trust]], [3, [coins, trust]]]);

    // Pin brand trust to the studio visit (E11).
    const before = await canonOf(dinner);
    const pinned = await auth(request(app).put(pinPath(show, dinner, trust)));
    expect(pinned.status).toBe(200);
    expect(pinned.body).toEqual(expect.objectContaining({ success: true, pinned: true, pinned_goal_ids: [trust] }));
    // Pinning twice keeps one.
    expect((await auth(request(app).put(pinPath(show, dinner, trust)))).body.pinned_goal_ids).toEqual([trust]);
    const after = await canonOf(dinner);
    expect(after.canon_consequences).toEqual({ ...before.canon_consequences, pinned_goal_ids: [trust] });
    // The event's save version is unchanged, so an open Event Package can still save.
    expect(new Date(after.updated_at).getTime()).toBe(new Date(before.updated_at).getTime());

    body = await coverage(show, `?event_id=${dinner}`);
    expect(byId(body)[trust].movers).toEqual([expect.objectContaining({ code: 'E11', via: 'pinned', pinned: true })]);
    expect(body.parts.find((p) => p.phase === 2).gaps.map((g) => g.goal_id)).toEqual([coins]);
    expect(body.slots.find((s) => s.slot_number === 11).goals).toEqual([expect.objectContaining({ goal_id: trust, title: 'Earn brand trust', via: 'pinned' })]);
    expect(body.event).toEqual(expect.objectContaining({ id: dinner, pinned_goal_ids: [trust], slot: expect.objectContaining({ code: 'E11' }) }));
    expect(body.event.moves.map((g) => g.goal_id)).toEqual([trust]);

    // The Event Package's save sends an older canon_consequences: the pin stays.
    const put = await auth(request(app).put(`/api/v1/world/${show}/events/${dinner}`))
      .send({ canon_consequences: { ...before.canon_consequences, pinned_goal_ids: [], invitation_text: 'Come by at six' } });
    expect(put.status).toBe(200);
    const saved = (await canonOf(dinner)).canon_consequences;
    expect(saved.pinned_goal_ids).toEqual([trust]);
    expect(saved.invitation_text).toBe('Come by at six');
    expect(saved.automation).toEqual(before.canon_consequences.automation);

    // Unpin: only the id goes.
    const unpinned = await auth(request(app).delete(pinPath(show, dinner, trust)));
    expect(unpinned.status).toBe(200);
    expect(unpinned.body).toEqual(expect.objectContaining({ pinned: false, pinned_goal_ids: [] }));
    const cleared = (await canonOf(dinner)).canon_consequences;
    expect(cleared).toEqual({ ...saved, pinned_goal_ids: [] });
    expect(byId(await coverage(show))[trust].movers).toEqual([]);
  });

  test('a pin works on an event with no canon_consequences at all', async () => {
    const { show } = await seedShow();
    const g = await goal(show, { title: 'Keep stress low', metric: 'stress', current_value: 4, target: 2 });
    const id = await event(show, { name: 'Spa day' });
    await run('UPDATE world_events SET canon_consequences = NULL WHERE id = :id', { id });
    const res = await auth(request(app).put(pinPath(show, id, g)));
    expect(res.status).toBe(200);
    expect((await canonOf(id)).canon_consequences).toEqual({ pinned_goal_ids: [g] });
  });

  test('Find events: movers first (pinned, then by reward), placed or not, each with its slot and why', async () => {
    const { show, arcId } = await seedShow();
    const trust = await goal(show, { title: 'Earn brand trust', metric: 'brand_trust', current_value: 2, target: 6 });
    const small = await event(show, { name: 'Small reward', rewards: { brand_trust: 1 } });
    await event(show, { name: 'Big reward', rewards: { brand_trust: 3 } });
    const none = await event(show, { name: 'Nothing here' });
    const pinnedOne = await event(show, { name: 'Pinned one' });
    await pencil(show, arcId, 4, small);
    await auth(request(app).put(pinPath(show, pinnedOne, trust)));

    const res = await auth(request(app).get(`/api/v1/world/${show}/season/goals/${trust}/events`));
    expect(res.status).toBe(200);
    expect(res.body.goal).toEqual(expect.objectContaining({ id: trust, title: 'Earn brand trust' }));
    expect(res.body.events.map((e) => [e.name, e.via])).toEqual([
      ['Pinned one', 'pinned'], ['Big reward', 'fit'], ['Small reward', 'fit'], ['Nothing here', null],
    ]);
    const byName = Object.fromEntries(res.body.events.map((e) => [e.name, e]));
    expect(byName['Small reward'].slot).toEqual(expect.objectContaining({ code: 'E4' }));
    expect(byName['Big reward'].slot).toBeNull();
    expect(byName['Big reward'].reason).toBe('+3 brand trust reward');
    expect(byName['Pinned one'].reason).toBe('Pinned to this goal');
    expect(byName['Nothing here'].id).toBe(none);
  });

  test('the pencil ranking and the placement preview prefer an event that covers an uncovered goal', async () => {
    const { show, arcId } = await seedShow();
    await goal(show, { title: 'Save coins', metric: 'coins', target: 5000 });
    const trust = await goal(show, { title: 'Earn brand trust', metric: 'brand_trust', current_value: 2, target: 6 });
    // Part 1 already has a paid event; brand trust is uncovered.
    await pencil(show, arcId, 1, await event(show, { name: 'Placed paid', is_paid: true, payment_amount: 300 }));
    const paid = await event(show, { name: 'A paid gig', is_paid: true, payment_amount: 300 });
    const trusty = await event(show, { name: 'B brand dinner', rewards: { brand_trust: 2 } });

    const fit = await auth(request(app).get(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 2)}/event-fit`));
    expect(fit.status).toBe(200);
    expect(fit.body.events[0]).toEqual(expect.objectContaining({ id: trusty, reason: 'Covers a goal nothing in this part moves yet: Earn brand trust' }));
    expect(fit.body.events.find((e) => e.id === paid).score).toBeLessThan(fit.body.events[0].score);

    // Pinning brand trust to the paid gig makes it cover the gap as well.
    await auth(request(app).put(pinPath(show, paid, trust)));
    const fit2 = await auth(request(app).get(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 2)}/event-fit`));
    expect(fit2.body.events.find((e) => e.id === paid).reason).toBe('Covers a goal nothing in this part moves yet: Earn brand trust');
    await auth(request(app).delete(pinPath(show, paid, trust)));

    // The preview fills E2 first: the brand dinner covers the gap; once it is
    // placed, E3 takes the paid gig (no gap left for it to beat).
    const preview = await auth(request(app).get(`/api/v1/world/${show}/season/placement`));
    expect(preview.status).toBe(200);
    const items = preview.body.items.filter((i) => i.kind === 'event');
    expect(items.slice(0, 2).map((i) => [i.slot_number, i.event.id])).toEqual([[2, trusty], [3, paid]]);
    expect(items[0].why).toBe('Undated; Covers a goal nothing in this part moves yet: Earn brand trust');
  });

  test('refusals: another show\'s goal or event is 404, a bad id 400, no sign-in 401', async () => {
    const { show } = await seedShow();
    const { show: other } = await seedShow();
    const g = await goal(show, { title: 'Mine', metric: 'coins', target: 10 });
    const theirs = await goal(other, { title: 'Theirs', metric: 'coins', target: 10 });
    const ev = await event(show, { name: 'Mine' });
    const theirEvent = await event(other, { name: 'Theirs' });
    expect((await auth(request(app).put(pinPath(show, ev, theirs)))).status).toBe(404);
    expect((await auth(request(app).put(pinPath(show, theirEvent, g)))).status).toBe(404);
    expect((await auth(request(app).get(`/api/v1/world/${show}/season/goals/${theirs}/events`))).status).toBe(404);
    expect((await auth(request(app).put(pinPath(show, 'nope', g)))).status).toBe(400);
    expect((await auth(request(app).get(`/api/v1/world/${show}/season/goal-coverage?event_id=nope`))).status).toBe(400);
    expect((await request(app).put(pinPath(show, ev, g))).status).toBe(401);
    expect((await request(app).get(`/api/v1/world/${show}/season/goal-coverage`)).status).toBe(401);
    expect((await canonOf(theirEvent)).canon_consequences).toEqual({});
  });

  test('a show with no season answers with no goals and no parts', async () => {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'No season', :slug, NOW(), NOW())`, { show, slug: `nos-${show.slice(0, 8)}` });
    const body = await coverage(show);
    expect(body).toEqual(expect.objectContaining({ season: null, goals: [], parts: [], slots: [], event: null }));
  });
});
