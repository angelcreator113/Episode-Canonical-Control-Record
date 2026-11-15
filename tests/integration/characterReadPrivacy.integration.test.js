/**
 * Character privacy (Evoni's ruling of 2026-11-15), against the test database.
 *
 * A feed profile, a registry character and a story pair each hold production
 * material beside what the audience sees: the private reality behind a
 * persona, secret connections, wounds, writer's notes, who knows what. Before
 * this, two profile reads answered a request with no token with the whole row,
 * and every signed-in account could read the rest.
 *
 * One profile, one character and one pair are seeded with a marker in every
 * free-text and JSON column (the marker names the column). Then, as a request
 * with no token, a viewer, an editor and an ADMIN:
 *   - the two open profile reads give exactly the public columns to anyone
 *     who is not an ADMIN, and no marker of any other column, whatever the
 *     search, filter, sort or id;
 *   - every production read is an ADMIN's: 401 with no token, 403 for a
 *     viewer and an editor, and never a marker in the refusal;
 *   - an ADMIN reads them as before;
 *   - The Pulse's own reads still answer a viewer, without a marker of a
 *     private column.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { PUBLIC_PROFILE_FIELDS, publicProfile } = require('../../src/services/publicSocialProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const MARK = 'ZZPRIV';
const markersIn = (body) => [...new Set((JSON.stringify(body || {}).match(new RegExp(`${MARK}:[a-z_0-9]+`, 'g')) || []).map((m) => m.slice(MARK.length + 1)))];

/** A marker naming the column, for every free-text and JSON column of a model. */
function markerValues(Model, skip) {
  const out = {};
  for (const [name, attr] of Object.entries(Model.rawAttributes)) {
    if (skip.includes(name) || attr.primaryKey || attr.references) continue;
    if (/(_id|_at|_url|_key)$/.test(name) || ['status', 'platform', 'feed_layer', 'city', 'world'].includes(name)) continue;
    const tag = `${MARK}:${name}`;
    if (attr.type instanceof DataTypes.TEXT) out[name] = tag;
    else if (attr.type instanceof DataTypes.STRING) { if ((attr.type._length || 255) >= tag.length && !attr.validate) out[name] = tag; }
    else if (attr.type instanceof DataTypes.JSONB || attr.type instanceof DataTypes.JSON) out[name] = { nested: { note: tag }, list: [tag] };
  }
  return out;
}

/** Creates the row with as many marked columns as the table takes (a database enum or check refuses some). */
async function createMarked(Model, base, marked) {
  const values = { ...marked, ...base };
  for (let i = 0; i < 400; i += 1) {
    try { return await Model.create(values); } catch (err) {
      const all = `${err.parent?.message || ''} ${err.message || ''}`;
      const bad = (err.errors || []).map((e) => e.path).filter((p) => p && !(p in base));
      const named = new RegExp(`${MARK}:([a-z_0-9]+)`).exec(all) || /column "([a-z_0-9]+)"/.exec(all);
      if (named && !(named[1] in base)) bad.push(named[1]);
      if (!bad.length) { const next = Object.keys(values).find((k) => !(k in base)); if (!next) throw err; bad.push(next); }
      for (const p of bad) delete values[p];
    }
  }
  throw new Error('the marked row could not be made');
}

(shouldSkip ? describe.skip : describe)('character privacy: who reads profiles, characters and pairs', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const HANDLE = `priv.${tag}`;
  const KEY = `priv-${tag}`;
  const showId = crypto.randomUUID();
  let profile; let registry; let character; let other; let pair;
  let ipN = 0;
  const tokens = {};
  const as = (who, req) => {
    ipN += 1;
    const r = req.set('X-Forwarded-For', `198.51.${100 + Math.floor(ipN / 200)}.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const get = (who, path) => as(who, request(app).get(path));
  const NOT_ADMIN = ['anon', 'viewer', 'editor'];
  const PRIVATE = ['private_reality', 'secret_connections', 'lifestyle_reality', 'what_it_costs_her'];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@privacy.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await sequelize.query(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:showId, :name, :slug, NOW(), NOW())`,
      { replacements: { showId, name: `Privacy ${tag}`, slug: `privacy-${tag}` } });
    profile = await createMarked(models.SocialProfile,
      { handle: HANDLE, platform: 'lalaverse', display_name: `Public Name ${tag}`, vibe_sentence: `Public line ${tag}`, public_persona: `Public persona ${tag}`, feed_layer: 'lalaverse', status: 'generated' },
      markerValues(models.SocialProfile, ['handle', 'display_name', 'vibe_sentence', 'public_persona']));
    registry = await models.CharacterRegistry.create({ title: `Privacy registry ${tag}`, ...(models.CharacterRegistry.rawAttributes.show_id ? { show_id: showId } : {}) });
    character = await createMarked(models.RegistryCharacter,
      { registry_id: registry.id, character_key: KEY, display_name: `Character ${tag}`, feed_profile_id: profile.id },
      markerValues(models.RegistryCharacter, ['character_key', 'display_name']));
    other = await models.RegistryCharacter.create({ registry_id: registry.id, character_key: `${KEY}-b`, display_name: `Other ${tag}` });
    pair = await createMarked(models.CharacterRelationship,
      { character_id_a: character.id, character_id_b: other.id, relationship_type: 'friend' },
      markerValues(models.CharacterRelationship, ['relationship_type', 'connection_mode', 'lala_connection']));
  });

  afterAll(async () => {
    const run = (sql, replacements) => sequelize.query(sql, { replacements });
    if (pair) await run('DELETE FROM character_relationships WHERE id = :id', { id: pair.id });
    if (registry) {
      await run('DELETE FROM registry_characters WHERE registry_id = :id', { id: registry.id });
      await run('DELETE FROM character_registries WHERE id = :id', { id: registry.id });
    }
    if (profile) await run('DELETE FROM social_profiles WHERE id = :id', { id: profile.id });
    await run('DELETE FROM shows WHERE id = :showId', { showId });
  });

  test('the seed carries the private columns this test is about', async () => {
    const stored = await models.SocialProfile.findByPk(profile.id);
    for (const column of PRIVATE) expect(JSON.stringify(stored[column])).toContain(`${MARK}:${column}`);
    const made = await models.RegistryCharacter.findByPk(character.id);
    expect(markersIn(made.get({ plain: true })).length).toBeGreaterThan(40);
    expect(markersIn((await models.CharacterRelationship.findByPk(pair.id)).get({ plain: true })).length).toBeGreaterThan(3);
  });

  describe('the public face of a profile', () => {
    test('publicProfile keeps the listed columns and nothing else, whatever the row holds', () => {
      const cut = publicProfile({ id: 7, handle: 'h', private_reality: 'x', secret_connections: ['y'], full_profile: { z: 1 }, brand_new_column: 'later' });
      expect(Object.keys(cut).sort()).toEqual([...PUBLIC_PROFILE_FIELDS].sort());
      expect(cut).toMatchObject({ id: 7, handle: 'h', display_name: null });
      expect(JSON.stringify(cut)).not.toMatch(/private_reality|secret_connections|full_profile|brand_new_column/);
    });

    test.each(NOT_ADMIN)('%s: one profile by its id is its public columns only', async (who) => {
      const res = await get(who, `/api/v1/social-profiles/${profile.id}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['profile']);
      expect(Object.keys(res.body.profile).sort()).toEqual([...PUBLIC_PROFILE_FIELDS].sort());
      expect(res.body.profile).toMatchObject({ id: profile.id, handle: HANDLE, display_name: `Public Name ${tag}`, public_persona: `Public persona ${tag}` });
      expect(markersIn(res.body)).toEqual([]);
    });

    test.each(NOT_ADMIN)('%s: the list and a search are public columns only, with no followers, links or status counts', async (who) => {
      for (const qs of [`search=${HANDLE}`, `search=${HANDLE}&feed_layer=lalaverse&limit=5`, `search=${HANDLE}&sort=relevance&status=generated`]) {
        const res = await get(who, `/api/v1/social-profiles?${qs}`);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['pagination', 'profiles']);
        const mine = res.body.profiles.find((p) => p.id === profile.id);
        expect(mine).toBeDefined();
        for (const row of res.body.profiles) expect(Object.keys(row).sort()).toEqual([...PUBLIC_PROFILE_FIELDS].sort());
        expect(markersIn(res.body)).toEqual([]);
      }
    });

    test.each(NOT_ADMIN)('%s: a private column cannot be searched or filtered on', async (who) => {
      // The marker text is only in private columns: a search for it finds nothing.
      const byText = await get(who, `/api/v1/social-profiles?search=${MARK}`);
      expect(byText.status).toBe(200);
      expect(byText.body.profiles.find((p) => p.id === profile.id)).toBeUndefined();
      // Production filters are not honoured, so they tell nothing about what a private column holds.
      const base = (await get(who, `/api/v1/social-profiles?search=${HANDLE}`)).body.pagination.total;
      for (const filter of ['adult_content=true', 'relevance_min=9', 'archetype=nobody', 'follow_motivation=nobody', 'celebrity_tier=nobody', 'content_category=nobody']) {
        const res = await get(who, `/api/v1/social-profiles?search=${HANDLE}&${filter}`);
        expect(res.body.pagination.total).toBe(base);
        expect(markersIn(res.body)).toEqual([]);
      }
    });

    test.each(NOT_ADMIN)('%s: an unknown id is not found, and ids either side of it give nothing private', async (who) => {
      expect((await get(who, '/api/v1/social-profiles/2147480000')).status).toBe(404);
      for (const id of [profile.id - 1, profile.id + 1]) {
        const res = await get(who, `/api/v1/social-profiles/${id}`);
        expect([200, 404]).toContain(res.status);
        if (res.status === 200) expect(Object.keys(res.body.profile).sort()).toEqual([...PUBLIC_PROFILE_FIELDS].sort());
      }
    });

    test('an ADMIN reads the whole profile, the list with its counts, and the followers, as before', async () => {
      const one = await get('admin', `/api/v1/social-profiles/${profile.id}`);
      expect(one.status).toBe(200);
      expect(markersIn(one.body)).toEqual(expect.arrayContaining(PRIVATE));
      expect(one.body.profile.registry_character_id).toBe(character.id);
      const list = await get('admin', `/api/v1/social-profiles?search=${HANDLE}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveProperty('statusCounts');
      expect(markersIn(list.body)).toEqual(expect.arrayContaining(['private_reality', 'secret_connections']));
      expect((await get('admin', `/api/v1/social-profiles/${profile.id}/followers`)).status).toBe(200);
    });
  });

  // Every production read: its address for the seeded rows.
  const production = () => [
    // Feed profiles
    `/api/v1/social-profiles/export`,
    `/api/v1/social-profiles/${profile.id}/followers`,
    `/api/v1/social-profiles/${profile.id}/scene-context`,
    `/api/v1/social-profiles/follow-engine/evaluate/${profile.id}`,
    `/api/v1/social-profiles/follow-engine/stats`,
    `/api/v1/social-profiles/network`,
    `/api/v1/social-profiles/network/clusters`,
    `/api/v1/social-profiles/network/drama`,
    `/api/v1/social-profiles/${profile.id}/relationships`,
    `/api/v1/social-profiles/analytics/composition`,
    `/api/v1/social-profiles/moments/timeline`,
    `/api/v1/social-profiles/templates`,
    `/api/v1/social-profiles/relationships/suggestions`,
    `/api/v1/social-profiles/lala/close-friends?show_id=${showId}`,
    `/api/v1/social-profiles/${profile.id}/posting-schedule`,
    `/api/v1/social-profiles/mirror/self-portrait`,
    `/api/v1/social-profiles/feed`,
    `/api/v1/social-profiles/underground`,
    `/api/v1/social-profiles/bulk/jobs`,
    `/api/v1/social-profiles/bulk/jobs/1`,
    // The registry and a character's depth
    `/api/v1/character-registry/registries`,
    `/api/v1/character-registry/registries/default`,
    `/api/v1/character-registry/registries/${registry.id}`,
    `/api/v1/character-registry/characters/scene-context/${KEY}`,
    `/api/v1/character-registry/characters/${character.id}`,
    `/api/v1/character-registry/characters/${character.id}/plot-threads`,
    `/api/v1/character-depth/${character.id}`,
    // Story pairs, families, a person
    `/api/v1/relationships`,
    `/api/v1/relationships/character/${character.id}`,
    `/api/v1/relationships/cast`,
    `/api/v1/relationships/${pair.id}/events`,
    `/api/v1/relationships/type-tidy`,
    `/api/v1/relationships/drift`,
    `/api/v1/relationships/person/${character.id}`,
    `/api/v1/relationships/${pair.id}`,
    `/api/v1/families`,
    `/api/v1/families/people`,
    `/api/v1/families/character/${character.id}`,
    `/api/v1/families/make-character/suggestion`,
    `/api/v1/families/profile/${profile.id}`,
    `/api/v1/families/heritage`,
    `/api/v1/person/${character.id}`,
    // Cast
    `/api/v1/cast/consistency`,
    `/api/v1/cast/cross-check`,
    `/api/v1/cast/flag-log`,
    `/api/v1/cast/review`,
    ...['story-trail', 'facts', 'facts/history', 'check', 'appearance', 'typology', 'content-type', 'posts/ideas', 'appearances', 'gallery', 'places', 'secrets']
      .map((leaf) => `/api/v1/cast/characters/${character.id}/${leaf}`),
    `/api/v1/cast/content-pillars`,
    `/api/v1/cast/audience-map`,
    // Entanglements, feed pairs, follow tendencies, crossings
    `/api/v1/entanglements/characters/${character.id}/entanglements`,
    `/api/v1/entanglements/profiles/${profile.id}/orbit`,
    `/api/v1/entanglements/events`,
    `/api/v1/entanglements/events/${crypto.randomUUID()}`,
    `/api/v1/entanglements/characters/${character.id}/unfollows`,
    `/api/v1/feed-relationships/suggestions`,
    `/api/v1/feed-relationships`,
    `/api/v1/feed-relationships/canvas`,
    `/api/v1/feed-relationships/profiles`,
    `/api/v1/character-follows`,
    `/api/v1/character-follows/tensions/${KEY}/${KEY}-b`,
    `/api/v1/character-follows/${KEY}`,
    `/api/v1/character-follows/${KEY}/influence-context`,
    `/api/v1/character-crossings`,
    `/api/v1/character-crossings/tracker`,
  ];

  describe('production reads are an ADMIN\'s', () => {
    test('no token: 401 on every one, and nothing of the rows in the refusal', async () => {
      for (const path of production()) {
        const res = await get('anon', path);
        expect([path, res.status]).toEqual([path, 401]);
        expect(markersIn(res.body)).toEqual([]);
      }
    });

    test.each(['viewer', 'editor'])('%s: 403 on every one, and nothing of the rows in the refusal', async (who) => {
      for (const path of production()) {
        const res = await get(who, path);
        expect([path, res.status]).toEqual([path, 403]);
        expect(markersIn(res.body)).toEqual([]);
        expect(JSON.stringify(res.body)).not.toContain(HANDLE);
      }
    });

    test('an ADMIN is let through on every one (never 401 or 403)', async () => {
      for (const path of production()) {
        const res = await get('admin', path);
        expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
      }
    });

    test('an ADMIN still reads the production material itself', async () => {
      const made = await get('admin', `/api/v1/character-registry/characters/${character.id}`);
      expect(made.status).toBe(200);
      expect(markersIn(made.body).length).toBeGreaterThan(40);
      const depth = await get('admin', `/api/v1/character-depth/${character.id}`);
      expect(depth.status).toBe(200);
      const story = await get('admin', `/api/v1/relationships/${pair.id}`);
      expect(story.status).toBe(200);
      expect(markersIn(story.body).length).toBeGreaterThan(0);
      const exported = await get('admin', '/api/v1/social-profiles/export');
      expect(exported.status).toBe(200);
      expect(markersIn(exported.body)).toEqual(expect.arrayContaining(['private_reality']));
    });
  });

  describe('The Pulse still reads for a viewer', () => {
    test('a profile page and its pictures: public fields, no private column', async () => {
      const page = await get('viewer', `/api/v1/pulse-follows/profile/${HANDLE}?show_id=${showId}`);
      expect(page.status).toBe(200);
      expect(page.body.data.profile).toMatchObject({ id: profile.id, handle: HANDLE, display_name: `Public Name ${tag}`, bio: `Public persona ${tag}` });
      expect(page.body.data.character_id).toBeUndefined();
      for (const column of PRIVATE) expect(markersIn(page.body)).not.toContain(column);
      const media = await get('viewer', `/api/v1/pulse-follows/profile/${HANDLE}/media`);
      expect(media.status).toBe(200);
      expect(markersIn(media.body)).toEqual([]);
    });

    test('Lala\'s header, the sidebar, trending, the latest fit and the feed are not refused', async () => {
      for (const path of [
        `/api/v1/social-profiles/lala?show_id=${showId}`,
        `/api/v1/social-profiles/lala/sidebar?show_id=${showId}`,
        `/api/v1/feed-enhanced/${showId}/trending`,
        `/api/v1/pulse-fits/latest?show_id=${showId}`,
        `/api/v1/feed-posts?show_id=${showId}&status=live`,
      ]) {
        const res = await get('viewer', path);
        expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
      }
    });

    test('without a token The Pulse\'s own profile read stays closed, as it was', async () => {
      expect((await get('anon', `/api/v1/pulse-follows/profile/${HANDLE}`)).status).toBe(401);
    });
  });
});
