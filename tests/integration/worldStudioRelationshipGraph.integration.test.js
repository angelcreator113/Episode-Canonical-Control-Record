/**
 * World Studio's two ecosystem generators no longer write a character's
 * relationship_graph. Relationships are kept in character_relationships
 * (Evoni's ruling, 2026-10-08, fix-list item 23), and the graph holds only
 * World Studio's older entries, listed as legacy. Both generators still
 * copied relationship_graph from each character they were given, so an
 * entry the AI or a confirm request carried was saved as a new legacy
 * entry. Now a new character's graph is empty, as the model leaves it.
 *
 * The AI is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });

const TAG = crypto.randomUUID().slice(0, 8);
const name = (n) => `Graph Test ${TAG} ${n}`;
// An entry the old copy would have saved as a legacy relationship.
const GRAPH = [{ rel_id: `old-${TAG}`, character_name: 'Rex', relationship_type: 'friendship' }];
const character = (n) => ({
  name: name(n), character_type: 'peer', world_location: 'Echo Park', occupation: 'stylist', relationship_graph: GRAPH,
});
const graphs = async (names) => (await q(
  'SELECT name, relationship_graph FROM world_characters WHERE name IN (:names) ORDER BY name', { names })).map((r) => [r.name, r.relationship_graph]);

(shouldSkip ? describe.skip : describe)('the ecosystem generators leave a new character\'s relationship_graph empty', () => {
  let token;
  let hadRegistry;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    token = TokenService.generateTokenPair({
      id: 'test-user-relationship-graph', email: 'test@relationship-graph.dev', name: 'Relationship Graph Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    // World Studio files a world's characters in the registry tagged with it, making one if there is none.
    hadRegistry = (await q("SELECT id FROM character_registries WHERE book_tag = 'lalaverse' LIMIT 1")).length > 0;
  });

  afterAll(async () => {
    const like = `Graph Test ${TAG}%`;
    const mine = 'SELECT id FROM registry_characters WHERE display_name LIKE :like';
    await run(`DELETE FROM character_relationships WHERE character_id_a IN (${mine}) OR character_id_b IN (${mine})`, { like });
    const batches = await q('SELECT DISTINCT batch_id FROM world_characters WHERE name LIKE :like AND batch_id IS NOT NULL', { like });
    await run('DELETE FROM world_characters WHERE name LIKE :like', { like });
    for (const { batch_id: id } of batches) await run('DELETE FROM world_character_batches WHERE id = :id', { id });
    await run('DELETE FROM registry_characters WHERE display_name LIKE :like', { like });
    if (!hadRegistry) await run("DELETE FROM character_registries WHERE book_tag = 'lalaverse'");
  });

  beforeEach(() => mockCreate.mockReset());

  it('generate-ecosystem-confirm: a character sent with a graph is saved with none', async () => {
    const res = await request(app).post('/api/v1/world/generate-ecosystem-confirm').set('Authorization', `Bearer ${token}`)
      .send({ world_tag: 'lalaverse', characters: [character('A'), character('B')] });
    expect(res.status).toBe(201);
    expect(await graphs([name('A'), name('B')])).toEqual([[name('A'), []], [name('B'), []]]);
  });

  it('generate-ecosystem: a character the AI gives with a graph is saved with none', async () => {
    mockCreate.mockResolvedValue(reply({ characters: [character('C'), character('D'), character('E')], generation_notes: '' }));
    const res = await request(app).post('/api/v1/world/generate-ecosystem').set('Authorization', `Bearer ${token}`)
      .send({ world_tag: 'lalaverse', character_count: 3 });
    expect(res.status).toBe(201);
    expect(await graphs([name('C'), name('D'), name('E')])).toEqual([[name('C'), []], [name('D'), []], [name('E'), []]]);
  });
});
