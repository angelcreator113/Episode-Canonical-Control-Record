/**
 * Scene Sets fourth audit (2026-10-15), looks findings, on the test database:
 *  1. an episode lost its look while the look was being made again;
 *  2. a generated season variant was used after its Front view changed;
 *  3. deleting a set with a replacement left its events' looks behind;
 *  4. an event whose episode is another event's showed that event's dressing;
 *  5. a look made at the event's old venue was still used, and made there;
 *  7. an accepted episode's look was dropped when the venue's base changed;
 *  8. setting the show's lead to None wiped its home and closet;
 *  9. a character's home was deleted with no warning, and a deleted default
 *     home read as "no saved default".
 * (6 and 10 are on the page: DressedAngles and the Looks row.)
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { episodeLooks } = require('../../src/services/dressedAngleService');
const { listVariants } = require('../../src/services/locationLookVariantService');
const { variantsForSets } = require('../../src/services/lookVariantPicking');
const { resolveLookSet, eventsForSets } = require('../../src/services/venueLookImageService');
const { countUses, moveUses } = require('../../src/services/sceneSetUsesService');
const { proposeLocations } = require('../../src/services/episodeLocationsService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Scene Sets looks fixes (fourth audit)', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function show(metadata = {}) {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, CAST(:m AS json), NOW(), NOW())`,
      { id, name: `Looks4 ${id.slice(0, 8)}`, slug: `looks4-${id.slice(0, 8)}`, m: JSON.stringify(metadata) });
    return id;
  }
  async function location(fields = {}) {
    const [[l]] = await sequelize.query(
      `INSERT INTO world_locations (id, name, location_type, approved_base_scene_set_id, approved_base_image_url, created_at, updated_at)
       VALUES (gen_random_uuid(), :name, 'interior', :setId, :url, NOW(), NOW()) RETURNING id`,
      { replacements: { name: fields.name || 'Venue', setId: fields.setId || null, url: fields.url || null } });
    return l.id;
  }
  async function set(showId, fields = {}) {
    const s = await models.SceneSet.create({ name: fields.name || `Set ${uuid().slice(0, 6)}`, scene_type: 'EVENT_LOCATION', generation_status: 'complete', show_id: showId, base_still_url: 'https://x/base.jpg', ...fields });
    return s.id;
  }
  async function episode(showId, fields = {}) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:id, :showId, 'Looks4', 1, 'draft', :ev, NOW(), NOW())`, { id, showId, ev: fields.evaluation_status || null });
    return id;
  }
  async function event(showId, fields = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, scene_set_id, venue_location_id, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :showId, :name, 'invite', 'ready', :setId, :venue, :ep, NOW() + (:order || ' seconds')::interval, NOW())`,
      { id, showId, name: fields.name || 'Party', setId: fields.setId || null, venue: fields.venue || null, ep: fields.episodeId || null, order: String(fields.order || 0) });
    return id;
  }
  async function look(setId, eventId, fields = {}) {
    const [[l]] = await sequelize.query(
      `INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, source, image_url, brief, error, created_at, updated_at)
       VALUES (gen_random_uuid(), :setId, :eventId, :status, :source, :url, CAST(:brief AS jsonb), :error, NOW(), NOW()) RETURNING id`,
      { replacements: { setId, eventId, status: fields.status || 'complete', source: fields.source || 'generated', url: fields.url === undefined ? 'https://x/look.jpg' : fields.url, brief: JSON.stringify(fields.brief || {}), error: fields.error || null } });
    return l.id;
  }

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-looks4', email: 'user@looks4.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('1, 7: the look stays in use while it is made again, and an accepted episode keeps its look', async () => {
    const showId = await show();
    const s = await set(showId);
    const loc = await location({ setId: s, url: 'https://x/everyday-1.jpg' });
    await run('UPDATE scene_sets SET world_location_id = :loc WHERE id = :s', { loc, s });
    const ep = await episode(showId);
    const ev = await event(showId, { setId: s, venue: loc, episodeId: ep });
    const lk = await look(s, ev, { status: 'generating', brief: { approved_base: { image_url: 'https://x/everyday-1.jpg' } } });
    expect((await episodeLooks(sequelize, ep)).get(s)).toMatchObject({ id: lk });

    // A new everyday look: a draft episode stops using the old look...
    await run(`UPDATE scene_set_looks SET status = 'complete' WHERE id = :lk`, { lk });
    await run(`UPDATE world_locations SET approved_base_image_url = 'https://x/everyday-2.jpg' WHERE id = :loc`, { loc });
    expect((await episodeLooks(sequelize, ep)).has(s)).toBe(false);
    // ...an accepted one keeps it: its Place is locked.
    await run(`UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep`, { ep });
    expect((await episodeLooks(sequelize, ep)).get(s)).toMatchObject({ id: lk });
  });

  it('5: a look made at the old venue is not used, and the next look is made at the new venue', async () => {
    const showId = await show();
    const oldSet = await set(showId, { name: 'Old hall' });
    const oldLoc = await location({ name: 'Old venue' });
    const newLoc = await location({ name: 'New venue' });
    await run('UPDATE scene_sets SET world_location_id = :oldLoc WHERE id = :oldSet', { oldLoc, oldSet });
    const newSet = await set(showId, { name: 'New hall' });
    await run('UPDATE scene_sets SET world_location_id = :newLoc WHERE id = :newSet', { newLoc, newSet });
    const ep = await episode(showId);
    const ev = await event(showId, { setId: oldSet, venue: oldLoc, episodeId: ep });
    await look(oldSet, ev, { source: 'uploaded' });
    expect((await episodeLooks(sequelize, ep)).has(oldSet)).toBe(true);

    await run('UPDATE world_events SET venue_location_id = :newLoc WHERE id = :ev', { newLoc, ev });
    expect((await episodeLooks(sequelize, ep)).has(oldSet)).toBe(false);
    const [eventRow] = await rows('SELECT * FROM world_events WHERE id = :ev', { ev });
    expect(await resolveLookSet(sequelize, eventRow)).toMatchObject({ kind: 'set', set: { id: newSet }, link: true });
    const place = await auth(request(app).get(`/api/v1/world/${showId}/events/${ev}/look`));
    expect(place.body.data.venue_changed).toBe(true);
  });

  it('4: only the episode\'s own event is marked as its event', async () => {
    const showId = await show();
    const s = await set(showId);
    const ep = await episode(showId);
    // The episode's brief names one event; another carries the episode's stamp.
    const named = await event(showId, { name: 'Named', setId: s });
    const stamped = await event(showId, { name: 'Stamped', setId: s, episodeId: ep });
    let byId = new Map((await eventsForSets(sequelize, [s])).get(s).map((e) => [e.id, e]));
    expect(byId.get(stamped).is_episode_event).toBe(true);
    await run(`INSERT INTO episode_briefs (id, episode_id, event_id, status, created_at, updated_at) VALUES (:id, :ep, :named, 'draft', NOW(), NOW())`,
      { id: uuid(), ep, named });
    byId = new Map((await eventsForSets(sequelize, [s])).get(s).map((e) => [e.id, e]));
    expect(byId.get(stamped).is_episode_event).toBe(false);
    expect(byId.get(named).is_episode_event).toBe(false);
  });

  it('2: a generated season of a Front view since made again is stale and not picked', async () => {
    const showId = await show();
    const s = await set(showId);
    const loc = await location({ setId: s, url: 'https://x/base.jpg' });
    await run('UPDATE scene_sets SET world_location_id = :loc WHERE id = :s', { loc, s });
    const front = await models.SceneAngle.create({ scene_set_id: s, angle_label: 'ESTABLISHING', angle_name: 'Front', angle_kind: 'front', generation_status: 'complete', still_image_url: 'https://x/front-1.jpg' });
    await run(`INSERT INTO location_look_variants (id, world_location_id, scene_set_id, kind, value, status, source, image_url, source_image_url, source_angle_id, created_at, updated_at)
               VALUES (gen_random_uuid(), :loc, :s, 'season', 'winter', 'complete', 'generated', 'https://x/winter.jpg', 'https://x/front-1.jpg', :a, NOW(), NOW())`,
      { loc, s, a: front.id });
    const winter = async () => (await listVariants(sequelize, s)).season.find((x) => x.value === 'winter').variant;
    expect((await winter()).stale).toBe(false);
    expect((await variantsForSets(sequelize, [s])).get(s).season.has('winter')).toBe(true);

    await front.update({ still_image_url: 'https://x/front-2.jpg' });
    expect((await winter()).stale).toBe(true);
    expect((await variantsForSets(sequelize, [s])).get(s)?.season.has('winter') || false).toBe(false);
  });

  it('3, 9: a replacement takes the events\' looks and the characters\' places; deleting counts the places', async () => {
    const showId = await show();
    const from = await set(showId, { name: 'Old loft' });
    const to = await set(showId, { name: 'New loft' });
    const ev = await event(showId, { setId: from });
    const lk = await look(from, ev, { source: 'uploaded' });
    const [[reg]] = await sequelize.query(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (gen_random_uuid(), 'Cast', :showId, NOW(), NOW()) RETURNING id`, { replacements: { showId } });
    const [[jade]] = await sequelize.query(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at) VALUES (gen_random_uuid(), :reg, :key, 'Jade', NOW(), NOW()) RETURNING id`, { replacements: { reg: reg.id, key: `jade-${uuid().slice(0, 6)}` } });
    await run(`INSERT INTO character_places (id, registry_character_id, scene_set_id, role, created_at, updated_at) VALUES (gen_random_uuid(), :c, :from, 'home', NOW(), NOW())`, { c: jade.id, from });

    expect(await countUses(sequelize, from)).toMatchObject({ homes: 1, events: 1 });
    const blocked = await auth(request(app).delete(`/api/v1/scene-sets/${from}`));
    expect(blocked.status).toBe(409);
    expect(blocked.body.uses.homes).toBe(1);

    const moved = await sequelize.transaction((transaction) => moveUses(sequelize, from, to, { transaction }));
    expect(moved).toMatchObject({ events: 1, looks: 1, homes: 1 });
    expect((await rows('SELECT scene_set_id FROM scene_set_looks WHERE id = :lk', { lk }))[0].scene_set_id).toBe(to);
    expect((await rows('SELECT scene_set_id FROM character_places WHERE registry_character_id = :c AND deleted_at IS NULL', { c: jade.id }))[0].scene_set_id).toBe(to);
  });

  it('8, 9: clearing the lead keeps the show\'s home and closet; a deleted default home is named', async () => {
    const home = uuid();
    const closet = uuid();
    const showId = await show();
    await set(showId, { id: home, name: 'Loft' });
    await set(showId, { id: closet, name: 'Closet' });
    const [[reg]] = await sequelize.query(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (gen_random_uuid(), 'Cast', :showId, NOW(), NOW()) RETURNING id`, { replacements: { showId } });
    const [[lala]] = await sequelize.query(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at) VALUES (gen_random_uuid(), :reg, :key, 'Lala', NOW(), NOW()) RETURNING id`, { replacements: { reg: reg.id, key: `lala-${uuid().slice(0, 6)}` } });
    await run(`UPDATE shows SET metadata = CAST(:m AS json) WHERE id = :showId`,
      { showId, m: JSON.stringify({ lead_character_id: lala.id, scene_defaults: { home_set_id: home, closet_set_id: closet } }) });

    const cleared = await auth(request(app).put(`/api/v1/shows/${showId}/lead-character`)).send({ character_id: null });
    expect(cleared.status).toBe(200);
    const meta = (await rows('SELECT metadata FROM shows WHERE id = :showId', { showId }))[0].metadata;
    const m = typeof meta === 'string' ? JSON.parse(meta) : meta;
    expect(m.scene_defaults).toEqual({ home_set_id: home, closet_set_id: closet });

    await run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :home', { home });
    const proposal = await proposeLocations(sequelize, { showId, event: null });
    expect(proposal.missing).toContain('home');
    expect(proposal.removed).toEqual(['home']);
  });
});
