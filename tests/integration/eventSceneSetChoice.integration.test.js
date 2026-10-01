/**
 * An event's scene set is chosen, never matched (rulings S3 and S7, Evoni
 * 2026-09-30 / 2026-10-01; EVENT_EPISODE_FLOW.md §8(dd)). Creating an event
 * at a venue linked the first scene set found at that World Location
 * (SceneSet.findOne, no order); now it links none, and a set named in the
 * request is kept.
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

(shouldSkip ? describe.skip : describe)('An event at a venue gets no scene set by matching (S3, S7)', () => {
  let token;
  const ids = { show: uuid(), location: uuid(), set: uuid(), otherSet: uuid() };

  beforeAll(async () => {
    // The SceneSet model's columns that only a dead migration tree adds, so
    // the test database lacks them unless an earlier file added them (as
    // approvedBase.integration.test.js does); this file must not rely on
    // running after it.
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    token = TokenService.generateTokenPair({
      id: 'test-user-event-scene-s7', email: 'user@event-scene-s7.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `S7 show ${ids.show.slice(0, 8)}`, slug: `s7-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_locations (id, name, city, created_at, updated_at)
               VALUES (:location, 'The Glasshouse', 'Echo Park', NOW(), NOW())`, ids);
    for (const [id, name] of [[ids.set, 'Glasshouse Hall'], [ids.otherSet, 'Atelier']]) {
      await models.SceneSet.create({ id, name, scene_type: 'EVENT_LOCATION', show_id: ids.show, world_location_id: id === ids.set ? ids.location : null });
    }
  });

  afterAll(async () => {
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM scene_sets WHERE id IN (:set, :otherSet)', ids);
    await run('DELETE FROM world_locations WHERE id = :location', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const create = (body) => request(app)
    .post(`/api/v1/world/${ids.show}/events`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

  it('a venue with a scene set at it: the event is created with no scene set', async () => {
    const res = await create({ name: 'Velour Launch', venue_location_id: ids.location });
    expect(res.status).toBe(201);
    expect(res.body.event.venue_location_id).toBe(ids.location);
    expect(res.body.event.scene_set_id).toBeNull();
  });

  it('a scene set named in the request is kept', async () => {
    const res = await create({ name: 'Atelier Night', venue_location_id: ids.location, scene_set_id: ids.otherSet });
    expect(res.status).toBe(201);
    expect(res.body.event.scene_set_id).toBe(ids.otherSet);
  });
});
