/**
 * The planner's beat-to-location mapping and missing angles, L(d) (Evoni's
 * ruling L4 and her answers Q5, Q17-Q19, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)), on the migrated database:
 * - scene_angles.angle_kind, backfilled from labels (Q18);
 * - Start Episode puts each beat at its role's location and on the angle of
 *   its kind: closet beat 8 in the closet, transition beats 7 and 9 at home,
 *   arrival (10) on the entrance or exterior, the event (11-12) on the main
 *   interior (Q17);
 * - the AI planner keeps that mapping whatever the AI answers;
 * - the plan read names each missing angle by kind (Q19), and the Episode
 *   Locations step summarises them;
 * - suggest-angles offers the event's areas as angles, with kinds, on the
 *   14 beats (Q5).
 * L14 (2026-10-02, answers 1-9) made the kinds zones: arrival → Front, the
 * event → Inside (the base unless an Inside angle has an image, so never
 * missing); tests/integration/l14Zones.integration.test.js covers it.
 * The AI client is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const junctionMigration = require('../../src/migrations/20260324000000-add-scene-sets-cover-and-episodes');
const sortOrderMigration = require('../../src/migrations/20260626000001-add-sort-order-to-scene-set-episodes');
const rolesMigration = require('../../src/migrations/20261002100000-add-scene-set-episode-roles');
const lookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const kindMigration = require('../../src/migrations/20261002120000-add-scene-angle-kind');
const { generateScenePlan } = require('../../src/services/scenePlannerService');

const { Sequelize } = require('sequelize');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Planner angles (§8(hh) L4)', () => {
  const show = uuid();
  let token;
  const savedKey = process.env.ANTHROPIC_API_KEY;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const sets = {};
  async function sceneSet(key, type) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, script_context, created_at, updated_at)
               VALUES (:id, :name, :type, :show, 'complete', :ctx, NOW(), NOW())`, { id, name: key, type, show, ctx: `The ${key}.` });
    sets[key] = id;
    return id;
  }
  async function angle(setId, label, { name = label, image = true, kind } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:id, :setId, :name, :label, :kind, :status, :url, '[]', 0, NOW(), NOW())`,
    { id, setId, name, label, kind: kind || null, status: image ? 'complete' : 'pending', url: image ? `https://x/${id}.png` : null });
    return id;
  }
  async function readyEvent(sceneSetId, look = null) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, venue_look, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'invite', 'ready', 5, :sceneSetId, CAST(:look AS jsonb), NOW(), NOW())`,
    { id, show, sceneSetId, look: look ? JSON.stringify(look) : null });
    return id;
  }
  const start = (eventId, locations) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false, locations });
  const plan = async (ep) => rows('SELECT beat_number, scene_set_id, angle_label FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number', { ep });

  beforeAll(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration, lookMigration, kindMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-planner-angles', email: 'user@angles.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: show, name: `Angles ${show.slice(0, 8)}`, slug: `angles-${show.slice(0, 8)}` });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
    await sceneSet('apartment', 'HOME_BASE');
    await sceneSet('closet', 'CLOSET');
    await sceneSet('glasshouse', 'EVENT_LOCATION');
    await sceneSet('bare', 'EVENT_LOCATION');
    await angle(sets.apartment, 'WIDE', { name: 'Living room', kind: 'inside' });
    await angle(sets.glasshouse, 'DOORWAY', { name: 'Glass doors', kind: 'front' });
    await angle(sets.glasshouse, 'WIDE', { name: 'Main hall', kind: 'inside' });
    await angle(sets.glasshouse, 'CLOSE', { name: 'Bar detail' });
  });
  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    const q = (sql) => sequelize.query(sql, { replacements: { show } }).catch(() => {});
    for (const t of ['scene_plans', 'scene_set_episodes', 'episode_spending_lines', 'episode_briefs', 'episode_todo_lists']) {
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

  it('the migration fills angle_kind from the label, and a re-run changes nothing (Q18)', async () => {
    const est = await angle(sets.bare, 'ESTABLISHING', { name: 'Old exterior' });
    const door = await angle(sets.bare, 'doorway', { name: 'Old door' });
    const close = await angle(sets.bare, 'CLOSE', { name: 'Old close' });
    await kindMigration.up(sequelize.getQueryInterface());
    await kindMigration.up(sequelize.getQueryInterface());
    const kinds = await rows('SELECT id, angle_kind FROM scene_angles WHERE id IN (:ids)', { ids: [est, door, close] });
    const byId = Object.fromEntries(kinds.map((k) => [k.id, k.angle_kind]));
    expect(byId).toEqual({ [est]: 'exterior', [door]: 'entrance', [close]: null });
    await run('DELETE FROM scene_angles WHERE id IN (:ids)', { ids: [est, door, close] });
  });

  it('Start Episode puts each beat at its role and on the angle of its kind (Q17)', async () => {
    const event = await readyEvent(sets.glasshouse);
    const res = await start(event, [
      { role: 'event', scene_set_id: sets.glasshouse },
      { role: 'home', scene_set_id: sets.apartment },
      { role: 'closet', scene_set_id: sets.closet },
    ]);
    expect(res.status).toBe(201);
    const beats = await plan(res.body.data.episode.id);
    const at = (n) => beats.find((b) => b.beat_number === n);
    expect(at(8)).toMatchObject({ scene_set_id: sets.closet, angle_label: null });
    for (const n of [1, 6, 7, 9, 13, 14]) expect(at(n)).toMatchObject({ scene_set_id: sets.apartment, angle_label: null });
    expect(at(10)).toMatchObject({ scene_set_id: sets.glasshouse, angle_label: 'DOORWAY' });
    expect(at(11)).toMatchObject({ scene_set_id: sets.glasshouse, angle_label: 'WIDE' });
    expect(at(12)).toMatchObject({ scene_set_id: sets.glasshouse, angle_label: 'WIDE' });
  });

  it('with no closet chosen, the closet beat is at home', async () => {
    const event = await readyEvent(sets.glasshouse);
    const res = await start(event, [
      { role: 'event', scene_set_id: sets.glasshouse },
      { role: 'home', scene_set_id: sets.apartment },
    ]);
    const beats = await plan(res.body.data.episode.id);
    expect(beats.find((b) => b.beat_number === 8).scene_set_id).toBe(sets.apartment);
  });

  it('the plan names each missing zone, and the step summarises them (Q19, L14)', async () => {
    const event = await readyEvent(sets.bare);
    const proposal = await auth(request(app).get(`/api/v1/world/${show}/events/${event}/episode-locations`));
    // Inside is the base (L14, answer 1): only the Front is missing.
    expect(proposal.body.data.angle_gaps.filter((g) => g.scene_set_id === sets.bare)).toEqual([
      expect.objectContaining({ role: 'event', scene_set_id: sets.bare, text: 'Front zone missing', beats: [10] }),
    ]);

    const res = await start(event, [
      { role: 'event', scene_set_id: sets.bare },
      { role: 'home', scene_set_id: sets.apartment },
    ]);
    const ep = res.body.data.episode.id;
    const got = await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
    expect(got.status).toBe(200);
    const beat = (n) => got.body.data.find((b) => b.beat_number === n);
    expect(beat(10).location).toMatchObject({
      role: 'event', kinds: ['front'],
      missing: { reason: 'no_angle', label: 'ESTABLISHING', name: 'Front', text: 'Front zone missing', angle_id: null },
    });
    expect(beat(11).location.missing).toBeNull();
    expect(beat(1).location.missing).toBeNull();

    // An angle of the kind without an image: "has no image", with its id.
    const pending = await angle(sets.bare, 'DOORWAY', { name: 'Side door', kind: 'front', image: false });
    const again = await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
    expect(again.body.data.find((b) => b.beat_number === 10).location.missing).toMatchObject({
      reason: 'no_image', angle_id: pending, text: 'Side door zone has no image',
    });
    // L5, Q21: the plan's readiness, flagged; beats on the apartment's base
    // have no base image here, the event beats lack their angles.
    expect(again.body.readiness.total).toBe(14);
    expect(again.body.readiness.not_ready.find((b) => b.beat_number === 10).text).toBe('Side door zone has no image');
    expect(again.body.readiness.not_ready.find((b) => b.beat_number === 1).text).toBe('apartment has no base image');
    const locs = await auth(request(app).get(`/api/v1/episodes/${ep}/locations`));
    expect(locs.body.data.angle_gaps.map((g) => g.text)).toEqual(['Side door zone has no image']);
  });

  it('the AI planner keeps the mapping whatever the AI answers (Q17)', async () => {
    const event = await readyEvent(sets.glasshouse);
    const res = await start(event, [
      { role: 'event', scene_set_id: sets.glasshouse },
      { role: 'home', scene_set_id: sets.apartment },
      { role: 'closet', scene_set_id: sets.closet },
    ]);
    const ep = res.body.data.episode.id;
    // The AI puts every beat in the glasshouse on a CLOSE angle.
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify(Array.from({ length: 14 }, (_, i) => ({
      beat_number: i + 1, scene_set_id: sets.glasshouse, angle_label: 'CLOSE', shot_type: 'medium', emotional_intent: `Intent ${i + 1}`, transition_in: 'cut',
    }))) }] });

    const out = await generateScenePlan(ep, show, {}, { save: true });
    const at = (n) => out.find((b) => b.beat_number === n);
    expect(at(1)).toMatchObject({ scene_set_id: sets.apartment, angle_label: null, emotional_intent: 'Intent 1' });
    expect(at(8)).toMatchObject({ scene_set_id: sets.closet });
    expect(at(10)).toMatchObject({ scene_set_id: sets.glasshouse, angle_label: 'DOORWAY' });
    expect(at(11)).toMatchObject({ scene_set_id: sets.glasshouse, angle_label: 'WIDE' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("## The Episode's Locations (fixed)");
    expect(prompt).toContain(`10. event: glasshouse (ID ${sets.glasshouse}), front zone`);
    expect((await plan(ep)).find((b) => b.beat_number === 10).angle_label).toBe('DOORWAY');
  });

  it('an angle is created and updated with its kind; an unknown kind is refused (Q18, L14)', async () => {
    const bad = await auth(request(app).post(`/api/v1/scene-sets/${sets.bare}/angles`)).send({ angle_label: 'OTHER', angle_name: 'Roof', angle_kind: 'roof' });
    expect(bad.status).toBe(400);
    const made = await auth(request(app).post(`/api/v1/scene-sets/${sets.bare}/angles`)).send({ angle_label: 'ESTABLISHING', angle_name: 'Front', angle_kind: 'front' });
    expect(made.status).toBe(201);
    expect(made.body.data.angle_kind).toBe('front');
    const patched = await auth(request(app).patch(`/api/v1/scene-sets/${sets.bare}/angles/${made.body.data.id}`)).send({ angle_kind: 'back' });
    expect(patched.body.data.angle_kind).toBe('back');
  });

  it('suggest-angles offers the event areas as angles, with kinds, on the 14 beats (Q5)', async () => {
    await readyEvent(sets.glasshouse, { overall: 'Gala', areas: ['Bar', 'Runway', 'VIP lounge'] });
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify([
      { angle_label: 'OTHER', angle_kind: 'area', angle_name: 'Runway', camera_direction: 'Down the runway.', description: 'The runway.', beat_affinity: [11, 12, 15] },
      { angle_label: 'ESTABLISHING', angle_name: 'Front steps', camera_direction: 'From the street.', description: 'Arrival.', beat_affinity: [10] },
    ]) }] });
    const res = await auth(request(app).post(`/api/v1/scene-sets/${sets.glasshouse}/suggest-angles`)).send({});
    delete process.env.ANTHROPIC_API_KEY;
    expect(res.status).toBe(200);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Event areas to cover, one angle each (angle_kind "area", angle_name the area\'s name): Bar, Runway, VIP lounge');
    expect(prompt).toContain('beat numbers 1-14');
    expect(prompt).toContain('14. Cliffhanger (HOME_BASE)');
    const byName = Object.fromEntries(res.body.data.map((s) => [s.angle_name, s]));
    expect(byName.Runway).toMatchObject({ angle_kind: 'area', beat_affinity: [11, 12] });
    expect(byName['Front steps']).toMatchObject({ angle_kind: 'front', beat_affinity: [10] });
    expect(byName.Bar).toMatchObject({ angle_kind: 'area', angle_label: 'OTHER' });
    expect(byName['VIP lounge']).toMatchObject({ angle_kind: 'area' });
  });
});
