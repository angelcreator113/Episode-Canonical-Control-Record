/**
 * Amber's delete_character action (src/routes/memories/assistant.js,
 * executeAssistantAction) refuses to delete a character at depth_level
 * 'alive'. The guard selected only `status` and tested `depth_level`, so it
 * never fired and alive characters were soft-deleted
 * (docs/CHARACTER_REGISTRY_READ.md §4.1 row 8).
 *
 * The Claude call is stubbed to return the delete_character action; the
 * database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Amber delete_character: the alive guard', () => {
  let token;
  const ids = { reg: uuid(), alive: uuid(), sparked: uuid() };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-amber-guard',
      email: 'test@amber-guard.dev',
      name: 'Amber Guard Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Amber guard registry', NOW(), NOW())`, ids);
    for (const [id, depth] of [[ids.alive, 'alive'], [ids.sparked, 'sparked']]) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, :depth, NOW(), NOW())`,
        { id, reg: ids.reg, key: `amber-${depth}-${id.slice(0, 8)}`, name: `Amber ${depth}`, depth });
    }
  });

  afterAll(async () => {
    await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
  });

  const askToDelete = (characterId) => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ reply: 'Deleting.', action: 'delete_character', actionParams: { character_id: characterId } }) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    return request(app)
      .post('/api/v1/memories/assistant-command')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'delete this character' });
  };
  const deletedAt = async (id) => (await q(`SELECT deleted_at FROM registry_characters WHERE id = :id`, { id }))[0].deleted_at;

  it('refuses to delete an alive character', async () => {
    const res = await askToDelete(ids.alive);
    expect(res.status).toBe(200);
    expect(res.body.error).toMatch(/Alive characters cannot be deleted/);
    expect(await deletedAt(ids.alive)).toBeNull();
  });

  it('deletes a character that is not alive', async () => {
    const res = await askToDelete(ids.sparked);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(await deletedAt(ids.sparked)).not.toBeNull();
  });
});
