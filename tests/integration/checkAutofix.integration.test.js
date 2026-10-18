/**
 * Suggested fixes for the consistency check (Evoni, 2026-10-17: "i want to
 * be able to auto fix the text issues"), the Anthropic call mocked. Her
 * account is rising; her profile says she went dark, a luxury above her
 * income, and two sentences the check no longer flags ("goes quiet" is a
 * mood, sponsors "gone silent" are the sponsors).
 * - POST /check/suggest (ADMIN) proposes a rewrite of each flagged
 *   sentence, or that it is fine, and saves nothing;
 * - POST /check/fix { flag_id, before, after } swaps that one sentence and
 *   leaves the rest of the field as it was.
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
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });
const DESCRIPTION = 'Velvet runs a vintage label. She went dark after the retakes. When people compliment her influence on another creator, she goes quiet for days.';
const SIGNAL = 'Three sponsors in six weeks have confirmed deals and gone silent within 48 hours.';

(shouldSkip ? describe.skip : describe)('suggested fixes for the check', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const url = (tail) => `/api/v1/cast/characters/${ids.char}/check${tail}`;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-autofix', email: 'evoni@autofix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-autofix', email: 'e@autofix.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Autofix ${TAG}`, slug: `autofix-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Autofix ${TAG}` });
    const [[p]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, current_state, display_name, real_signal, created_at, updated_at)
       VALUES (:h, 'pulse', 'Vintage.', 'lalaverse', 'rising', :name, :signal, NOW(), NOW()) RETURNING id`,
      { h: `@autofix${TAG}`, name: `Velvet ${TAG}`, signal: SIGNAL });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, description, created_at, updated_at)
      VALUES (:char, :reg, :key, :name, 'support', 'accepted', :pid, :desc, NOW(), NOW())`,
    { ...ids, key: `autofix-${TAG}`, name: `Velvet ${TAG}`, pid, desc: DESCRIPTION });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('flags "went dark", not a mood or the sponsors going quiet', async () => {
    const { flags } = (await as(editor, request(app).get(url('')))).body;
    const status = flags.filter((f) => f.check === 'account_status');
    expect(status.map((f) => f.found)).toEqual(['went dark']);
  });

  it('suggests a rewrite of the flagged sentence and saves nothing; editors cannot ask', async () => {
    expect((await as(editor, request(app).post(url('/suggest')))).status).toBe(403);
    mockCreate.mockResolvedValue(say({ items: [{ n: 1, verdict: 'fix', sentence: 'She kept posting through the retakes.', why: 'Her account is rising.' }] }));
    const res = await as(admin, request(app).post(url('/suggest')));
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([expect.objectContaining({
      verdict: 'fix', before: 'She went dark after the retakes.', after: 'She kept posting through the retakes.', why: 'Her account is rising.',
    })]);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('She went dark after the retakes.');
    expect(prompt).toContain('account status: ');
    const [[row]] = await run('SELECT description FROM registry_characters WHERE id = :char', ids);
    expect(row.description).toBe(DESCRIPTION);
  });

  it('applying the rewrite swaps that one sentence only, and the finding is gone', async () => {
    const { flags } = (await as(editor, request(app).get(url('')))).body;
    const flag = flags.find((f) => f.check === 'account_status');
    const res = await as(admin, request(app).post(url('/fix'))).send({
      flag_id: flag.id, before: 'She went dark after the retakes.', after: 'She kept posting through the retakes.',
    });
    expect(res.status).toBe(200);
    expect(res.body.flags.find((f) => f.id === flag.id)).toBeUndefined();
    const [[row]] = await run('SELECT description FROM registry_characters WHERE id = :char', ids);
    expect(row.description).toBe(DESCRIPTION.replace('She went dark after the retakes.', 'She kept posting through the retakes.'));
  });

  it('with nothing to suggest for, makes no AI call', async () => {
    const res = await as(admin, request(app).post(url('/suggest')));
    expect(res.body.suggestions).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
