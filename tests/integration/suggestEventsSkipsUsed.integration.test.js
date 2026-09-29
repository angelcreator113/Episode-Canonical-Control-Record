/**
 * GET /api/v1/world/:showId/suggest-events never returns used or deleted
 * events; access requirements stay a weight, not a gate
 * (docs/EVENT_EPISODE_FLOW.md §8(x) D5; Task #2231).
 *
 * Its query used to filter only status IN ('draft','ready'), so an event
 * already used by an episode, or soft-deleted, could be suggested again.
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

(shouldSkip ? describe.skip : describe)('suggest-events skips used and deleted events (§8(x) D5)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-suggest-events',
      email: 'test@suggest-events.dev',
      name: 'Suggest Events Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  async function seed({ withMalformed = false } = {}) {
    const ids = { show: uuid(), ep: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Suggest show ${ids.show.slice(0, 8)}`, slug: `sug-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Suggest episode', 1, 'draft', NOW(), NOW())`, ids);
    const event = async (name, { used = false, deleted = false, requirements = '{}' } = {}) => {
      const id = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, requirements, deleted_at, created_at, updated_at)
                 VALUES (:id, :show, :name, 'ready', :used, CAST(:requirements AS jsonb), :deleted, NOW(), NOW())`,
        { id, show: ids.show, name, used: used ? ids.ep : null, requirements, deleted: deleted ? new Date() : null });
      return id;
    };
    ids.open = await event('Open Gala');
    ids.used = await event('Used Gala', { used: true });
    ids.deleted = await event('Deleted Gala', { deleted: true });
    ids.unmet = await event('Exclusive Gala', { requirements: JSON.stringify({ reputation_min: 9 }) });
    // A JSON string, not an object: parsing it as requirements throws.
    if (withMalformed) ids.malformed = await event('Garbled Gala', { requirements: JSON.stringify('{not json') });
    return ids;
  }

  const suggest = (ids) => request(app)
    .get(`/api/v1/world/${ids.show}/suggest-events?limit=10`)
    .set('Authorization', `Bearer ${token}`);

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('never returns a used or a deleted event', async () => {
    const ids = await seed();

    const res = await suggest(ids);

    expect(res.status).toBe(200);
    const returned = res.body.suggestions.map((s) => s.id);
    expect(returned).toContain(ids.open);
    expect(returned).not.toContain(ids.used);
    expect(returned).not.toContain(ids.deleted);
  });

  it('keeps an event with unmet requirements, scored lower and flagged', async () => {
    const ids = await seed();

    const res = await suggest(ids);

    const byId = Object.fromEntries(res.body.suggestions.map((s) => [s.id, s]));
    expect(byId[ids.unmet]).toBeDefined();
    expect(byId[ids.unmet].requirements_met).toBe(false);
    expect(byId[ids.unmet].suggestion_reasons).toContain('requirements not met');
    expect(byId[ids.unmet].suggestion_score).toBeLessThan(byId[ids.open].suggestion_score);
  });

  it('an unreadable requirements value does not fail the route', async () => {
    const ids = await seed({ withMalformed: true });

    const res = await suggest(ids);

    expect(res.status).toBe(200);
    const garbled = res.body.suggestions.find((s) => s.id === ids.malformed);
    expect(garbled).toBeDefined();
    expect(garbled.requirements_met).toBe(true);
  });
});
