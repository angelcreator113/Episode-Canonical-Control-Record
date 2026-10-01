/**
 * Fixes from the Terms screen (Evoni, 2026-10-01), each failing before its
 * fix, through the real event PUT on the migrated database:
 *   1. Deal prices use Lala's own career tier, not the event's (her pricing
 *      ruling, EVENT_EPISODE_FLOW.md §8(cc)): an Emerging event drafts an
 *      Influential Lala's Reel at the Influential anchor.
 *   2. A first draft records its pricing version, so the screen never reads
 *      "pricing vnull".
 *   4. Lala's home city is Echo Park, a DREAM city (Evoni's correction,
 *      2026-10-01): an Echo Park event drafts no travel, even as a
 *      travel_destination; an event in another DREAM city drafts travel and
 *      accommodation with no amount. Migration 20261001210000 moves the
 *      stored home from city Los Angeles to city Echo Park.
 * (3, "Auto-drafted" twice, is the Terms screen's: EventTermsSection.test.)
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

(shouldSkip ? describe.skip : describe)('Terms fixes: Lala\'s tier, the pricing version, Echo Park', () => {
  let token;
  const shows = [];
  const locations = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-terms-fixes', email: 'test@terms-fixes.dev', name: 'Terms Fixes', groups: ['USER', 'EDITOR'], role: 'USER',
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
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
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
      { ...ids, name: `TF ${ids.show.slice(0, 8)}`, slug: `tf-${ids.show.slice(0, 8)}` });
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

  const lala = (ids, reputation) => run(
    `INSERT INTO character_state (id, show_id, character_key, reputation, created_at, updated_at)
     VALUES (:id, :show, 'lala', :reputation, NOW(), NOW())`, { id: uuid(), show: ids.show, reputation });
  const anchor = async (component, tier) => {
    const [{ amount }] = await q(
      `SELECT amount FROM deal_rate_anchors WHERE component = :component AND career_tier = :tier
        ORDER BY version DESC LIMIT 1`, { component, tier });
    return Number(amount);
  };

  it('1. a deal is priced at Lala\'s own tier, not the event\'s', async () => {
    const ids = await seed();
    await run('UPDATE world_events SET career_tier = 1 WHERE id = :event', ids); // Emerging event
    await lala(ids, 7); // Influential Lala (reputation 7–8)
    expect((await putEvent(ids, { deal_components: ['paid_for_content'] })).status).toBe(200);
    const rows = await deliverables(ids);
    const reel = rows.find((d) => d.deliverable_type === 'instagram_reel');
    expect(reel).toBeTruthy();
    expect(Number(reel.fee)).toBe(await anchor('reel', 4));
    expect(Number(reel.fee)).not.toBe(await anchor('reel', 1));
    // The deal records the tier it was priced at.
    expect((await row(ids)).career_tier).toBe(1);
  });

  it('1. without Lala\'s state the event\'s tier still prices the deal', async () => {
    const ids = await seed();
    await run('UPDATE world_events SET career_tier = 3 WHERE id = :event', ids);
    expect((await putEvent(ids, { deal_components: ['paid_for_content'] })).status).toBe(200);
    const reel = (await deliverables(ids)).find((d) => d.deliverable_type === 'instagram_reel');
    expect(Number(reel.fee)).toBe(await anchor('reel', 3));
  });

  it('2. the first draft records its pricing version', async () => {
    const ids = await seed();
    await lala(ids, 7);
    expect((await putEvent(ids, { deal_components: ['paid_for_content'] })).status).toBe(200);
    const event = await row(ids);
    const [{ v }] = await q('SELECT MAX(version)::int AS v FROM deal_rate_anchors');
    expect(event.pricing_version).toBe(v);
    expect(asJson(event.canon_consequences).automation.pricing_version).toBe(v);
  });

  const HOME = { address: '246 Olddy Paveway Ln', neighbourhood: null, city: 'Echo Park' };

  it('4. Echo Park is home: no travel, even with a travel_destination category', async () => {
    const ids = await seed({ category: 'travel_destination' });
    await run(`UPDATE shows SET metadata = :m WHERE id = :show`, { show: ids.show, m: JSON.stringify({ lala_home: HOME }) });
    const venue = uuid();
    locations.push(venue);
    await run(`INSERT INTO world_locations (id, name, location_type, city, created_at, updated_at)
               VALUES (:id, 'Wearable Experiments Studio', 'venue', 'Echo Park', NOW(), NOW())`, { id: venue });
    await run('UPDATE world_events SET venue_location_id = :venue WHERE id = :event', { ...ids, venue });
    expect((await putEvent(ids, { deal_components: ['paid_to_appear'], appearance_fee: 300 })).status).toBe(200);
    expect(await costs(ids)).toEqual([]);
  });

  it('4. a venue whose district is Echo Park, with no city, is home too', async () => {
    const ids = await seed({ category: 'travel_destination' });
    await run(`UPDATE shows SET metadata = :m WHERE id = :show`, { show: ids.show, m: JSON.stringify({ lala_home: HOME }) });
    const venue = uuid();
    locations.push(venue);
    await run(`INSERT INTO world_locations (id, name, location_type, district, created_at, updated_at)
               VALUES (:id, 'A studio', 'venue', 'Echo Park', NOW(), NOW())`, { id: venue });
    await run('UPDATE world_events SET venue_location_id = :venue WHERE id = :event', { ...ids, venue });
    expect((await putEvent(ids, { deal_components: ['paid_to_appear'], appearance_fee: 300 })).status).toBe(200);
    expect(await costs(ids)).toEqual([]);
  });
  it('4. another DREAM city is away: travel and accommodation, no amount', async () => {
    const ids = await seed();
    await run(`UPDATE shows SET metadata = :m WHERE id = :show`, { show: ids.show, m: JSON.stringify({ lala_home: HOME }) });
    const venue = uuid();
    locations.push(venue);
    await run(`INSERT INTO world_locations (id, name, location_type, city, created_at, updated_at)
               VALUES (:id, 'The Velvet Room', 'venue', 'Dazzle District', NOW(), NOW())`, { id: venue });
    await run('UPDATE world_events SET venue_location_id = :venue WHERE id = :event', { ...ids, venue });
    expect((await putEvent(ids, { deal_components: ['paid_to_appear'], appearance_fee: 300 })).status).toBe(200);
    expect((await costs(ids)).map((c) => [c.kind, c.amount, c.paid_by])).toEqual([['travel', null, 'lala'], ['accommodation', null, 'lala']]);
  });

  it('4. migration 20261001210000 moves the stored home to city Echo Park, and back', async () => {
    const migration = require('../../src/migrations/20261001210000-lala-home-city-echo-park');
    const old = await seed();
    const edited = await seed();
    const elsewhere = await seed();
    const set = (ids, home) => run(`UPDATE shows SET metadata = :m WHERE id = :show`,
      { show: ids.show, m: JSON.stringify({ keep: 1, lala_home: home }) });
    const homeOf = async (ids) => asJson((await q('SELECT metadata FROM shows WHERE id = :show', ids))[0].metadata);
    await set(old, { address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' });
    await set(edited, { address: '1 Other St', neighbourhood: 'echo park', city: 'Los Angeles ' });
    await set(elsewhere, { address: '9 Rue', neighbourhood: null, city: 'Paris' });

    await migration.up(sequelize.getQueryInterface());
    await migration.up(sequelize.getQueryInterface()); // a re-run changes nothing
    expect(await homeOf(old)).toEqual({ keep: 1, lala_home: HOME });
    expect((await homeOf(edited)).lala_home).toEqual({ address: '1 Other St', neighbourhood: null, city: 'Echo Park' });
    expect((await homeOf(elsewhere)).lala_home.city).toBe('Paris');

    await migration.down(sequelize.getQueryInterface());
    expect((await homeOf(old)).lala_home).toEqual({ address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' });
    expect((await homeOf(edited)).lala_home.city).toBe('Echo Park'); // not the value up writes for her address
    await migration.up(sequelize.getQueryInterface());
  });
});
