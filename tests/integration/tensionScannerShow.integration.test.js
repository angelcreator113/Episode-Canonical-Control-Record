/**
 * The tension scanner and /world/tension-check are a show's (Evoni's ruling,
 * 2026-10-08). With ?show_id=, a relationship is the show's when both of its
 * characters are in that show's registries or in a registry with no show
 * yet. World Studio files its registries by world, not show, so its cast
 * stays in every show's view, and another show's own cast stays out. A
 * one-night candidate is kept unless its registry entry is another show's.
 * Without show_id, every show's, as before. The State tab and the hub's
 * Overview send the active show.
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const uuid = () => crypto.randomUUID();

(shouldSkip ? describe.skip : describe)("the tension scanner and tension-check are a show's", () => {
  let token;
  const TAG = uuid().slice(0, 8);
  const name = (k) => `Tension Show ${TAG} ${k}`;
  const show = { a: uuid(), b: uuid() };
  // Show A's registry, show B's, and one with no show (World Studio's kind).
  const reg = { a: uuid(), b: uuid(), none: uuid() };
  // Two characters in each registry, each with its World Studio twin.
  const home = { a1: 'a', a2: 'a', b1: 'b', b2: 'b', u1: 'none', u2: 'none' };
  const rc = Object.fromEntries(Object.keys(home).map((k) => [k, uuid()]));
  const wc = Object.fromEntries(Object.keys(home).map((k) => [k, uuid()]));
  // Confirmed, high-tension relationships: within A, within B, A with the
  // unassigned cast, within the unassigned cast, and across A and B.
  const rel = { aa: uuid(), bb: uuid(), au: uuid(), uu: uuid(), ab: uuid() };
  const relName = Object.fromEntries(Object.entries(rel).map(([k, id]) => [id, k]));
  // One-night candidates: in A's registry, in B's, in the unassigned one, in none.
  const ons = { a: uuid(), b: uuid(), none: uuid(), loose: uuid() };
  const onsRc = { a: uuid(), b: uuid(), none: uuid() };
  const onsName = Object.fromEntries(Object.entries(ons).map(([k, id]) => [id, k]));

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const scan = (qs = '') => auth(request(app).get(`/api/v1/world/tension-scanner${qs}`));
  const check = (qs = '') => auth(request(app).get(`/api/v1/world/tension-check${qs}`));
  // Ours only: the shared test DB may hold other files' rows.
  const pairsOf = (body) => body.pairs.map((p) => relName[p.relationship_id]).filter(Boolean).sort();
  const triggeredOf = (body) => body.triggered
    .filter((t) => relName[t.relationship_id])
    .map((t) => `${t.name.slice(name('').length)}:${relName[t.relationship_id]}`).sort();
  const candidatesOf = (body) => body.one_night_candidates.map((c) => onsName[c.id]).filter(Boolean).sort();

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-tension-show', email: 'test@tension-show.dev', name: 'Tension Show Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [k, id] of Object.entries(show)) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name: name(`show ${k}`), slug: `tension-show-${TAG}-${k}` });
    }
    for (const [k, id] of Object.entries(reg)) {
      await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:id, :title, :show, NOW(), NOW())`,
        { id, title: name(`registry ${k}`), show: show[k] || null });
    }
    const addWorld = (id, n, type) => run(
      `INSERT INTO world_characters (id, name, character_type, status, intimate_eligible, world_tag, relationship_graph, created_at, updated_at)
       VALUES (:id, :name, :type, 'active', true, 'lalaverse', '[]'::jsonb, NOW(), NOW())`, { id, name: n, type });
    const addRegistry = (id, registry, n, world) => run(
      `INSERT INTO registry_characters (id, registry_id, character_key, display_name, world_character_id, created_at, updated_at)
       VALUES (:id, :registry, :key, :name, :world, NOW(), NOW())`,
      { id, registry, key: `tension_show_${id.slice(0, 8)}`, name: n, world });
    for (const [k, r] of Object.entries(home)) {
      await addWorld(wc[k], name(k), 'pressure');
      await addRegistry(rc[k], reg[r], name(k), wc[k]);
    }
    for (const [k, id] of Object.entries(ons)) {
      await addWorld(id, name(`one night ${k}`), 'one_night_stand');
      if (onsRc[k]) await addRegistry(onsRc[k], reg[k], name(`one night ${k}`), id);
    }
    const addRel = (id, a, b, tension) => run(
      `INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, tension_state, confirmed, created_at, updated_at)
       VALUES (:id, :a, :b, 'Rival', :tension, true, NOW(), NOW())`, { id, a, b, tension });
    await addRel(rel.aa, rc.a1, rc.a2, 'volatile');
    await addRel(rel.bb, rc.b1, rc.b2, 'simmering');
    await addRel(rel.au, rc.a1, rc.u1, 'fractured');
    await addRel(rel.uu, rc.u1, rc.u2, 'volatile');
    await addRel(rel.ab, rc.a2, rc.b1, 'volatile');
  });

  afterAll(async () => {
    const rcs = [...Object.values(rc), ...Object.values(onsRc)];
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:rcs) OR character_id_b IN (:rcs)', { rcs });
    await run('DELETE FROM registry_characters WHERE id IN (:rcs)', { rcs });
    await run('DELETE FROM world_characters WHERE id IN (:ids)', { ids: [...Object.values(wc), ...Object.values(ons)] });
    await run('DELETE FROM character_registries WHERE id IN (:ids)', { ids: Object.values(reg) });
    await run('DELETE FROM shows WHERE id IN (:ids)', { ids: Object.values(show) });
  });

  it('the scanner: without a show, every pair', async () => {
    const res = await scan();
    expect(res.status).toBe(200);
    expect(pairsOf(res.body)).toEqual(['aa', 'ab', 'au', 'bb', 'uu']);
    // An empty show_id is no show.
    expect(pairsOf((await scan('?show_id=')).body)).toEqual(['aa', 'ab', 'au', 'bb', 'uu']);
  });

  it("the scanner: a show's pairs are in its registries or in one with no show; another show's and a pair across shows stay out", async () => {
    const a = await scan(`?show_id=${show.a}`);
    expect(a.status).toBe(200);
    expect(a.body.status).toBe('ok');
    expect(pairsOf(a.body)).toEqual(['aa', 'au', 'uu']);
    expect(a.body.count).toBe(a.body.pairs.length);
    // a1, a2 and u1, u2 at least: the characters in the show's confirmed relationships.
    expect(a.body.characters_scanned).toBeGreaterThanOrEqual(4);
    expect(pairsOf((await scan(`?show_id=${show.b}`)).body)).toEqual(['bb', 'uu']);
    // A show with no registry of its own sees the unassigned cast only.
    expect(pairsOf((await scan(`?show_id=${uuid()}`)).body)).toEqual(['uu']);
  });

  it('the scanner refuses a show_id that is not a show id', async () => {
    const res = await scan('?show_id=styling-adventures');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'show_id must be a show id (UUID)' });
  });

  it("tension-check: a show's triggered pairs by the same rule, from both sides", async () => {
    const all = await check();
    expect(all.status).toBe(200);
    expect(triggeredOf(all.body)).toEqual(['a1:aa', 'a1:au', 'a2:aa', 'a2:ab', 'b1:ab', 'b1:bb', 'b2:bb', 'u1:au', 'u1:uu', 'u2:uu']);
    const a = await check(`?show_id=${show.a}`);
    expect(a.status).toBe(200);
    expect(triggeredOf(a.body)).toEqual(['a1:aa', 'a1:au', 'a2:aa', 'u1:au', 'u1:uu', 'u2:uu']);
    expect(a.body.trigger_count).toBe(a.body.triggered.length + a.body.one_night_candidates.length);
    expect(triggeredOf((await check(`?show_id=${show.b}`)).body)).toEqual(['b1:bb', 'b2:bb', 'u1:uu', 'u2:uu']);
  });

  it("tension-check: a one-night candidate is kept unless its registry entry is another show's", async () => {
    expect(candidatesOf((await check()).body)).toEqual(['a', 'b', 'loose', 'none']);
    expect(candidatesOf((await check(`?show_id=${show.a}`)).body)).toEqual(['a', 'loose', 'none']);
    expect(candidatesOf((await check(`?show_id=${show.b}`)).body)).toEqual(['b', 'loose', 'none']);
  });

  it('tension-check refuses a show_id that is not a show id', async () => {
    const res = await check('?show_id=1');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'show_id must be a show id (UUID)' });
  });
});
