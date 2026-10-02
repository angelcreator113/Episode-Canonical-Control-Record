/**
 * DJ findings 4 and 6 (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *   4. Ruling L13: "an event's Place section (scene set choice, venue look,
 *   Generate this look) stays editable while its episode is a draft, even
 *   after Start Episode; only the terms lock at Start Episode. It locks
 *   when the episode is accepted."
 *   6. "After approving a venue's base, the event's Place section shows
 *   nothing. It should show the approved base thumbnail with 'Generate this
 *   look' for the dressed version, and the dressed look once it exists."
 * Through the real routes on the migrated database.
 */
jest.unmock('uuid');

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');
const venueLookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('The Place: L13 lock and the approved base (DJ 4, 6)', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const eventUrl = (ev, tail = '') => `/api/v1/world/${show}/events/${ev}${tail}`;

  /** A venue with an approved base on its first set, a second set, an event started as an episode. */
  async function world({ evaluation = 'pending', linkSet = true } = {}) {
    const loc = uuid(); const approvedSet = uuid(); const otherSet = uuid(); const ev = uuid(); const ep = uuid();
    await run(`INSERT INTO world_locations (id, name, description, approved_base_scene_set_id, approved_base_image_url, created_at, updated_at)
               VALUES (:loc, 'Studio by Sable', 'A white photo studio.', :approvedSet, 'https://x/approved.jpg', NOW(), NOW())`, { loc, approvedSet });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:approvedSet, 'Studio', 'EVENT_LOCATION', :show, :loc, 'https://x/approved.jpg', 'complete', NOW(), NOW()),
                      (:otherSet, 'Studio annex', 'EVENT_LOCATION', :show, :loc, NULL, 'pending', NOW(), NOW())`,
    { approvedSet, otherSet, show, loc });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'Sable ep', :n, 'draft', :evaluation, NOW(), NOW())`,
    { ep, show, n: Math.floor(Math.random() * 100000) + 600, evaluation });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, venue_name, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, 'Sable shoot', 'invite', 'used', 5, :loc, 'Studio by Sable', :set, :ep, NOW(), NOW())`,
    { ev, show, loc, set: linkSet ? approvedSet : null, ep });
    return { loc, approvedSet, otherSet, ev, ep };
  }

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [approvedMigration, venueLookMigration, looksMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-place-lock', email: 'user@placelock.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Place lock ${show.slice(0, 8)}`, slug: `place-lock-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('L13: after Start Episode, with the episode a draft, the scene set can still be changed', async () => {
    const w = await world();
    const got = await auth(request(app).get(eventUrl(w.ev)));
    expect(got.status).toBe(200);
    expect(got.body.placeLocked).toBe(false);
    const res = await auth(request(app).put(eventUrl(w.ev))).send({ scene_set_id: w.otherSet });
    expect(res.status).toBe(200);
    expect((await rows('SELECT scene_set_id FROM world_events WHERE id = :ev', { ev: w.ev }))[0].scene_set_id).toBe(w.otherSet);
  });

  it('L13: once the episode is accepted the Place locks: no scene set change, no "Generate this look"', async () => {
    const w = await world({ evaluation: 'accepted' });
    const got = await auth(request(app).get(eventUrl(w.ev)));
    expect(got.body.placeLocked).toBe(true);
    const res = await auth(request(app).put(eventUrl(w.ev))).send({ scene_set_id: w.otherSet });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLACE_LOCKED');
    expect((await rows('SELECT scene_set_id FROM world_events WHERE id = :ev', { ev: w.ev }))[0].scene_set_id).toBe(w.approvedSet);
    // The stored value re-sent (a full-form save) is not a change.
    expect((await auth(request(app).put(eventUrl(w.ev))).send({ scene_set_id: w.approvedSet })).status).toBe(200);

    const dressed = jest.spyOn(sceneGen, 'generateDressedStill');
    const gen = await auth(request(app).post(eventUrl(w.ev, '/look/generate'))).send({});
    expect(gen.status).toBe(409);
    expect(gen.body.code).toBe('PLACE_LOCKED');
    expect(dressed).not.toHaveBeenCalled();
    expect((await auth(request(app).get(eventUrl(w.ev, '/look')))).body.data.editable).toBe(false);
  });

  it("DJ 6: the Place section reads the venue's approved base, with or without a scene set chosen", async () => {
    const linked = await world();
    let look = (await auth(request(app).get(eventUrl(linked.ev, '/look')))).body.data;
    expect(look).toMatchObject({ approved_base: { scene_set_id: linked.approvedSet, image_url: 'https://x/approved.jpg' }, look: null, editable: true });

    const unlinked = await world({ linkSet: false });
    look = (await auth(request(app).get(eventUrl(unlinked.ev, '/look')))).body.data;
    expect(look).toMatchObject({ scene_set: null, approved_base: { scene_set_id: unlinked.approvedSet, image_url: 'https://x/approved.jpg' }, editable: true });
  });
});
