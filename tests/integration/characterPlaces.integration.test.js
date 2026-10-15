/**
 * Character homes (Evoni, 2026-10-15: linking a venue to a character as
 * their home; "Lead character is Lala but other characters have home sets";
 * step 3 of docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md), on the migrated
 * database through the real routes.
 * - The show's characters are those in its registries; the show names a lead.
 * - The lead's home and closet are the show's scene defaults (L3).
 * - Another character has one home and one closet (a new one replaces) and
 *   any number of other places with a label.
 * - A set of another show, a character of another show and a bad role are
 *   refused; unlinking the lead's home clears the default.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261015160000-create-character-places');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Character homes', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function show() {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id, name: `Homes ${id.slice(0, 8)}`, slug: `homes-${id.slice(0, 8)}` });
    const registry = uuid();
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:registry, 'Cast', :id, NOW(), NOW())`, { registry, id });
    const character = async (name) => {
      const cid = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
                 VALUES (:cid, :registry, :key, :name, NOW(), NOW())`, { cid, registry, key: `${name.toLowerCase()}-${cid.slice(0, 6)}`, name });
      return cid;
    };
    const set = async (name, showId = id) => {
      const sid = uuid();
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at)
                 VALUES (:sid, :name, 'HOME_BASE', :showId, 'pending', NOW(), NOW())`, { sid, name, showId });
      return sid;
    };
    return { id, character, set };
  }
  const places = (showId) => auth(request(app).get(`/api/v1/shows/${showId}/character-places`));
  const link = (showId, body) => auth(request(app).post(`/api/v1/shows/${showId}/character-places`)).send(body);
  const defaults = async (showId) => {
    const [s] = await rows('SELECT metadata FROM shows WHERE id = :showId', { showId });
    const m = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata;
    return m;
  };

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-homes', email: 'user@homes.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable', async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const cols = await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'character_places'`);
    expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['registry_character_id', 'scene_set_id', 'role', 'label', 'deleted_at']));
  });

  it('lists the show\'s characters; the lead\'s home and closet are the show\'s defaults', async () => {
    const s = await show();
    const lala = await s.character('Lala');
    await s.character('Jade');
    const loft = await s.set('Loft');
    const closet = await s.set('Closet');

    const empty = await places(s.id);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toMatchObject({ lead_character_id: null });
    expect(empty.body.data.characters.map((c) => c.name)).toEqual(['Jade', 'Lala']);

    const lead = await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: lala });
    expect(lead.body.data).toEqual({ lead_character_id: lala });

    await link(s.id, { character_id: lala, scene_set_id: loft, role: 'home' });
    const res = await link(s.id, { character_id: lala, scene_set_id: closet, role: 'closet' });
    expect(res.status).toBe(200);
    expect((await defaults(s.id)).scene_defaults).toEqual({ home_set_id: loft, closet_set_id: closet });
    expect(await rows('SELECT * FROM character_places WHERE registry_character_id = :lala', { lala })).toHaveLength(0);
    const l = res.body.data.characters.find((c) => c.id === lala);
    expect(l).toMatchObject({ is_lead: true });
    expect(l.places.map((p) => [p.role, p.scene_set_id, p.source])).toEqual([['home', loft, 'show_default'], ['closet', closet, 'show_default']]);

    // Unlinking her home clears the default.
    const un = await auth(request(app).post(`/api/v1/shows/${s.id}/character-places/unlink`)).send({ character_id: lala, scene_set_id: loft, role: 'home' });
    expect(un.status).toBe(200);
    expect((await defaults(s.id)).scene_defaults.home_set_id).toBeNull();
  });

  it('another character: one home (a new one replaces it), other places with a label, unlink', async () => {
    const s = await show();
    const jade = await s.character('Jade');
    const flat = await s.set('Jade flat');
    const penthouse = await s.set('Penthouse');
    const studio = await s.set('Studio');

    await link(s.id, { character_id: jade, scene_set_id: flat, role: 'home' });
    await link(s.id, { character_id: jade, scene_set_id: studio, role: 'other', label: 'Studio' });
    const res = await link(s.id, { character_id: jade, scene_set_id: penthouse, role: 'home' });
    const j = res.body.data.characters.find((c) => c.id === jade);
    expect(j.places.map((p) => [p.role, p.scene_set_id, p.label])).toEqual(expect.arrayContaining([['home', penthouse, null], ['other', studio, 'Studio']]));
    expect(j.places.some((p) => p.scene_set_id === flat)).toBe(false);
    expect((await defaults(s.id)).scene_defaults).toBeUndefined();

    const un = await auth(request(app).post(`/api/v1/shows/${s.id}/character-places/unlink`)).send({ character_id: jade, scene_set_id: studio, role: 'other' });
    expect(un.body.data.characters.find((c) => c.id === jade).places.map((p) => p.scene_set_id)).toEqual([penthouse]);
  });

  it('refuses a set of another show, a character of another show, a bad role and an unknown show', async () => {
    const s = await show();
    const other = await show();
    const jade = await s.character('Jade');
    const stranger = await other.character('Stranger');
    const foreignSet = await other.set('Elsewhere');
    const mine = await s.set('Mine');

    expect((await link(s.id, { character_id: jade, scene_set_id: foreignSet, role: 'home' })).status).toBe(400);
    expect((await link(s.id, { character_id: stranger, scene_set_id: mine, role: 'home' })).status).toBe(404);
    expect((await link(s.id, { character_id: jade, scene_set_id: mine, role: 'garage' })).status).toBe(400);
    expect((await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: stranger })).status).toBe(404);
    expect((await places(uuid())).status).toBe(404);
  });

  it('changing the lead moves the homes with the people', async () => {
    const s = await show();
    const lala = await s.character('Lala');
    const marcus = await s.character('Marcus');
    const loft = await s.set('Loft');
    const penthouse = await s.set('Penthouse');
    await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: lala });
    await link(s.id, { character_id: lala, scene_set_id: loft, role: 'home' });
    await link(s.id, { character_id: marcus, scene_set_id: penthouse, role: 'home' });

    const res = await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: marcus });
    expect(res.status).toBe(200);
    const m = await defaults(s.id);
    expect(m.lead_character_id).toBe(marcus);
    expect(m.scene_defaults).toEqual({ home_set_id: penthouse, closet_set_id: null });

    const list = (await places(s.id)).body.data.characters;
    expect(list.find((c) => c.id === marcus).places.map((p) => [p.role, p.scene_set_id, p.source])).toEqual([['home', penthouse, 'show_default']]);
    expect(list.find((c) => c.id === lala).places.map((p) => [p.role, p.scene_set_id, p.source])).toEqual([['home', loft, 'character']]);

    // And back: Lala's home is the default again; Marcus keeps his.
    await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: lala });
    expect((await defaults(s.id)).scene_defaults.home_set_id).toBe(loft);
    expect((await places(s.id)).body.data.characters.find((c) => c.id === marcus).places.map((p) => p.scene_set_id)).toEqual([penthouse]);
  });

  it('an old lead whose home is also her closet keeps it as her home', async () => {
    const s = await show();
    const lala = await s.character('Lala');
    const marcus = await s.character('Marcus');
    const loft = await s.set('Loft');
    await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: lala });
    await link(s.id, { character_id: lala, scene_set_id: loft, role: 'home' });
    await link(s.id, { character_id: lala, scene_set_id: loft, role: 'closet' });
    expect((await defaults(s.id)).scene_defaults).toEqual({ home_set_id: loft, closet_set_id: loft });
    await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: marcus });
    expect(await rows('SELECT role FROM character_places WHERE registry_character_id = :lala AND deleted_at IS NULL', { lala })).toEqual([{ role: 'home' }]);
  });

  it('saving the lead\'s home merges into the show\'s metadata and is refused when the lead changed meanwhile', async () => {
    const { saveSceneDefaults } = require('../../src/services/episodeLocationsService');
    const s = await show();
    const lala = await s.character('Lala');
    const marcus = await s.character('Marcus');
    const loft = await s.set('Loft');
    await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: lala });
    await run(`UPDATE shows SET metadata = (metadata::jsonb || '{"other_key": 1}'::jsonb)::json WHERE id = :id`, { id: s.id });
    await saveSceneDefaults(sequelize, { showId: s.id, body: { home_set_id: loft }, leadCharacterId: lala });
    expect(await defaults(s.id)).toMatchObject({ lead_character_id: lala, other_key: 1, scene_defaults: { home_set_id: loft } });
    // A save made for a lead who is no longer the lead (here Marcus, read
    // before the lead changed) is refused, not written over the new lead.
    await expect(saveSceneDefaults(sequelize, { showId: s.id, body: { home_set_id: null }, leadCharacterId: marcus }))
      .rejects.toMatchObject({ status: 409, code: 'LEAD_CHANGED' });
    expect((await defaults(s.id)).scene_defaults.home_set_id).toBe(loft);
  });

  it('a malformed id is a 400, not a server error', async () => {
    const s = await show();
    const jade = await s.character('Jade');
    expect((await places('not-an-id')).status).toBe(400);
    expect((await link(s.id, { character_id: jade, scene_set_id: 'nope', role: 'home' })).status).toBe(400);
    expect((await auth(request(app).put(`/api/v1/shows/${s.id}/lead-character`)).send({ character_id: 'nope' })).status).toBe(400);
  });
});
