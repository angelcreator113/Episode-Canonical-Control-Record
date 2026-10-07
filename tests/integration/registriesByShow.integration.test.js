/**
 * GET /character-registry/registries listed every show's registries, so the
 * LalaVerse Overview's Characters tile counted every show's cast (wiring
 * map, docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 16).
 * ?show_id= lists one show's.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('GET /character-registry/registries ?show_id', () => {
  const showA = uuid();
  const showB = uuid();
  const regA = uuid();
  const regB = uuid();
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-registries-show', email: 'test@registries-show.dev', name: 'Registries Show Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [show, reg, n] of [[showA, regA, 2], [showB, regB, 3]]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
        { show, name: `Registry ${show.slice(0, 8)}`, slug: `reg-${show.slice(0, 8)}` });
      await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Cast', :show, NOW(), NOW())`, { reg, show });
      for (let i = 0; i < n; i += 1) {
        await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
                   VALUES (:id, :reg, :key, :name, NOW(), NOW())`, { id: uuid(), reg, key: `c-${reg.slice(0, 8)}-${i}`, name: `Character ${i}` });
      }
    }
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id IN (:regs)', { regs: [regA, regB] });
    await run('DELETE FROM character_registries WHERE id IN (:regs)', { regs: [regA, regB] });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows: [showA, showB] });
  });

  const get = (qs) => request(app).get(`/api/v1/character-registry/registries${qs}`).set('Authorization', `Bearer ${token}`);

  it('lists only that show\'s registries and their characters', async () => {
    const res = await get(`?show_id=${showA}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.registries.map((r) => r.id)).toEqual([regA]);
    expect(res.body.registries[0].characters).toHaveLength(2);
    expect(res.body.total).toBe(1);
  });

  it('without show_id it still lists every show\'s', async () => {
    const res = await get('?limit=100');
    const ids = res.body.registries.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([regA, regB]));
  });

  it('a show_id that is not a UUID is a 400', async () => {
    expect((await get('?show_id=show-b')).status).toBe(400);
  });
});
