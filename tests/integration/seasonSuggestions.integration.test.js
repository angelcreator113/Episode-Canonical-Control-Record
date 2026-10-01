/**
 * Season Arc build PR 6 (Evoni's rulings and answers, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff)):
 *   A4. "The next slot's intention, with Lala's current state (balance,
 *       goals, narrative debt, recent formats, people and places), drives
 *       next-event suggestions and avoids repetition. The Event Package shows
 *       a small read-only Season Context block (season, phase, slot,
 *       purpose)."
 *   Q8. "A repeat is the same format, host/brand or venue within the last 3
 *       episodes; it warns, never blocks."
 * On the test database, through next-suggestions and the season event route.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const { seedArc } = require('../../src/services/arcProgressionService');
const { estimatePressure, pressureFit, repeatsOf } = require('../../src/services/seasonSuggestionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Suggestions and the Event Package read the season (§8(ff) A4, Q8, PR 6)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow({ season = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Suggest ${show.slice(0, 8)}`, slug: `suggest-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const arcId = season ? (await seedArc(show, models)).arc_id : null;
    return { show, arcId };
  }
  async function event(show, fields) {
    const id = uuid();
    const f = { status: 'draft', prestige: 5, strictness: 5, cost_coins: 0, is_paid: false, payment_amount: 0, format: null, host: null, host_brand: null, venue_name: null, usedIn: null, ...fields };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, is_paid, payment_amount,
                 format, host, host_brand, venue_name, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, :prestige, :strictness, :cost_coins, :is_paid, :payment_amount,
                 :format, :host, :host_brand, :venue_name, :usedIn, NOW(), NOW())`, { id, show, ...f });
    return id;
  }
  async function episode(show, title, n) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', NOW(), NOW())`, { id, show, title, n });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const suggestions = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/events/next-suggestions`))).body.data;

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-suggest', email: 'user@season-suggest.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  afterAll(async () => {
    for (const show of shows) {
      for (const table of ['season_slots', 'show_arcs', 'character_state', 'career_goals', 'financial_transactions']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('estimatePressure and pressureFit (Q7 scale)', () => {
    const state = { reputation: 3, coins: 1000 };
    expect(estimatePressure({ prestige: 3, strictness: 5, cost_coins: 0 }, state)).toBe('Low');
    expect(estimatePressure({ prestige: 5, strictness: 5, cost_coins: 0 }, state)).toBe('Medium');
    expect(estimatePressure({ prestige: 7, strictness: 8, cost_coins: 0 }, state)).toBe('High');
    expect(estimatePressure({ prestige: 9, strictness: 8, cost_coins: 900 }, state)).toBe('Peak');
    expect(pressureFit('High', 'High').score).toBe(12);
    expect(pressureFit('Medium', 'High').score).toBe(4);
    expect(pressureFit('Low', 'Peak')).toEqual({ score: 0, reason: { kind: 'warn', text: 'Pressure Low, planned Peak' } });
    expect(pressureFit('Low', null)).toBeNull();
  });

  test('repeatsOf (Q8): format, host or brand, venue', () => {
    const recent = [{ label: 'S1 · E2', format: 'gala', host: null, host_brand: 'Maison Belle', venue_name: 'The Glasshouse' }];
    expect(repeatsOf({ format: 'gala', host_brand: 'maison belle', venue_name: 'the glasshouse ' }, recent).map((r) => r.kind))
      .toEqual(['format', 'host', 'venue']);
    expect(repeatsOf({ format: 'brunch', host: 'Someone else', venue_name: 'Elsewhere' }, recent)).toEqual([]);
  });

  test('the next slot\'s intention and goals drive the ranking; a repeat warns and never blocks', async () => {
    const { show, arcId } = await seedShow();
    // Slot 1 is done with a gala by Maison Belle at The Glasshouse.
    const ep1 = await episode(show, 'One', 1);
    await event(show, { name: 'Past gala', status: 'used', format: 'gala', host_brand: 'Maison Belle', venue_name: 'The Glasshouse', usedIn: ep1 });
    await run('UPDATE season_slots SET episode_id = :ep1, locked_at = NOW() WHERE arc_id = :arcId AND slot_number = 1', { ep1, arcId });
    // Slot 2's intention: high pressure, about money.
    await run(`UPDATE season_slots SET story_purpose = 'Lala needs a paycheck', career_focus = 'coins', desired_pressure = 'High',
                 intention_source = 'edited' WHERE arc_id = :arcId AND slot_number = 2`, { arcId });
    await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, current_value, target_value, starting_value, status, created_at, updated_at)
               VALUES (:id, :show, 'Save 5,000 coins', 'primary', 'coins', 1000, 5000, 0, 'active', NOW(), NOW())`, { id: uuid(), show });
    const fits = await event(show, { name: 'Paid runway', prestige: 6, strictness: 8, is_paid: true, payment_amount: 400, format: 'runway' });
    const repeat = await event(show, { name: 'Another gala', prestige: 3, format: 'gala', host_brand: 'Maison Belle', venue_name: 'The Glasshouse' });

    const data = await suggestions(show);

    expect(data.season.next_slot).toEqual(expect.objectContaining({ label: 'S1 · E2', story_purpose: 'Lala needs a paycheck', desired_pressure: 'High' }));
    const byId = Object.fromEntries(data.suggestions.map((s) => [s.event.id, s]));
    const fitTexts = byId[fits].reasons.map((r) => r.text);
    expect(byId[fits].estimated_pressure).toBe('High');
    expect(fitTexts).toEqual(expect.arrayContaining(['Fits the planned pressure (High)', 'Serves the slot\'s focus: coins', 'Moves a goal: Save 5,000 coins']));
    const warns = byId[repeat].reasons.filter((r) => r.kind === 'warn').map((r) => r.text);
    expect(warns).toEqual(expect.arrayContaining([
      'Repeats the format "gala" (S1 · E1)', 'Repeats Maison Belle (S1 · E1)', 'Repeats the venue The Glasshouse (S1 · E1)',
    ]));
    expect(byId[repeat].repeats).toEqual(['format', 'host', 'venue']);
    expect(byId[repeat].reasons.some((r) => r.kind === 'block')).toBe(false); // warns, never blocks
    expect(data.suggestions[0].event.id).toBe(fits);
  });

  test('a show with no season still gets suggestions', async () => {
    const { show } = await seedShow({ season: false });
    await event(show, { name: 'Anything' });

    const data = await suggestions(show);

    expect(data.season.next_slot).toBeNull();
    expect(data.suggestions).toHaveLength(1);
  });

  test('the Event Package\'s Season Context: pencilled, through its episode, or not on the roadmap', async () => {
    const { show, arcId } = await seedShow();
    await run(`UPDATE season_slots SET story_purpose = 'Win the room' WHERE arc_id = :arcId AND slot_number = 3`, { arcId });
    const pencilled = await event(show, { name: 'Pencilled' });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 3)}/event`)).send({ event_id: pencilled });
    const ep = await episode(show, 'Started', 1);
    const started = await event(show, { name: 'Started', status: 'used', usedIn: ep });
    await run('UPDATE season_slots SET episode_id = :ep, locked_at = NOW() WHERE arc_id = :arcId AND slot_number = 1', { ep, arcId });
    const loose = await event(show, { name: 'Loose' });
    const ctx = async (id) => (await auth(request(app).get(`/api/v1/world/${show}/season/event/${id}`))).body.context;

    expect(await ctx(pencilled)).toEqual(expect.objectContaining({
      in_slot: true, via: 'pencilled', label: 'S1 · E3', season_number: 1, story_purpose: 'Win the room',
      phase: { number: 1, title: 'Foundation' },
    }));
    expect(await ctx(started)).toEqual(expect.objectContaining({ in_slot: true, via: 'episode', label: 'S1 · E1' }));
    expect(await ctx(loose)).toEqual(expect.objectContaining({ in_slot: false, next_open: { label: 'S1 · E2', phase: { number: 1, title: 'Foundation' } } }));

    const { show: noSeason } = await seedShow({ season: false });
    const none = await auth(request(app).get(`/api/v1/world/${noSeason}/season/event/${loose}`));
    expect(none.body.context).toBeNull();
  });
});
