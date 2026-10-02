/**
 * Beat Plan display bugs (Evoni, 2026-10-02, on a production episode):
 *   1. "A beat with a set but no specific angle shows a blank image: it
 *      must show the set's base image (per Q21), labelled e.g. "Lala's
 *      Closet · base"."
 *   2. "'No scene assigned' shows on beats that have a set ... show the set
 *      name, and only say something is missing when the set is."
 *   3. "Images don't refresh as sets/angles finish generating."
 * The plan read (GET /episode-brief/:id/plan) now carries, per beat, the
 * picture it shows (location.image: url, source, label), the set it is at
 * (sceneSet, read directly, even when the include comes back empty), and
 * whether anything it waits on is still generating (location.generating).
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

(shouldSkip ? describe.skip : describe)('Beat Plan display (Evoni, 2026-10-02)', () => {
  const show = uuid();
  const ep = uuid();
  let token;
  const sets = {};
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function sceneSet(key, name, { base = `https://x/${key}-base.jpg`, status = 'complete' } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:id, :name, 'HOME_BASE', :show, :base, :status, NOW(), NOW())`, { id, name, show, base, status });
    sets[key] = id;
    return id;
  }
  async function beat(n, setId, { label = null, chosen = false } = {}) {
    await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
               VALUES (:id, :ep, :n, :name, :setId, :label, false, :chosen, :n, false, NOW(), NOW())`,
    { id: uuid(), ep, n, name: `Beat ${n}`, setId, label, chosen });
  }
  const plan = async () => {
    const res = await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
    expect(res.status).toBe(200);
    return (n) => res.body.data.find((b) => b.beat_number === n);
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-beat-display', email: 'u@display.dev', name: 'Editor', groups: ['USER'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}', NOW(), NOW())`, { show, n: `display-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Display', :num, 'draft', NOW(), NOW())`,
      { ep, show, num: Math.floor(Math.random() * 100000) + 700 });
    await sceneSet('closet', "Lala's Closet");
    await sceneSet('house', 'Lalas house');
    await sceneSet('room', "Lala's Room");
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:id, :set, 'Living room', 'WIDE', 'inside', 'complete', 'https://x/house-wide.jpg', '[]', 0, NOW(), NOW())`, { id: uuid(), set: sets.house });
    await beat(4, sets.closet, { chosen: true });
    await beat(8, sets.house, { label: 'WIDE', chosen: true });
    await beat(1, sets.room);
    await beat(11, null);
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show, ep } }).catch(() => {});
    await q('DELETE FROM scenes WHERE episode_id = :ep');
    await q('DELETE FROM scene_plans WHERE episode_id = :ep');
    await q('DELETE FROM episodes WHERE id = :ep');
    await q('DELETE FROM scene_angles WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)');
    await q('DELETE FROM scene_sets WHERE show_id = :show');
    await q('DELETE FROM shows WHERE id = :show');
  });

  it('1: a beat at a set with no angle shows the set\'s base image, labelled "<set> · base"', async () => {
    const at = await plan();
    expect(at(4).location.image).toEqual({ url: 'https://x/closet-base.jpg', source: 'base', label: "Lala's Closet · base" });
    expect(at(1).location.image).toEqual({ url: 'https://x/room-base.jpg', source: 'base', label: "Lala's Room · base" });
    // A chosen angle with an image: the angle, labelled by its name.
    expect(at(8).location.image).toEqual({ url: 'https://x/house-wide.jpg', source: 'angle', label: 'Lalas house · Living room' });
    // No set: no image, nothing labelled.
    expect(at(11).location.image).toBeNull();
  });

  it('2: every beat with a set names its set, even when the set has been removed from Scene Sets', async () => {
    let at = await plan();
    expect(at(4).sceneSet).toMatchObject({ id: sets.closet, name: "Lala's Closet", base_still_url: 'https://x/closet-base.jpg' });
    expect(at(11).sceneSet).toBeNull();
    await run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :id', { id: sets.room });
    at = await plan();
    expect(at(1).sceneSet).toMatchObject({ id: sets.room, name: "Lala's Room", removed: true });
    expect(at(1).location.image).toEqual({ url: 'https://x/room-base.jpg', source: 'base', label: "Lala's Room · base (removed from Scene Sets)" });
    await run('UPDATE scene_sets SET deleted_at = NULL WHERE id = :id', { id: sets.room });
  });

  it('3: a beat says when what it waits on is still generating', async () => {
    let at = await plan();
    expect(at(4).location.generating).toBe(false);
    await run("UPDATE scene_sets SET generation_status = 'generating', base_still_url = NULL WHERE id = :id", { id: sets.closet });
    at = await plan();
    expect(at(4).location).toMatchObject({ generating: true, image: null });
    await run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://x/closet-base.jpg' WHERE id = :id", { id: sets.closet });
    await run("UPDATE scene_angles SET generation_status = 'generating' WHERE scene_set_id = :id", { id: sets.house });
    at = await plan();
    expect(at(8).location.generating).toBe(true);
    await run("UPDATE scene_angles SET generation_status = 'complete' WHERE scene_set_id = :id", { id: sets.house });
  });
});
