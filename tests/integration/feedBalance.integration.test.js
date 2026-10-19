/**
 * The Feed's balance (Evoni's idea 6, 2026-10-17), the Anthropic call
 * mocked: the Society tab's batch of content-type suggestions tells the AI
 * how many profiles have each type, counting each suggestion it has already
 * made, so a batch does not pile onto one type.
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

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });
const archivistCount = (prompt) => {
  const m = prompt.match(/- The Archivist:[^\n]*\[(\d+) on The Pulse|- The Archivist:[^\n]*\[nobody on The Pulse yet/);
  return m ? Number(m[1] || 0) : null;
};

(shouldSkip ? describe.skip : describe)('The Pulse\'s balance in the content-type batch', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const pids = [];
  let admin;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-balance', email: 'evoni@balance.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    for (const name of ['One', 'Two']) {
      const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, content_persona, created_at, updated_at)
        VALUES (:h, 'pulse', 'Old dresses.', :name, 'lalaverse', 'Vintage fashion history threads', NOW(), NOW()) RETURNING id`, { h: `@bal${name}${tag}`, name });
      pids.push(p.id);
    }
  });

  afterAll(async () => {
    await run('DELETE FROM social_profiles WHERE id IN (:pids)', { pids });
    await sequelize.close();
  });

  it('counts each suggestion already made in the batch, and asks for range', async () => {
    mockCreate.mockResolvedValue(reply({ society_archetype: 'The Archivist', why: 'Fashion history.', differs_from_job: false }));
    const res = await request(app).post('/api/v1/cast/content-types/suggest-unset').set('Authorization', `Bearer ${admin}`).send({ profile_ids: pids });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(2);
    const [first, second] = mockCreate.mock.calls.map((c) => c[0].messages[0].content);
    expect(second).toMatch(/The Pulse needs range/);
    expect(archivistCount(second)).toBe((archivistCount(first) || 0) + 1);
  });
});
