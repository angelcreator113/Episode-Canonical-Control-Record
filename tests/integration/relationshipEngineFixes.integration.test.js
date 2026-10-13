/**
 * The relationship defects of the relationships read §4 (Task #3119), against
 * the test database:
 * - PUT /relationships/:id writes the Inspector's family role, conflict and
 *   the three "knows" fields; an empty value clears one; a field not sent is
 *   kept;
 * - DELETE /relationships/dismiss/:id dismisses a seed (the page's method);
 *   a confirmed relationship is refused;
 * - GET /relationships/character/:id names the other character on each row,
 *   and ?confirmed=true leaves seeds out;
 * - the CharacterRelationship model reads deleted_at: a soft-deleted row is
 *   not found.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
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

(shouldSkip ? describe.skip : describe)('Relationship Engine fixes (Task #3119)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { reg: uuid(), ana: uuid(), bea: uuid(), cal: uuid(), rel: uuid(), seed: uuid() };
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const rowOf = async (id) => (await run('SELECT * FROM character_relationships WHERE id = :id', { id }))[0][0];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-rel-fixes', email: 'evoni@relfix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, :title, NOW(), NOW())`, { ...ids, title: `Rel ${tag}` });
    for (const [key, name, selected] of [['ana', 'Ana', 'Ana Reyes'], ['bea', 'Bea', null], ['cal', 'Cal', null]]) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, :selected, NOW(), NOW())`, { id: ids[key], reg: ids.reg, key: `${key}-${tag}`, name, selected });
    }
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, family_role, source_knows, confirmed, created_at, updated_at)
               VALUES (:rel, :ana, :bea, 'sisters', 'sister', 'that Bea took the money', true, NOW(), NOW()),
                      (:seed, :cal, :ana, 'rivals', NULL, NULL, false, NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all: [ids.ana, ids.bea, ids.cal] });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
  });

  test('PUT writes the Inspector\'s family role, conflict and knows fields; empty clears, absent keeps', async () => {
    const res = await as(request(app).put(`/api/v1/relationships/${ids.rel}`)).send({
      relationship_type: 'sisters', notes: 'close until the wedding',
      family_role: 'older sister', conflict_summary: 'the inheritance',
      source_knows: '', target_knows: 'that Ana read the will', reader_knows: 'both are lying',
    });
    expect(res.status).toBe(200);
    expect(res.body.relationship).toMatchObject({
      family_role: 'older sister', conflict_summary: 'the inheritance',
      source_knows: null, target_knows: 'that Ana read the will', reader_knows: 'both are lying',
      notes: 'close until the wedding',
    });

    // A PUT without them (the older callers) leaves them as they are.
    await as(request(app).put(`/api/v1/relationships/${ids.rel}`)).send({ tension_state: 'simmering' });
    expect(await rowOf(ids.rel)).toMatchObject({
      tension_state: 'simmering', family_role: 'older sister', target_knows: 'that Ana read the will', reader_knows: 'both are lying',
    });
    expect((await request(app).put(`/api/v1/relationships/${ids.rel}`).send({ notes: 'x' })).status).toBe(401);
  });

  test('GET /character/:id names the other character; ?confirmed=true leaves seeds out', async () => {
    const all = await as(request(app).get(`/api/v1/relationships/character/${ids.ana}`));
    expect(all.status).toBe(200);
    expect(all.body.relationships.map((r) => [r.relationship_type, r.related_id, r.related_name])).toEqual([
      ['sisters', ids.bea, 'Bea'],
      ['rivals', ids.cal, 'Cal'],
    ]);
    const confirmed = await as(request(app).get(`/api/v1/relationships/character/${ids.ana}`).query({ confirmed: true }));
    expect(confirmed.body.relationships.map((r) => r.relationship_type)).toEqual(['sisters']);
    // From Bea's side, the other is Ana, by her selected name.
    const fromBea = await as(request(app).get(`/api/v1/relationships/character/${ids.bea}`).query({ confirmed: true }));
    expect(fromBea.body.relationships[0]).toMatchObject({ related_id: ids.ana, related_name: 'Ana Reyes' });
  });

  test('DELETE /dismiss/:id dismisses a seed; a confirmed relationship is refused', async () => {
    expect((await as(request(app).delete(`/api/v1/relationships/dismiss/${ids.rel}`))).status).toBe(400);
    const res = await as(request(app).delete(`/api/v1/relationships/dismiss/${ids.seed}`));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dismissed: true });
    expect(await rowOf(ids.seed)).toBeUndefined();
    expect((await as(request(app).post(`/api/v1/relationships/dismiss/${ids.rel}`))).status).toBe(404);
  });

  test('the model reads deleted_at: a soft-deleted row is not found', async () => {
    expect(models.CharacterRelationship.options.paranoid).toBe(true);
    expect(await models.CharacterRelationship.findByPk(ids.rel)).not.toBeNull();
    await run('UPDATE character_relationships SET deleted_at = NOW() WHERE id = :rel', ids);
    expect(await models.CharacterRelationship.findByPk(ids.rel)).toBeNull();
    expect(await models.CharacterRelationship.findByPk(ids.rel, { paranoid: false })).not.toBeNull();
    await run('UPDATE character_relationships SET deleted_at = NULL WHERE id = :rel', ids);
  });
});
