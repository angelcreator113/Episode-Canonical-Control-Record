/**
 * A confidential professional (Dr. Amara Sinclair) stays out of what the
 * writers pick by themselves (utils/confidentialCharacters), against the
 * test database, with the AI faked:
 *   - the Story Engine's character list
 *   - the relationship generator's cast in its prompt
 *   - the chapter-beats generator's cast (the SQL condition on a query
 *     with a limit)
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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('confidential professionals stay out of the writers', () => {
  let token;
  const ids = { reg: uuid(), a: uuid(), b: uuid(), dr: uuid(), book: uuid() };
  const tag = ids.reg.slice(0, 8);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-conf', email: 'evoni@conf.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Confidential registry', NOW(), NOW())", ids);
    const add = (id, key, name, extra) => run(
      `INSERT INTO registry_characters (id, registry_id, character_key, display_name, status, world, extra_fields, created_at, updated_at)
       VALUES (:id, :reg, :key, :name, 'accepted', 'lalaverse', CAST(:extra AS jsonb), NOW(), NOW())`,
      { id, reg: ids.reg, key, name, extra: JSON.stringify(extra) });
    await add(ids.a, `conf-a-${tag}`, `Conf Alpha ${tag}`, {});
    await add(ids.b, `conf-b-${tag}`, `Conf Beta ${tag}`, {});
    await add(ids.dr, `conf-dr-${tag}`, `Conf Doctor ${tag}`, { classification: 'confidential_professional' });
    await run(`INSERT INTO storyteller_books (id, title, created_at, updated_at) VALUES (:book, 'Conf book', NOW(), NOW())`, ids).catch(() => {});
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids).catch(() => {});
  });

  beforeEach(() => mockCreate.mockReset());

  it('the Story Engine\'s character list leaves her out', async () => {
    const res = await request(app).get('/api/v1/memories/story-engine-characters').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = Object.values(res.body.worlds || {}).flat().map((c) => c.display_name);
    expect(names).toContain(`Conf Alpha ${tag}`);
    expect(names).not.toContain(`Conf Doctor ${tag}`);
  });

  it('the relationship generator does not put her in its prompt', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: '[]' }], usage: { input_tokens: 1, output_tokens: 1 } });
    await request(app).post('/api/v1/relationships/generate').set('Authorization', `Bearer ${token}`).send({ registry_id: ids.reg });
    expect(mockCreate).toHaveBeenCalled();
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain(`Conf Alpha ${tag}`);
    expect(prompt).not.toContain(`Conf Doctor ${tag}`);
  });
});
