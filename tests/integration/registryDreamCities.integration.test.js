/**
 * Registry characters live in the five DREAM cities, and World Studio's
 * characters reach the registry.
 *
 * registry_characters.current_city was an ENUM of the old five cities,
 * outside_lalaverse and unknown (20260313200000-character-demographics);
 * July's unification never reached it. World Studio's sync copied each
 * character's free-text location into it, and its relationship status
 * words ("engaged", "its_complicated") into another ENUM that lacks them,
 * so the registry insert failed for nearly every character: confirming an
 * ecosystem left its characters out of the registry, and an edit never
 * reached their registry entry. (It also writes a sexuality column the
 * registry lacks, and confirm wrote the World Studio side of the link
 * outside its transaction, where the new row is not yet visible.)
 *
 * Migration 20261008150000-registry-characters-dream-cities adds the DREAM
 * cities and renames the old ones; utils/registryDemographics gives the
 * values the columns accept.
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
const { REGISTRY_CITY_KEYS, RELATIONSHIP_STATUSES } = require('../../src/utils/registryDemographics');
const migration = require('../../src/migrations/20261008150000-registry-characters-dream-cities');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const enumValues = async (type) => (await q(`SELECT unnest(enum_range(NULL::${type}))::text AS v`)).map((r) => r.v);
const registryRow = async (id) => (await q('SELECT current_city, relationship_status FROM registry_characters WHERE id = :id', { id }))[0];
const worldLink = async (id) => (await q('SELECT registry_character_id FROM world_characters WHERE id = :id', { id }))[0]?.registry_character_id;

const TAG = uuid().slice(0, 8);
const name = (n) => `City Test ${TAG} ${n}`;

(shouldSkip ? describe.skip : describe)('registry characters live in the DREAM cities', () => {
  let token;
  const hadRegistry = {};
  const ids = { reg: uuid() };

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    token = TokenService.generateTokenPair({
      id: 'test-user-registry-dream-cities', email: 'test@registry-dream-cities.dev', name: 'Registry DREAM Cities Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    // World Studio files each world's characters in the registry tagged
    // with it, making one if there is none.
    for (const tag of ['lalaverse', 'book-1']) {
      hadRegistry[tag] = (await q('SELECT id FROM character_registries WHERE book_tag = :tag LIMIT 1', { tag })).length > 0;
    }
    await run(`INSERT INTO character_registries (id, title, book_tag, created_at, updated_at) VALUES (:reg, 'Registry city test', :tag, NOW(), NOW())`,
      { reg: ids.reg, tag: `city-test-${TAG}` });
  });

  afterAll(async () => {
    const like = `City Test ${TAG}%`;
    const mine = 'SELECT id FROM registry_characters WHERE display_name LIKE :like';
    await run(`DELETE FROM character_relationships WHERE character_id_a IN (${mine}) OR character_id_b IN (${mine})`, { like });
    const batches = await q('SELECT DISTINCT batch_id FROM world_characters WHERE name LIKE :like AND batch_id IS NOT NULL', { like });
    await run('DELETE FROM world_characters WHERE name LIKE :like', { like });
    for (const { batch_id: id } of batches) await run('DELETE FROM world_character_batches WHERE id = :id', { id });
    await run('DELETE FROM registry_characters WHERE display_name LIKE :like', { like });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    for (const tag of ['lalaverse', 'book-1']) {
      if (!hadRegistry[tag]) await run('DELETE FROM character_registries WHERE book_tag = :tag', { tag });
    }
  });

  beforeEach(() => mockCreate.mockReset());

  const confirm = (worldTag, characters) => request(app).post('/api/v1/world/generate-ecosystem-confirm')
    .set('Authorization', `Bearer ${token}`).send({ world_tag: worldTag, characters });

  it('the city column takes the five DREAM cities, and both columns take every value the helpers give', async () => {
    const cities = await enumValues('enum_registry_characters_current_city');
    for (const key of REGISTRY_CITY_KEYS) expect(cities).toContain(key);
    expect(await enumValues('enum_registry_characters_relationship_status')).toEqual(RELATIONSHIP_STATUSES);
  });

  it('a confirmed LalaVerse character reaches the registry in the DREAM city its location names, its status as the registry names it', async () => {
    const res = await confirm('lalaverse', [
      { name: name('A'), character_type: 'friend', world_location: 'a loft above a club in Echo Park', relationship_status: 'engaged' },
      { name: name('B'), character_type: 'rival', world_location: 'somewhere glamorous', relationship_status: 'its_complicated' },
    ]);
    expect(res.status).toBe(201);
    const [a, b] = res.body.characters;
    expect(a.registry_character_id).toBeTruthy();
    expect(b.registry_character_id).toBeTruthy();
    expect(await registryRow(a.registry_character_id)).toEqual({ current_city: 'echo_park', relationship_status: 'committed' });
    expect(await registryRow(b.registry_character_id)).toEqual({ current_city: null, relationship_status: 'complicated' });
    // Linked both ways: World Studio's character points at its entry (its
    // "View in Registry" link, its relationships in the character list).
    expect(await worldLink(a.id)).toBe(a.registry_character_id);
    expect(await worldLink(b.id)).toBe(b.registry_character_id);
  });

  it('a Book 1 character is filed outside the LalaVerse', async () => {
    const res = await confirm('book-1', [
      { name: name('C'), character_type: 'friend', world_location: 'Atlanta, two streets from her mother', relationship_status: 'married' },
    ]);
    expect(res.status).toBe(201);
    expect(await registryRow(res.body.characters[0].registry_character_id)).toEqual({ current_city: 'outside_lalaverse', relationship_status: 'married' });
  });

  it('an edit to a character\'s location reaches its registry entry', async () => {
    const res = await confirm('lalaverse', [{ name: name('D'), character_type: 'friend', world_location: 'Radiance Row' }]);
    expect(res.status).toBe(201);
    const { id, registry_character_id: rcId } = res.body.characters[0];
    expect((await registryRow(rcId)).current_city).toBe('radiance_row');

    const edit = await request(app).put(`/api/v1/world/characters/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ world_location: 'the penthouse floor in Dazzle District', relationship_status: 'engaged' });
    expect(edit.status).toBe(200);
    expect(edit.body.registry_synced).toBe(true);
    expect(await registryRow(rcId)).toEqual({ current_city: 'dazzle_district', relationship_status: 'committed' });
  });

  it('the ecosystem preview asks each LalaVerse character for its DREAM city', async () => {
    mockCreate.mockResolvedValue(reply({ characters: [] }));
    await request(app).post('/api/v1/world/generate-ecosystem-preview').set('Authorization', `Bearer ${token}`)
      .send({ world_tag: 'lalaverse', character_count: 3 });
    expect(mockCreate).toHaveBeenCalled();
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('"world_location": "which of the five DREAM cities they live in (Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor), and where in it"');
  });

  it('the registry\'s own create and edit take a DREAM city, read an old one as July mapped it, and refuse anything else', async () => {
    const create = (body) => request(app).post(`/api/v1/character-registry/registries/${ids.reg}/characters`)
      .set('Authorization', `Bearer ${token}`).send({ display_name: name('E'), ...body });
    const made = await create({ current_city: 'Velour City' });
    expect(made.status).toBe(201);
    const rcId = made.body.character.id;
    expect((await registryRow(rcId)).current_city).toBe('echo_park');

    const refused = await create({ display_name: name('F'), current_city: 'gotham' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe(`current_city must be one of: ${REGISTRY_CITY_KEYS.join(', ')}`);

    const edit = (body) => request(app).put(`/api/v1/character-registry/characters/${rcId}`).set('Authorization', `Bearer ${token}`).send(body);
    expect((await edit({ current_city: 'the_drift' })).status).toBe(200);
    expect((await registryRow(rcId)).current_city).toBe('maverick_harbor');
    expect((await edit({ current_city: 'gotham' })).status).toBe(400);
    expect((await registryRow(rcId)).current_city).toBe('maverick_harbor');
    expect((await edit({ current_city: '' })).status).toBe(200);
    expect((await registryRow(rcId)).current_city).toBeNull();
  });

  it('the migration renames the old cities as July did, a deleted entry too, and leaves the rest', async () => {
    const rows = [
      ['nova', 'nova_prime', 'dazzle_district'],
      ['solenne', 'solenne', 'radiance_row'],
      ['velour', 'velour_city', 'echo_park'],
      ['cascade', 'cascade_row', 'ascent_tower'],
      ['drift', 'the_drift', 'maverick_harbor'],
      ['dream', 'echo_park', 'echo_park'],
      ['outside', 'outside_lalaverse', 'outside_lalaverse'],
    ];
    const rowId = {};
    for (const [n, city] of rows) {
      rowId[n] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, current_city, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, :city, NOW(), NOW())`,
        { id: rowId[n], reg: ids.reg, key: `city-test-${TAG}-${n}`, name: name(`mig ${n}`), city });
    }
    const deletedId = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, current_city, created_at, updated_at, deleted_at)
               VALUES (:id, :reg, :key, :name, 'solenne', NOW(), NOW(), NOW())`,
      { id: deletedId, reg: ids.reg, key: `city-test-${TAG}-deleted`, name: name('mig deleted') });

    await migration.up(sequelize.getQueryInterface());
    for (const [n, , to] of rows) expect((await registryRow(rowId[n])).current_city).toBe(to);
    expect((await registryRow(deletedId)).current_city).toBe('radiance_row');

    // Running it again changes nothing; down changes nothing.
    await migration.up(sequelize.getQueryInterface());
    await migration.down(sequelize.getQueryInterface());
    for (const [n, , to] of rows) expect((await registryRow(rowId[n])).current_city).toBe(to);
  });
});
