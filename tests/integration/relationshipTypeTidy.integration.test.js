/**
 * Tidy up existing relationship types (Evoni, 2026-10-24: "Yes tidy up
 * existing relationships"), against the test database:
 * - GET /type-tidy proposes a list type for each live relationship and seed
 *   whose type the app does not write, by the normalizer Generate uses,
 *   keeping the old words in the situation; null when it cannot decide;
 * - POST /type-tidy saves the accepted changes in one transaction, each
 *   alone: a romance on a non-spouse family role, a type the app does not
 *   know, or a clash with the unique index is refused and the rest stand; a
 *   family type becomes a family tie both ways (a seed stays a seed); the
 *   Pulse pair follows; a second Save skips what is already tidy;
 * - reads need a sign-in, the Save is ADMIN only.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const truth = require('../../src/services/relationshipTruth');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const api = '/api/v1/relationships/type-tidy';

(shouldSkip ? describe.skip : describe)('relationship type tidy-up (2026-10-24)', () => {
  const tag = uuid().slice(0, 8);
  const reg = uuid();
  const c = {};
  const r = {};
  let admin;
  let viewer;
  let ip = 0;
  const from = (req) => req.set('X-Forwarded-For', `10.78.${ip}.1`);
  const auth = (req) => from(req).set('Authorization', `Bearer ${admin}`);
  const rowOf = async (id) => (await run('SELECT * FROM character_relationships WHERE id = :id', { id }))[0][0];

  const person = async (key, gender = null) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, gender, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :gender, NOW(), NOW())`, { id: c[key], reg, key: `${key}-${tag}`, name: `${key} ${tag}`, gender });
  };
  const relate = async (key, a, b, f = {}) => {
    r[key] = uuid();
    const v = { type: 'friend', confirmed: true, romantic: false, family: null, situation: null, ...f };
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role, situation, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :romantic, :family, :situation, NOW(), NOW())`, { id: r[key], a: c[a], b: c[b], ...v });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-tidy', email: 'evoni@tidy.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    viewer = TokenService.generateTokenPair({ id: 'test-viewer-tidy', email: 'viewer@tidy.dev', name: 'Viewer', groups: [], role: 'USER' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Tidy', NOW(), NOW())", { reg });
    for (const [k, g] of [['lala', 'female'], ['marcus', 'male'], ['jade', 'female'], ['dre', 'male'], ['sable', null], ['nia', 'female']]) await person(k, g);
    await relate('critic', 'marcus', 'lala', { type: 'Subject turned critic', situation: 'He reviews her looks' });
    await relate('fidelity', 'sable', 'marcus', { type: 'Fidelity test' });
    await relate('caps', 'jade', 'sable', { type: 'Rival', situation: 'Rival boutiques' });
    await relate('unknown', 'nia', 'lala', { type: 'keeper of keys' });
    await relate('tidy', 'nia', 'jade', { type: 'rival' });
    await relate('sisters', 'jade', 'dre', { type: 'older sisters' });
    await relate('cousins', 'nia', 'dre', { type: 'cousins', confirmed: false });
    await relate('mom', 'nia', 'sable', { type: 'protective mom', family: 'mother' });
    await relate('clashA', 'dre', 'lala', { type: 'rival' });
    await relate('clashB', 'dre', 'lala', { type: 'Rival ' });
  });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM character_registries WHERE id = :reg', { reg });
  });

  beforeEach(() => { ip += 1; });

  test('GET proposes a list type for each unknown type, keeps the old words, and leaves undecided ones to her', async () => {
    const res = await auth(request(app).get(api));
    expect(res.status).toBe(200);
    const mine = new Map(res.body.items.filter((i) => Object.values(r).includes(i.id)).map((i) => [i.id, i]));
    expect(mine.get(r.critic)).toMatchObject({
      a_name: `marcus ${tag}`, b_name: `lala ${tag}`, current_type: 'Subject turned critic', proposed_type: 'rival', proposed_is_romantic: false,
      flavour: 'Subject turned critic', situation_now: 'He reviews her looks', situation_after: 'Subject turned critic: He reviews her looks',
    });
    expect(mine.get(r.fidelity)).toMatchObject({ proposed_type: 'love_interest', proposed_is_romantic: true, situation_now: null, situation_after: 'Fidelity test' });
    expect(mine.get(r.caps)).toMatchObject({ proposed_type: 'rival', flavour: null, situation_after: 'Rival boutiques' });
    expect(mine.get(r.unknown)).toMatchObject({ proposed_type: null, flavour: null });
    expect(mine.get(r.cousins)).toMatchObject({ confirmed: false, proposed_type: 'family' });
    expect(mine.has(r.tidy)).toBe(false);
    expect((await from(request(app).get(api))).status).toBe(401);
  });

  test('POST applies each change alone: family ties both ways, a seed stays a seed, the refused listed; the Pulse pair follows', async () => {
    const spy = jest.spyOn(truth, 'afterStorySave');
    const res = await auth(request(app).post(api)).send({ changes: [
      { id: r.critic, relationship_type: 'rival', situation: 'Subject turned critic: He reviews her looks' },
      { id: r.fidelity, relationship_type: 'love_interest', is_romantic: true },
      { id: r.sisters, relationship_type: 'Sister' },
      { id: r.cousins, relationship_type: 'cousin' },
      { id: r.mom, relationship_type: 'love_interest', is_romantic: true },
      { id: r.unknown, relationship_type: 'keeper of keys' },
      { id: r.clashB, relationship_type: 'rival' },
      { id: uuid(), relationship_type: 'rival' },
    ] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual([r.critic, r.fidelity, r.sisters, r.cousins]);
    expect(res.body.refused.map((x) => x.id)).toEqual([r.mom, r.unknown, r.clashB, expect.any(String)]);
    expect(res.body.refused[0].error).toMatch(/family \(mother\)/);
    expect(res.body.refused[1].error).toMatch(/not a type the app knows/);
    expect(res.body.refused[2].error).toMatch(/already there/);
    expect(res.body.refused[3].error).toBe('Relationship not found');

    expect(await rowOf(r.critic)).toMatchObject({ relationship_type: 'rival', situation: 'Subject turned critic: He reviews her looks' });
    expect(await rowOf(r.fidelity)).toMatchObject({ relationship_type: 'love_interest', is_romantic: true });
    expect(await rowOf(r.sisters)).toMatchObject({ relationship_type: 'sister', family_role: 'sister', reverse_family_role: 'brother', family_kind: 'blood', confirmed: true });
    expect(await rowOf(r.cousins)).toMatchObject({ relationship_type: 'cousin', family_role: 'cousin', reverse_family_role: 'cousin', confirmed: false });
    expect(await rowOf(r.mom)).toMatchObject({ relationship_type: 'protective mom', is_romantic: false });
    expect(await rowOf(r.clashB)).toMatchObject({ relationship_type: 'Rival ' });
    for (const id of res.body.updated) expect(spy).toHaveBeenCalledWith(expect.anything(), id);
    expect(spy).not.toHaveBeenCalledWith(expect.anything(), r.mom);
    spy.mockRestore();
  });

  test('a second Save skips what is already tidy; the list no longer shows it', async () => {
    const res = await auth(request(app).post(api)).send({ changes: [{ id: r.critic, relationship_type: 'mentor' }] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: [], refused: [], skipped: [r.critic] });
    expect((await rowOf(r.critic)).relationship_type).toBe('rival');
    const list = await auth(request(app).get(api));
    expect(list.body.items.map((i) => i.id)).not.toContain(r.critic);
  });

  test('the Save is ADMIN only and takes at most 200', async () => {
    const asViewer = from(request(app).post(api)).set('Authorization', `Bearer ${viewer}`);
    expect((await asViewer.send({ changes: [{ id: r.caps, relationship_type: 'rival' }] })).status).toBe(403);
    expect((await from(request(app).post(api)).send({})).status).toBe(401);
    expect((await auth(request(app).post(api)).send({ changes: Array.from({ length: 201 }, () => ({ id: uuid(), relationship_type: 'rival' })) })).status).toBe(400);
    expect((await auth(request(app).post(api)).send({ changes: [] })).status).toBe(400);
    expect((await rowOf(r.caps)).relationship_type).toBe('Rival');
  });
});
