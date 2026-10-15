/**
 * The right picture, automatically (step 4 of
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md), through the real plan read
 * (GET /episode-brief/:id/plan) on the migrated database. Evoni,
 * 2026-10-15: beats 1-9 just before the event, 10-12 at its time, 13-14 at
 * night; the event date's season for the Front view.
 * - A beat at a location's everyday set shows the matching time variant of
 *   the everyday look; a Front beat, the season variant.
 * - A missing variant keeps the plain picture and names the gap.
 * - A set that is no location's everyday set is not changed.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const variantsMigration = require('../../src/migrations/20261015150000-create-location-look-variants');
const perSetMigration = require('../../src/migrations/20261015170000-location-look-variants-per-set');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Picking the time and season variant (step 4)', () => {
  const show = uuid();
  const ep = uuid();
  const loc = uuid();
  const loft = uuid();
  const plain = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function beat(n, setId, label = null) {
    await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
               VALUES (:id, :ep, :n, :name, :setId, :label, false, true, :n, false, NOW(), NOW())`,
    { id: uuid(), ep, n, name: `Beat ${n}`, setId, label });
  }
  const frontAngle = uuid();
  const variant = (kind, value) => run(
    `INSERT INTO location_look_variants (world_location_id, scene_set_id, kind, value, status, source, image_url, source_angle_id, created_at, updated_at)
     VALUES (:loc, :loft, :kind, :value, 'complete', 'uploaded', :url, :angle, NOW(), NOW())`,
    { loc, loft, kind, value, url: `https://x/${value}.jpg`, angle: kind === 'season' ? frontAngle : null });
  const plan = async () => {
    const res = await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
    expect(res.status).toBe(200);
    return (n) => res.body.data.find((b) => b.beat_number === n).location.image;
  };

  beforeAll(async () => {
    await variantsMigration.up(sequelize.getQueryInterface(), Sequelize);
    await perSetMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-user-picking', email: 'u@picking.dev', name: 'Editor', groups: ['USER'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}', NOW(), NOW())`, { show, n: `picking-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Picking', :num, 'draft', NOW(), NOW())`,
      { ep, show, num: Math.floor(Math.random() * 100000) + 900 });
    await run(`INSERT INTO world_locations (id, name, description, created_at, updated_at) VALUES (:loc, 'Lala''s Loft', 'A loft.', NOW(), NOW())`, { loc });
    for (const [id, name] of [[loft, 'Loft'], [plain, 'Plain room']]) {
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
                 VALUES (:id, :name, 'HOME_BASE', :show, :loc, :base, 'complete', NOW(), NOW())`, { id, name, show, loc, base: `https://x/${name.replace(' ', '-')}-base.jpg` });
    }
    await run(`UPDATE world_locations SET approved_base_scene_set_id = :loft, approved_base_image_url = 'https://x/Loft-base.jpg' WHERE id = :loc`, { loft, loc });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:id, :loft, 'Front steps', 'ESTABLISHING', 'front', 'complete', 'https://x/front.jpg', '[]', 0, NOW(), NOW())`, { id: frontAngle, loft });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:id, :loft, 'Front door', 'DOORWAY', 'front', 'complete', 'https://x/door.jpg', '[]', 1, NOW(), NOW())`, { id: uuid(), loft });
    // An evening event in winter, used by the episode.
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, event_time, event_date, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, 'Winter Gala', 'invite', 'used', 6, '8:00 PM', '2026-12-12', :ep, NOW(), NOW())`, { id: uuid(), show, ep });
    await variant('time', 'golden_hour');
    await variant('time', 'night');
    await variant('season', 'winter');
    await beat(2, loft);
    await beat(10, loft, 'ESTABLISHING');
    await beat(11, loft);
    await beat(13, loft);
    await beat(3, plain);
    await beat(12, loft, 'DOORWAY');
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('before the event, the everyday look at golden hour; recap at night', async () => {
    const at = await plan();
    expect(at(2)).toMatchObject({ url: 'https://x/golden_hour.jpg', source: 'variant_time', label: 'Loft · Inside · Golden hour', plain_url: 'https://x/Loft-base.jpg' });
    expect(at(13)).toMatchObject({ url: 'https://x/night.jpg', label: 'Loft · Inside · Night' });
  });

  it('the Front beat takes the winter variant; another Front angle keeps its own picture', async () => {
    const at = await plan();
    expect(at(10)).toMatchObject({ url: 'https://x/winter.jpg', source: 'variant_season', label: 'Loft · Front steps · Winter' });
    expect(at(12)).toEqual({ url: 'https://x/door.jpg', source: 'angle', label: 'Loft · Front door' });
  });

  it('a missing variant keeps the plain picture and names the gap; another set is untouched', async () => {
    const at = await plan();
    expect(at(11)).toMatchObject({ url: 'https://x/Loft-base.jpg', source: 'base', label: 'Loft · Inside (no Evening variant yet)' });
    expect(at(11).variant_missing).toMatchObject({ value: 'evening', text: 'Loft has no Evening variant yet' });
    expect(at(3)).toEqual({ url: 'https://x/Plain-room-base.jpg', source: 'base', label: 'Plain room · Inside' });
  });
});
