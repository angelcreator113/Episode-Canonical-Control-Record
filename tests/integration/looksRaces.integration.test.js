/**
 * Scene Sets re-audit (2026-10-15), looks:
 *  - a late generated look (or dressed angle) overwrote a newer upload;
 *  - a second "Generate this look" while one ran paid again;
 *  - another show's set at a shared venue took this show's look;
 *  - a look's dressed angles outlived the image they were cut from;
 *  - a dressed angle stuck generating was never released;
 *  - a generated look made from a base no longer approved was still shown.
 * On the migrated test database; the image call and S3 are stubbed.
 */
jest.unmock('uuid');
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const looks = require('../../src/services/venueLookImageService');
const dressed = require('../../src/services/dressedAngleService');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');
const lookAnglesMigration = require('../../src/migrations/20261002150000-create-scene-set-look-angles');
const sourceMigration = require('../../src/migrations/20261015140000-add-scene-set-looks-source');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Looks: races, scope and stale pictures', () => {
  const show = uuid();
  const otherShow = uuid();

  async function location(approvedUrl = 'https://x/everyday.jpg') {
    const id = uuid();
    await run(`INSERT INTO world_locations (id, name, description, approved_base_image_url, created_at, updated_at)
               VALUES (:id, 'The Glasshouse', 'A glass conservatory.', :approvedUrl, NOW(), NOW())`, { id, approvedUrl });
    return id;
  }
  async function sceneSet(locationId, { showId = show, name = 'Glasshouse Hall' } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', :showId, :locationId, 'https://x/everyday.jpg', 'complete', NOW(), NOW())`,
    { id, name, showId, locationId });
    return id;
  }
  async function event(locationId, sceneSetId = null, extra = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, venue_name, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, 'Velour Gala', 'invite', 'ready', 6, :locationId, 'The Glasshouse', :sceneSetId, :episodeId, NOW(), NOW())`,
    { id, show, locationId, sceneSetId, episodeId: extra.episodeId || null });
    return id;
  }
  async function approvedVenue() {
    const loc = await location();
    const set = await sceneSet(loc);
    await run('UPDATE world_locations SET approved_base_scene_set_id = :set WHERE id = :loc', { set, loc });
    return { loc, set };
  }
  const lookOf = async (ev) => (await rows('SELECT * FROM scene_set_looks WHERE event_id = :ev AND deleted_at IS NULL', { ev }))[0];

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    await looksMigration.up(qi, Sequelize);
    await lookAnglesMigration.up(qi, Sequelize);
    await sourceMigration.up(qi, Sequelize);
    for (const [id, name] of [[show, 'Looks races'], [otherShow, 'Other show']]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
        { id, name: `${name} ${id.slice(0, 8)}`, slug: `looks-${id.slice(0, 8)}` });
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('a generation that lands after an upload does not replace it', async () => {
    const { loc, set } = await approvedVenue();
    const ev = await event(loc, set);
    let finish;
    jest.spyOn(sceneGen, 'generateDressedStill').mockImplementation(() => new Promise((resolve) => {
      finish = () => resolve({ stillUrl: 'https://x/late.jpg', cost: 0.04 });
    }));
    const { run: generate } = await looks.startLook(models, { showId: show, eventId: ev });
    const pending = generate();
    await looks.uploadLook(models, { showId: show, eventId: ev, storeImage: async () => 'https://x/mine.jpg' });
    finish();
    await pending;
    expect(await lookOf(ev)).toMatchObject({ status: 'complete', source: 'uploaded', image_url: 'https://x/mine.jpg' });
  });

  it('a second start while the look generates is refused, nothing paid again; a stuck one can be restarted', async () => {
    const { loc, set } = await approvedVenue();
    const ev = await event(loc, set);
    const spy = jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValue({ stillUrl: 'https://x/g.jpg', cost: 0.04 });
    await looks.startLook(models, { showId: show, eventId: ev });
    await expect(looks.startLook(models, { showId: show, eventId: ev })).rejects.toMatchObject({ status: 409, code: 'LOOK_GENERATING' });
    expect(spy).not.toHaveBeenCalled();
    await run(`UPDATE scene_set_looks SET updated_at = NOW() - INTERVAL '20 minutes' WHERE event_id = :ev`, { ev });
    await expect(looks.startLook(models, { showId: show, eventId: ev })).resolves.toMatchObject({ result: { look_id: expect.any(String) } });
  });

  it('another show\'s set at a shared venue is neither used nor offered', async () => {
    const loc = await location();
    const theirs = await sceneSet(loc, { showId: otherShow, name: 'Their Hall' });
    const ev = await event(loc);
    const { scene_set_id } = await looks.uploadLook(models, { showId: show, eventId: ev, storeImage: async () => 'https://x/mine.jpg' });
    expect(scene_set_id).not.toBe(theirs);
    const [made] = await rows('SELECT show_id FROM scene_sets WHERE id = :id', { id: scene_set_id });
    expect(made.show_id).toBe(show);
  });

  it('a new look image retires the dressed angles cut from the old one', async () => {
    const { loc, set } = await approvedVenue();
    const ev = await event(loc, set);
    const { look } = await looks.uploadLook(models, { showId: show, eventId: ev, storeImage: async () => 'https://x/first.jpg' });
    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, gen_random_uuid(), 'complete', 'https://x/dressed.jpg', 'generated', NOW(), NOW())`, { look: look.id });
    await looks.uploadLook(models, { showId: show, eventId: ev, storeImage: async () => 'https://x/second.jpg' });
    const live = await rows('SELECT id FROM scene_set_look_angles WHERE look_id = :look AND deleted_at IS NULL', { look: look.id });
    expect(live).toHaveLength(0);
  });

  it('a dressed angle stuck generating is released as failed', async () => {
    const { loc, set } = await approvedVenue();
    const ev = await event(loc, set);
    const { look } = await looks.uploadLook(models, { showId: show, eventId: ev, storeImage: async () => 'https://x/l.jpg' });
    const angle = uuid();
    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, :angle, 'generating', 'generated', NOW(), NOW() - INTERVAL '20 minutes')`, { look: look.id, angle });
    const map = await dressed.lookAngles(sequelize, [look.id]);
    expect(map.get(`${look.id}:${angle}`)).toMatchObject({ status: 'failed' });
  });

  it('a generated look on a set with no location of its own is shown (its venue is the brief\'s)', async () => {
    const loc = await location();
    const set = await sceneSet(null);
    const episodeId = uuid();
    const ev = await event(loc, set, { episodeId });
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, source, image_url, brief, created_at, updated_at)
               VALUES (gen_random_uuid(), :set, :ev, 'complete', 'generated', 'https://x/look.jpg',
                       CAST(:brief AS jsonb), NOW(), NOW())`,
    { set, ev, brief: JSON.stringify({ world_location_id: loc, approved_base: { image_url: 'https://x/everyday.jpg' } }) });
    expect((await dressed.episodeLooks(sequelize, episodeId)).get(set)).toMatchObject({ image_url: 'https://x/look.jpg' });
  });

  it('a generated look made from a base that is no longer approved is not shown on the episode', async () => {
    const { loc, set } = await approvedVenue();
    const episodeId = uuid();
    const ev = await event(loc, set, { episodeId });
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, source, image_url, brief, created_at, updated_at)
               VALUES (gen_random_uuid(), :set, :ev, 'complete', 'generated', 'https://x/look.jpg',
                       CAST(:brief AS jsonb), NOW(), NOW())`,
    { set, ev, brief: JSON.stringify({ approved_base: { image_url: 'https://x/everyday.jpg' } }) });
    expect((await dressed.episodeLooks(sequelize, episodeId)).get(set)).toMatchObject({ image_url: 'https://x/look.jpg' });
    await run(`UPDATE world_locations SET approved_base_image_url = 'https://x/new-everyday.jpg' WHERE id = :loc`, { loc });
    expect((await dressed.episodeLooks(sequelize, episodeId)).get(set)).toBeUndefined();
    // The lists say so, as the episode does (audit, 2026-10-15).
    expect((await looks.looksForSets(sequelize, [set])).get(set)[0]).toMatchObject({ stale: true });
    expect((await looks.eventLook(sequelize, { showId: show, eventId: ev })).look).toMatchObject({ stale: true });
  });

  it('a failed re-run keeps the previous look in use, with the error', async () => {
    const { loc, set } = await approvedVenue();
    const episodeId = uuid();
    const ev = await event(loc, set, { episodeId });
    jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValueOnce({ stillUrl: 'https://x/good.jpg', cost: 0.04 });
    await (await looks.startLook(models, { showId: show, eventId: ev })).run();
    expect(await lookOf(ev)).toMatchObject({ status: 'complete', image_url: 'https://x/good.jpg' });
    expect((await looks.looksForSets(sequelize, [set])).get(set)[0]).toMatchObject({ stale: false });

    sceneGen.generateDressedStill.mockRejectedValueOnce(new Error('Kontext refused'));
    await (await looks.startLook(models, { showId: show, eventId: ev })).run();
    expect(await lookOf(ev)).toMatchObject({ status: 'complete', image_url: 'https://x/good.jpg', error: 'Kontext refused' });
    expect((await dressed.episodeLooks(sequelize, episodeId)).get(set)).toMatchObject({ image_url: 'https://x/good.jpg' });
  });

  it('a failed re-run of a stale look keeps it stale; of an uploaded look, keeps it uploaded', async () => {
    // Fourth audit (2026-10-15): the claim wrote the new brief and
    // source = 'generated' before the run had an image.
    const { loc, set } = await approvedVenue();
    const episodeId = uuid();
    const ev = await event(loc, set, { episodeId });
    jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValueOnce({ stillUrl: 'https://x/old-room.jpg', cost: 0.04 });
    await (await looks.startLook(models, { showId: show, eventId: ev })).run();
    await run(`UPDATE world_locations SET approved_base_image_url = 'https://x/new-everyday.jpg' WHERE id = :loc`, { loc });
    await run(`UPDATE scene_sets SET base_still_url = 'https://x/new-everyday.jpg' WHERE id = :set`, { set });
    expect((await dressed.episodeLooks(sequelize, episodeId)).get(set)).toBeUndefined();
    sceneGen.generateDressedStill.mockRejectedValueOnce(new Error('Kontext refused'));
    await (await looks.startLook(models, { showId: show, eventId: ev })).run();
    expect(await lookOf(ev)).toMatchObject({ status: 'complete', image_url: 'https://x/old-room.jpg', error: 'Kontext refused' });
    // Still made from the old base: not used, and the list says stale.
    expect((await dressed.episodeLooks(sequelize, episodeId)).get(set)).toBeUndefined();
    expect((await looks.looksForSets(sequelize, [set])).get(set)[0]).toMatchObject({ stale: true });

    const ev2 = await event(loc, set);
    await looks.uploadLook(models, { showId: show, eventId: ev2, storeImage: async () => 'https://x/mine.jpg' });
    sceneGen.generateDressedStill.mockRejectedValueOnce(new Error('Kontext refused'));
    await (await looks.startLook(models, { showId: show, eventId: ev2 })).run();
    expect(await lookOf(ev2)).toMatchObject({ status: 'complete', source: 'uploaded', image_url: 'https://x/mine.jpg' });
  });

  it('a dressed angle re-run keeps its previous image until it has a new one; stuck, it keeps it', async () => {
    const { loc, set } = await approvedVenue();
    const ev = await event(loc, set);
    const { look } = await looks.uploadLook(models, { showId: show, eventId: ev, storeImage: async () => 'https://x/l.jpg' });
    const angle = uuid();
    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, :angle, 'generating', 'https://x/old-dressed.jpg', 'generated', NOW(), NOW() - INTERVAL '20 minutes')`, { look: look.id, angle });
    const map = await dressed.lookAngles(sequelize, [look.id]);
    expect(map.get(`${look.id}:${angle}`)).toMatchObject({ status: 'complete', image_url: 'https://x/old-dressed.jpg' });
  });
});
