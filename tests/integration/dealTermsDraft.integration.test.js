/**
 * The whole Terms section, drafted (ruling D13, Evoni 2026-09-30; answers
 * 1-13; docs/DEAL_COMPONENTS_DESIGN.md §4, §9). Build PR 5.
 *
 * Through the real event PUT, Propose terms and Start Episode on the
 * migrated database:
 *   - ticking components drafts deliverables, prices, the entry line, the
 *     suggested bonus and the relationship goals in one step;
 *   - changing them re-drafts only what is still Auto-drafted (answer 13):
 *     an edited row stays, a deleted one is not drafted again;
 *   - travel and accommodation only when Lala travels (answer 7);
 *   - Start Episode writes the relationship goals as Lala's goals, counted
 *     in T9's limit (answer 6).
 * S3 and the AI client are mocked.
 */
jest.unmock('uuid');

const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input) => input),
}));
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { goalTaskScale } = require('../../src/utils/goalTasks');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('D13: the whole Terms section, drafted', () => {
  let token;
  const shows = [];
  const locations = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-d13', email: 'test@d13.dev', name: 'D13 Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockRejectedValue(new Error('no AI in this test'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      for (const t of ['assets', 'episode_briefs', 'scene_plans', 'episode_todo_lists', 'episode_spending_lines']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.error(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
    for (const id of locations.reverse()) {
      await run('DELETE FROM world_locations WHERE id = :id', { id }).catch((err) => console.error('cleanup world_locations:', err.message));
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  // Tier 2 (Rising), cost_coins 100, a host and a brand.
  async function seed({ category = null, costCoins = 100, cc = null } = {}) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `D13 ${ids.show.slice(0, 8)}`, slug: `d13-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, career_tier, cost_coins, host, host_brand,
                 prestige, category, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', 2, :costCoins, 'Celeste Rue', 'Velour',
                 3, :category, :cc, 'ready', NOW(), NOW())`,
    { ...ids, costCoins, category, cc: cc ? JSON.stringify(cc) : null });
    return ids;
  }

  const putEvent = (ids, body) => auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}`)).send(body);
  const row = (ids) => q('SELECT * FROM world_events WHERE id = :event', ids).then((r) => r[0]);
  const deliverables = (ids) => q(
    `SELECT id, deliverable_type, quantity, required, fee FROM event_deliverables
      WHERE event_id = :event AND deleted_at IS NULL ORDER BY created_at, id`, ids);
  const costs = (ids) => q(
    `SELECT id, kind, amount, paid_by FROM event_costs WHERE event_id = :event AND deleted_at IS NULL ORDER BY created_at, id`, ids);
  const automationOf = async (ids) => asJson((await row(ids)).canon_consequences).automation;

  it('ticking components drafts the whole Terms section in one step', async () => {
    const ids = await seed();
    expect((await putEvent(ids, { deal_components: ['partnership_base', 'paid_for_content'] })).status).toBe(200);

    // Deliverables: the partnership package at tier 2 (Reel + Stories x3), priced.
    const rows = await deliverables(ids);
    expect(rows.map((d) => [d.deliverable_type, d.quantity, d.required])).toEqual([
      ['instagram_reel', 1, true], ['instagram_stories', 3, true],
    ]);
    expect(rows.every((d) => d.fee > 0)).toBe(true);
    // The partnership base, priced from the card.
    const event = await row(ids);
    expect(event.partnership_base_fee).toBe(500);
    // No entry line on a cash deal without entry covered (answer 3).
    expect(await costs(ids)).toEqual([]);
    // The suggested bonus: slay 20%, pass 10% of the cash total, to the nearest 5.
    const cash = 500 + rows.reduce((s, d) => s + d.fee, 0);
    const round5 = (n) => Math.round(n / 5) * 5;
    expect(asJson(event.bonus_terms)).toEqual({ slay: round5(cash * 0.2), pass: round5(cash * 0.1) });
    // At most 2 relationship goals, recorded as drafted.
    const automation = await automationOf(ids);
    expect(automation.relationship_goals.map((g) => g.slot)).toEqual(['relationship_host', 'relationship_brand']);
    expect(automation.auto_drafted).toMatchObject({
      deliverables: 'deal', partnership_base_fee: 'pricing', bonus_terms: 'deal', relationship_goals: 'deal',
    });
  });

  it('changing components re-drafts only what is still Auto-drafted (answer 13)', async () => {
    const ids = await seed();
    await putEvent(ids, { deal_components: ['paid_for_content'] });
    const [reel, stories] = await deliverables(ids);
    expect(reel.deliverable_type).toBe('instagram_reel');
    expect(stories).toBeUndefined(); // tier 2 paid content: a Reel only

    // Evoni edits the Reel's fee; a bonus she sets by hand.
    await auth(request(app).put(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${reel.id}`)).send({ fee: 999 });
    // Now a partnership: the edited Reel stays; the Stories are drafted.
    await putEvent(ids, { deal_components: ['paid_for_content', 'partnership_base'] });
    let rows = await deliverables(ids);
    expect(rows.map((d) => [d.deliverable_type, d.fee])).toEqual([['instagram_reel', 999], ['instagram_stories', expect.any(Number)]]);

    // Evoni deletes the drafted Stories; going back to paid content and
    // forward again never re-adds them.
    const drafted = rows[1];
    await auth(request(app).delete(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${drafted.id}`));
    await putEvent(ids, { deal_components: ['paid_for_content'] });
    await putEvent(ids, { deal_components: ['paid_for_content', 'partnership_base'] });
    rows = await deliverables(ids);
    expect(rows.map((d) => d.deliverable_type)).toEqual(['instagram_reel']);

    // The bonus follows the components while Auto-drafted, and goes when no
    // component calls for one.
    expect(asJson((await row(ids)).bonus_terms)).not.toBeNull();
    await putEvent(ids, { deal_components: ['paid_for_content'] });
    expect((await row(ids)).bonus_terms).toBeNull();
    // A bonus Evoni sets stays.
    await putEvent(ids, { bonus_terms: { slay: 50 } });
    await putEvent(ids, { deal_components: ['paid_for_content', 'performance_fee'] });
    expect(asJson((await row(ids)).bonus_terms)).toEqual({ slay: 50 });
  });

  it('the entry line follows the components while Auto-drafted (answers 1 and 3)', async () => {
    const ids = await seed();
    await putEvent(ids, { deal_components: [] });
    expect((await costs(ids)).map((c) => [c.kind, c.amount, c.paid_by])).toEqual([['entry', 100, 'lala']]);
    await putEvent(ids, { deal_components: ['gifted_items', 'entry_covered'] });
    expect((await costs(ids)).map((c) => [c.kind, c.paid_by])).toEqual([['entry', 'host']]);
    await putEvent(ids, { deal_components: ['paid_to_appear'] });
    expect(await costs(ids)).toEqual([]);
  });

  it('travel and accommodation only outside Lala\'s home city, with no amount (the travel ruling)', async () => {
    // Lala's home: the show setting the migration writes (Los Angeles).
    const home = await seed();
    await run(`UPDATE shows SET metadata = :m WHERE id = :show`,
      { show: home.show, m: JSON.stringify({ lala_home: { address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' } }) });
    const la = uuid(); const venueLa = uuid(); const paris = uuid();
    locations.push(la, venueLa, paris);
    await run(`INSERT INTO world_locations (id, name, city, created_at, updated_at) VALUES (:la, 'Los Angeles', 'Los Angeles', NOW(), NOW())`, { la });
    await run(`INSERT INTO world_locations (id, name, parent_location_id, created_at, updated_at) VALUES (:id, 'The Glasshouse', :la, NOW(), NOW())`, { id: venueLa, la });
    await run(`INSERT INTO world_locations (id, name, city, created_at, updated_at) VALUES (:id, 'Maison Rue', 'Paris', NOW(), NOW())`, { id: paris });

    // A venue in Los Angeles (its city read from the parent): no travel, even for a travel category.
    await run(`UPDATE world_events SET venue_location_id = :loc, category = 'travel_destination' WHERE id = :event`, { ...home, loc: venueLa });
    await putEvent(home, { deal_components: ['paid_to_appear'] });
    expect(await costs(home)).toEqual([]);

    // A venue in Paris: travel and accommodation, no amount, paid by Lala.
    const away = await seed();
    await run(`UPDATE shows SET metadata = :m WHERE id = :show`,
      { show: away.show, m: JSON.stringify({ lala_home: { city: 'Los Angeles' } }) });
    await run(`UPDATE world_events SET venue_location_id = :loc WHERE id = :event`, { ...away, loc: paris });
    await putEvent(away, { deal_components: ['paid_to_appear'], appearance_fee: 300 });
    const lines = await costs(away);
    expect(lines.map((c) => [c.kind, c.amount, c.paid_by])).toEqual([['travel', null, 'lala'], ['accommodation', null, 'lala']]);

    // Start Episode waits until each is priced or comped.
    const refused = await generateEpisodeFromEvent(await row(away), models, { showId: away.show }).catch((err) => err);
    expect(refused.code).toBe('DEAL_PRICE_REQUIRED');
    expect(refused.message).toMatch(/"Travel", "Accommodation"/);
    const costUrl = (id) => `/api/v1/world/${away.show}/events/${away.event}/costs/${id}`;
    expect((await auth(request(app).put(costUrl(lines[0].id))).send({ amount: 450 })).status).toBe(200);
    expect((await auth(request(app).put(costUrl(lines[1].id))).send({ paid_by: 'brand' })).status).toBe(200);
    const started = await generateEpisodeFromEvent(await row(away), models, { showId: away.show });
    expect(started.episode.id).toBeTruthy();

    // No location and no home: the category fallback.
    const fallback = await seed({ category: 'travel_destination' });
    await putEvent(fallback, { deal_components: ['paid_to_appear'] });
    expect((await costs(fallback)).map((c) => c.kind)).toEqual(['travel', 'accommodation']);
  });

  it('Lala\'s home is a show setting, read and written through the show routes', async () => {
    const ids = await seed();
    const url = `/api/v1/shows/${ids.show}/lala-home`;
    expect((await auth(request(app).get(url))).body.lala_home).toBeNull();
    expect((await auth(request(app).put(url)).send({ address: '246 Olddy Paveway Ln' })).status).toBe(400);
    const saved = await auth(request(app).put(url)).send({ address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' });
    expect(saved.status).toBe(200);
    expect((await auth(request(app).get(url))).body.lala_home).toEqual({ address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' });
    // Other metadata keys survive.
    await run(`UPDATE shows SET metadata = :m WHERE id = :show`, { show: ids.show, m: JSON.stringify({ starting_balance: 900, lala_home: { city: 'Los Angeles' } }) });
    await auth(request(app).put(url)).send({ city: 'Los Angeles', neighbourhood: 'Echo Park' });
    const [show] = await q('SELECT metadata FROM shows WHERE id = :show', ids);
    expect(asJson(show.metadata).starting_balance).toBe(900);
  });

  it('Propose terms re-prices every line and keeps the rest of the draft', async () => {
    const ids = await seed();
    await putEvent(ids, { deal_components: ['paid_to_appear', 'paid_for_content'] });
    await putEvent(ids, { appearance_fee: 1 });
    const res = await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send({});
    expect(res.status).toBe(200);
    expect((await row(ids)).appearance_fee).toBe(res.body.proposal.components.appearance.fee);
    expect(res.body.deliverables.map((d) => d.deliverable_type)).toEqual(['instagram_reel']);
  });

  it('Start Episode writes the relationship goals as Lala\'s goals, within T9\'s count (answer 6)', async () => {
    const ids = await seed();
    await putEvent(ids, { deal_components: ['paid_to_appear'], appearance_fee: 300 });
    const event = await row(ids);
    const result = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    const [todo] = await q('SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep', { ep: result.episode.id });
    const tasks = asJson(todo.social_tasks);
    const goals = tasks.filter((t) => !t.deliverable_id);
    const relationship = goals.filter((t) => String(t.slot).startsWith('relationship_'));
    expect(relationship.map((t) => t.label)).toEqual(['Follow up with Celeste Rue after the event', 'Co-style a moment with Velour']);
    expect(relationship.every((t) => t.task_source === 'goal' && t.required === false)).toBe(true);
    // Start Episode writes the minimum, and the relationship goals count in it.
    expect(goals.length).toBe(goalTaskScale(event).min);
  });
});
