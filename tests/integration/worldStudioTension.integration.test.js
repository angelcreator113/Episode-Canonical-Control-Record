/**
 * A tension set in World Studio reaches the tension scanner (the State tab's
 * Tensions and the hub Overview's idea).
 *
 * Two breaks, both on a migrated schema (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md §4 finding 4a, fix-list
 * item 10):
 *   - the scanner selected world_characters.display_name, which the table
 *     does not have (it has name), so every scan answered scan_failed;
 *   - POST /world/characters/:id/relationships stored the graph entry as
 *     character_id / character_name with no tension_state, while the scanner
 *     reads related_character_* and tension_state.
 * create-story-task selected display_name and character_key the same way.
 *
 * Database: the local migrated test DB.
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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('World Studio tension → tension scanner', () => {
  let token;
  const ids = { a: crypto.randomUUID(), b: crypto.randomUUID(), old: crypto.randomUUID() };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-ws-tension', email: 'test@ws-tension.dev', name: 'WS Tension Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[ids.a, 'Tension Test Sable'], [ids.b, 'Tension Test Nia'], [ids.old, 'Tension Test Older']]) {
      await run(`INSERT INTO world_characters (id, name, character_type, status, relationship_graph, created_at, updated_at)
                 VALUES (:id, :name, 'pressure', 'active', '[]'::jsonb, NOW(), NOW())`, { id, name });
    }
    // An entry saved by the old POST: character_* keys only, a tension set later by PUT.
    await run(`UPDATE world_characters SET relationship_graph = :g::jsonb WHERE id = :id`, {
      id: ids.old,
      g: JSON.stringify([{ rel_id: crypto.randomUUID(), character_id: ids.a, character_name: 'Tension Test Sable', tension_state: 'Explosive' }]),
    });
  });

  afterAll(async () => {
    await run(`DELETE FROM character_relationships_extended WHERE character_id IN (:a, :b, :old)`, ids).catch((e) => console.error(e.message));
    await run(`DELETE FROM world_characters WHERE id IN (:a, :b, :old)`, ids);
  });

  const scan = () => request(app).get('/api/v1/world/tension-scanner').set('Authorization', `Bearer ${token}`);
  const ours = (pairs) => pairs.filter((p) => String(p.char_a.name).startsWith('Tension Test'));

  it('a relationship added in World Studio with a tension shows as a pair, with both names and the state', async () => {
    const add = await request(app).post(`/api/v1/world/characters/${ids.a}/relationships`)
      .set('Authorization', `Bearer ${token}`)
      .send({ related_character_id: ids.b, related_character_name: 'Tension Test Nia', relationship_type: 'rival', tension_state: 'Simmering', conflict_summary: 'Both want the Avenue window.' });
    expect(add.status).toBe(200);
    const entry = add.body.graph[0];
    // Both key families: the scanner's and World Studio's card.
    expect(entry).toMatchObject({ related_character_id: ids.b, related_character_name: 'Tension Test Nia', character_id: ids.b, character_name: 'Tension Test Nia', tension_state: 'Simmering' });

    const res = await scan();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    const pair = ours(res.body.pairs).find((p) => p.char_a.id === ids.a);
    expect(pair).toMatchObject({
      char_a: { id: ids.a, name: 'Tension Test Sable' },
      char_b: { id: ids.b, name: 'Tension Test Nia' },
      tension_state: 'Simmering', relationship_type: 'rival', conflict_summary: 'Both want the Avenue window.',
    });
  });

  it('an older entry with only character_* keys is still read, with its name', async () => {
    const res = await scan();
    const older = ours(res.body.pairs).find((p) => p.char_a.id === ids.old);
    expect(older).toMatchObject({ char_b: { id: ids.a, name: 'Tension Test Sable' }, tension_state: 'Explosive' });
  });

  it('a PUT that renames keeps both name keys in step', async () => {
    const [{ relationship_graph: graph }] = await q(`SELECT relationship_graph FROM world_characters WHERE id = :a`, ids);
    const relId = graph[0].rel_id;
    const put = await request(app).put(`/api/v1/world/characters/${ids.a}/relationships/${relId}`)
      .set('Authorization', `Bearer ${token}`).send({ related_character_name: 'Tension Test Nia Vale' });
    expect(put.status).toBe(200);
    expect(put.body.graph[0]).toMatchObject({ related_character_name: 'Tension Test Nia Vale', character_name: 'Tension Test Nia Vale' });
  });

  it('create-story-task reads the character by its real columns', async () => {
    const res = await request(app).post('/api/v1/world/create-story-task')
      .set('Authorization', `Bearer ${token}`).send({ character_id: ids.a });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('Tension Test Sable');
  });
});
