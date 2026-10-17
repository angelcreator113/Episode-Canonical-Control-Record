/**
 * Suggest facts from their profile (Evoni, 2026-10-17): POST
 * /api/v1/cast/characters/:id/facts/suggest, the Anthropic call mocked.
 * Maren: 2M followers, occupation decided, income not decided yet,
 * possessions missing; her career and lifestyle written; her claim (the
 * mask) says she lives in a penthouse.
 * - only the missing fact is proposed (possessions), never a decided or an
 *   undecided one, and nothing is saved;
 * - the prompt reads what is true and her facts, not the mask;
 * - ADMIN only; 409 when nothing is missing; 502 on an unreadable answer.
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

(shouldSkip ? describe.skip : describe)('suggest facts from their profile', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;
  const suggest = (token = admin) => request(app).post(`/api/v1/cast/characters/${ids.char}/facts/suggest`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-sugfacts', email: 'evoni@sugfacts.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-sugfacts', email: 'e@sugfacts.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `SugFacts ${tag}`, slug: `sugfacts-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'SugFacts', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lifestyle_claim, lifestyle_reality, created_at, updated_at)
      VALUES (:h, 'pulse', 'Slow fashion.', 'Maren', 'lalaverse', 'MASK-PENTHOUSE-${tag}', 'A rented loft above her linen studio.', NOW(), NOW()) RETURNING id`, { h: `@sug${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, career_status, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren', :pid, CAST(:career AS jsonb), CAST(:facts AS jsonb), NOW(), NOW())`,
    { ...ids, key: `sug-${tag}`, pid, career: JSON.stringify({ profession: 'Slow-fashion creator', financial_status: 'Brand deals, uneven' }), facts: JSON.stringify({ occupation: 'Slow-fashion creator', undecided: ['income'] }) });
    await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
      VALUES (:show, :pid, 0, 2000000, 2000000, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('proposes only the missing fact, from what is true, and saves nothing', async () => {
    mockCreate.mockResolvedValue(reply({ occupation: 'Something else', income: { amount: 1, cadence: 'per_year' }, major_possessions: ['The linen studio', 'A 1974 Vespa'], why: 'Her lifestyle says a loft above her studio.' }));
    const res = await suggest();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fills: ['major_possessions'], proposal: { major_possessions: ['The linen studio', 'A 1974 Vespa'] }, why: 'Her lifestyle says a loft above her studio.' });
    expect(res.body.proposal.occupation).toBeUndefined();
    expect(res.body.proposal.income).toBeUndefined();
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('A rented loft above her linen studio.');
    expect(prompt).toContain('- followers: 2M (2,000,000)');
    expect(prompt).toContain('"major_possessions": up to 5');
    expect(prompt).not.toContain(`MASK-PENTHOUSE-${tag}`);
    expect(prompt).not.toContain('"occupation": what they do');
    const [[row]] = await run('SELECT canon_facts FROM registry_characters WHERE id = :char', ids);
    expect(row.canon_facts.major_possessions).toBeUndefined();
  });

  it('is ADMIN only; an unreadable answer is a 502; nothing missing is a 409', async () => {
    expect((await suggest(editor)).status).toBe(403);
    mockCreate.mockResolvedValue(reply('not json at all'));
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'no json here' }] });
    expect((await suggest()).status).toBe(502);
    await run(`UPDATE registry_characters SET canon_facts = CAST(:facts AS jsonb) WHERE id = :char`,
      { ...ids, facts: JSON.stringify({ occupation: 'Slow-fashion creator', undecided: ['income'], major_possessions: ['The linen studio'] }) });
    mockCreate.mockReset();
    const none = await suggest();
    expect(none.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
