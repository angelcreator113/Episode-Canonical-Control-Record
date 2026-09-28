/**
 * POST /api/v1/character-generation/promote-ghost/:characterId creates the
 * promoted character with role_type 'support'. It used 'supporting', which
 * enum_registry_characters_role_type does not have, so every call failed
 * with 22P02 and a 500. Unblocks F-Reg-2 v1.2 R2 row 8 (its RMW follows).
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

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('POST /promote-ghost creates the promoted character with a valid role_type', () => {
  let token;
  const ids = { reg: uuid(), rc: uuid() };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-promote-ghost',
      email: 'test@promote-ghost.dev',
      name: 'Promote Ghost Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Promote ghost registry', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, ghost_characters, created_at, updated_at)
               VALUES (:rc, :reg, :key, 'Source Character', CAST(:ghosts AS jsonb), NOW(), NOW())`,
      { ...ids, key: `ghost-src-${ids.rc.slice(0, 8)}`, ghosts: JSON.stringify([{ name: 'Ghost Promote' }]) });
  });

  afterAll(async () => {
    await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
  });

  it('returns 201 and creates the character with role_type support', async () => {
    const res = await request(app)
      .post(`/api/v1/character-generation/promote-ghost/${ids.rc}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ghost_name: 'Ghost Promote', registry_id: ids.reg });

    expect(res.status).toBe(201);
    const [created] = await q(`SELECT role_type, depth_level, status FROM registry_characters WHERE id = :id`, { id: res.body.character.id });
    expect(created).toEqual({ role_type: 'support', depth_level: 'sparked', status: 'draft' });
  });
});
