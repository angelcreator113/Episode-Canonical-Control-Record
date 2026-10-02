/**
 * L14 (a): a scene set's angles as zones of the place (Evoni's ruling L14
 * and her answers 1-9, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)), on
 * the migrated database:
 * - the zone kinds (front, inside, back, area, zone) and framing extras
 *   (extra, on a zone by zone_angle_id; none = Inside, the base);
 * - the remap of existing angles (answer 6): exterior and entrance → one
 *   Front, main interior → one Inside, a second of either → an extra on it,
 *   area stays, the rest → extras on Inside; no image touched;
 * - the beat mapping: arrival (10) → Front; the event (11-12) → Inside,
 *   which is the set's base (answer 1) unless an Inside angle has an image;
 * - a missing zone is named as a zone: "Front zone missing".
 * No image calls.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const junctionMigration = require('../../src/migrations/20260324000000-add-scene-sets-cover-and-episodes');
const sortOrderMigration = require('../../src/migrations/20260626000001-add-sort-order-to-scene-set-episodes');
const rolesMigration = require('../../src/migrations/20261002100000-add-scene-set-episode-roles');
const lookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const kindMigration = require('../../src/migrations/20261002120000-add-scene-angle-kind');
const zoneMigration = require('../../src/migrations/20261002170000-scene-angle-zones');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('L14 (a): angles as zones', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  async function sceneSet(name, type, { base = true } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:id, :name, :type, :show, :base, 'complete', NOW(), NOW())`,
    { id, name, type, show, base: base ? `https://x/${id}-base.jpg` : null });
    return id;
  }
  async function angle(setId, label, { name = label, image = true, kind = null, order = 0 } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:id, :setId, :name, :label, :kind, :status, :url, '[]', :order, NOW(), NOW())`,
    { id, setId, name, label, kind, status: image ? 'complete' : 'pending', url: image ? `https://x/${id}.png` : null, order });
    return id;
  }
  async function readyEvent(sceneSetId) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'invite', 'ready', 5, :sceneSetId, NOW(), NOW())`, { id, show, sceneSetId });
    return id;
  }
  const start = (eventId, locations) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false, locations });

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration, lookMigration, kindMigration, zoneMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-l14', email: 'user@l14.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: show, name: `L14 ${show.slice(0, 8)}`, slug: `l14-${show.slice(0, 8)}` });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show } }).catch(() => {});
    for (const t of ['scenes', 'scene_plans', 'scene_set_episodes', 'episode_spending_lines', 'episode_briefs', 'episode_todo_lists']) {
      await q(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`);
    }
    for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state']) {
      await q(`DELETE FROM ${t} WHERE show_id = :show`);
    }
    await q('UPDATE world_events SET used_in_episode_id = NULL, scene_set_id = NULL WHERE show_id = :show');
    await q('DELETE FROM episodes WHERE show_id = :show');
    await q('DELETE FROM world_events WHERE show_id = :show');
    await q('DELETE FROM scene_angles WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)');
    await q('DELETE FROM scene_sets WHERE show_id = :show');
    await q('DELETE FROM shows WHERE id = :show');
  });

  it('answer 6: existing angles are re-kinded as zones and extras; a re-run changes nothing; no image is touched', async () => {
    const set = await sceneSet('Remap venue', 'EVENT_LOCATION');
    const ids = {
      est: await angle(set, 'ESTABLISHING', { kind: 'exterior', order: 1 }),
      door: await angle(set, 'DOORWAY', { kind: 'entrance', image: false, order: 0 }),
      wide: await angle(set, 'WIDE', { kind: 'main_interior', order: 2 }),
      wide2: await angle(set, 'WIDE', { name: 'Second hall', kind: 'main_interior', order: 3 }),
      bar: await angle(set, 'OTHER', { name: 'Bar', kind: 'area' }),
      close: await angle(set, 'CLOSE', { kind: 'detail' }),
      vanity: await angle(set, 'VANITY'),
    };
    // Put the old kinds back on these rows (the shared test database is already migrated).
    await run(`UPDATE scene_angles SET angle_kind = CASE id
      WHEN :est THEN 'exterior' WHEN :door THEN 'entrance' WHEN :wide THEN 'main_interior' WHEN :wide2 THEN 'main_interior'
      WHEN :bar THEN 'area' WHEN :close THEN 'detail' ELSE NULL END, zone_angle_id = NULL WHERE id IN (:all)`,
    { ...ids, all: Object.values(ids) });
    const before = await rows('SELECT id, still_image_url FROM scene_angles WHERE id IN (:all) ORDER BY id', { all: Object.values(ids) });

    for (let i = 0; i < 2; i += 1) await zoneMigration.up(sequelize.getQueryInterface(), Sequelize);

    const got = Object.fromEntries((await rows('SELECT id, angle_kind, zone_angle_id FROM scene_angles WHERE id IN (:all)', { all: Object.values(ids) }))
      .map((r) => [r.id, { kind: r.angle_kind, zone: r.zone_angle_id }]));
    // One Front: the one with an image first (the exterior), the other an extra on it.
    expect(got[ids.est]).toEqual({ kind: 'front', zone: null });
    expect(got[ids.door]).toEqual({ kind: 'extra', zone: ids.est });
    expect(got[ids.wide]).toEqual({ kind: 'inside', zone: null });
    expect(got[ids.wide2]).toEqual({ kind: 'extra', zone: ids.wide });
    expect(got[ids.bar]).toEqual({ kind: 'area', zone: null });
    expect(got[ids.close]).toEqual({ kind: 'extra', zone: null });
    expect(got[ids.vanity]).toEqual({ kind: 'extra', zone: null });
    const after = await rows('SELECT id, still_image_url FROM scene_angles WHERE id IN (:all) ORDER BY id', { all: Object.values(ids) });
    expect(after).toEqual(before);
  });

  it('beat mapping: arrival → Front; the event → Inside, which is the base unless an Inside angle has an image', async () => {
    const venue = await sceneSet('Zoned venue', 'EVENT_LOCATION');
    const home = await sceneSet('Zoned home', 'HOME_BASE');
    await angle(venue, 'ESTABLISHING', { name: 'Front steps', kind: 'front' });
    await angle(venue, 'OTHER', { name: 'Backstage', kind: 'back' });
    const res = await start(await readyEvent(venue), [
      { role: 'event', scene_set_id: venue },
      { role: 'home', scene_set_id: home },
    ]);
    expect(res.status).toBe(201);
    const ep = res.body.data.episode.id;
    const plan = await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
    const beat = (n) => plan.body.data.find((b) => b.beat_number === n);
    expect(beat(10)).toMatchObject({ angle_label: 'ESTABLISHING', location: { kinds: ['front'], angle: { name: 'Front steps', kind: 'front' }, missing: null } });
    // No Inside angle: the base serves; nothing is missing.
    expect(beat(11)).toMatchObject({ angle_label: null, location: { kinds: ['inside'], angle: null, missing: null } });
    expect(beat(12).location.missing).toBeNull();
    expect(plan.body.readiness.not_ready.find((b) => [10, 11, 12].includes(b.beat_number))).toBeUndefined();

    // An Inside angle with an image is used.
    const inside = await angle(venue, 'WIDE', { name: 'Main hall', kind: 'inside' });
    const res2 = await start(await readyEvent(venue), [
      { role: 'event', scene_set_id: venue },
      { role: 'home', scene_set_id: home },
    ]);
    const plan2 = await auth(request(app).get(`/api/v1/episode-brief/${res2.body.data.episode.id}/plan`));
    expect(plan2.body.data.find((b) => b.beat_number === 11).location.angle).toMatchObject({ id: inside, kind: 'inside' });
  });

  it('a missing Front is named as a zone; Inside is never missing', async () => {
    const bare = await sceneSet('Bare venue', 'EVENT_LOCATION');
    const event = await readyEvent(bare);
    const proposal = await auth(request(app).get(`/api/v1/world/${show}/events/${event}/episode-locations`));
    const gaps = proposal.body.data.angle_gaps.filter((g) => g.scene_set_id === bare);
    expect(gaps).toEqual([expect.objectContaining({ role: 'event', kinds: ['front'], text: 'Front zone missing', beats: [10] })]);

    const home = await sceneSet('Bare home', 'HOME_BASE');
    const res = await start(event, [{ role: 'event', scene_set_id: bare }, { role: 'home', scene_set_id: home }]);
    const plan = await auth(request(app).get(`/api/v1/episode-brief/${res.body.data.episode.id}/plan`));
    expect(plan.body.data.find((b) => b.beat_number === 10).location.missing).toMatchObject({
      reason: 'no_angle', kind: 'front', label: 'ESTABLISHING', name: 'Front', text: 'Front zone missing',
    });
    const pending = await angle(bare, 'ESTABLISHING', { name: 'Gate', kind: 'front', image: false });
    const again = await auth(request(app).get(`/api/v1/episode-brief/${res.body.data.episode.id}/plan`));
    expect(again.body.data.find((b) => b.beat_number === 10).location.missing).toMatchObject({
      reason: 'no_image', angle_id: pending, text: 'Gate zone has no image',
    });
  });

  it('angles are made with a zone kind; the old kinds are refused; an extra may name its zone', async () => {
    const set = await sceneSet('Kinds venue', 'EVENT_LOCATION');
    const old = await auth(request(app).post(`/api/v1/scene-sets/${set}/angles`)).send({ angle_label: 'ESTABLISHING', angle_name: 'Front', angle_kind: 'exterior' });
    expect(old.status).toBe(400);
    const back = await auth(request(app).post(`/api/v1/scene-sets/${set}/angles`)).send({ angle_label: 'OTHER', angle_name: 'Green room', angle_kind: 'back' });
    expect(back.status).toBe(201);
    expect(back.body.data.angle_kind).toBe('back');
    const extra = await auth(request(app).post(`/api/v1/scene-sets/${set}/angles`)).send({
      angle_label: 'CLOSE', angle_name: 'Mirror', angle_kind: 'extra', zone_angle_id: back.body.data.id,
    });
    expect(extra.status).toBe(201);
    expect(extra.body.data.zone_angle_id).toBe(back.body.data.id);
    const elsewhere = await sceneSet('Other venue', 'EVENT_LOCATION');
    const foreign = await angle(elsewhere, 'OTHER', { kind: 'back' });
    const wrong = await auth(request(app).post(`/api/v1/scene-sets/${set}/angles`)).send({
      angle_label: 'CLOSE', angle_name: 'Bad', angle_kind: 'extra', zone_angle_id: foreign,
    });
    expect(wrong.status).toBe(400);
  });
});
