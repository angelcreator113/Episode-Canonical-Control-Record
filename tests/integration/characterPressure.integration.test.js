/**
 * Pressure test (the spec's #6; Evoni, 2026-10-17): POST
 * /api/v1/cast/characters/:id/pressure-test, the Anthropic call mocked.
 * Maren: 2M followers, slow-fashion creator, $60,000 a year, a Type 3; her
 * mask claims a penthouse, behind it a rented loft.
 * - the prompt carries her whole character file (facts, type seed, inner
 *   life, mask, what is behind it) and says the mask is never a failure;
 * - the answer comes back hardest first, counted, with a verdict;
 *   unreadable answers and malformed questions are dropped or a 502;
 * - ADMIN only; a character with too little written is a 409; nothing saved.
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

(shouldSkip ? describe.skip : describe)('pressure test', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), thin: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;
  const test = (id = ids.char, token = admin) => request(app).post(`/api/v1/cast/characters/${id}/pressure-test`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-pressure', email: 'evoni@pressure.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-pressure', email: 'e@pressure.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Pressure ${tag}`, slug: `pressure-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Pressure', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lifestyle_claim, lifestyle_reality, created_at, updated_at)
      VALUES (:h, 'pulse', 'Slow fashion.', 'Maren', 'lalaverse', 'MASK-PENTHOUSE-${tag}', 'BEHIND-LOFT-${tag}: a rented loft above her linen studio.', NOW(), NOW()) RETURNING id`, { h: `@pres${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, core_wound, want_architecture, typology, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren', :pid, :wound, CAST(:want AS jsonb), CAST(:typ AS jsonb), CAST(:facts AS jsonb), NOW(), NOW())`,
    {
      ...ids, key: `pres-${tag}`, pid,
      wound: `WOUND-${tag}: being seen as worthless without achievement, learned from a mother who only praised results`,
      want: JSON.stringify({ surface_want: 'to be the most respected slow-fashion voice', real_want: 'to be loved when she is not performing', forbidden_want: 'to quit' }),
      typ: JSON.stringify({ enneagram: { type: 3, wing: 4 }, why: 'image first' }),
      facts: JSON.stringify({ occupation: 'Slow-fashion creator', income: { amount: 60000, cadence: 'per_year', source: 'brand deals' } }),
    });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
      VALUES (:thin, :reg, :key, 'Thin', NOW(), NOW())`, { ...ids, key: `thin-${tag}` });
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

  it('asks the hard questions from her whole file and answers hardest first, with a verdict', async () => {
    mockCreate.mockResolvedValue(reply({ questions: [
      { question: 'How does she afford the studio on $60,000?', about: 'money', verdict: 'answers', answer: 'It is rented, above the studio.', cites: ['BEHIND THE MASK lifestyle reality'], fix: 'ignored' },
      { question: 'What car does she drive?', about: 'possessions', verdict: 'gap', answer: 'Nothing says.', cites: [], fix: 'Add what she owns to her facts.' },
      { question: 'Why does a Type 3 want to quit?', about: 'type', verdict: 'contradiction', answer: 'Her forbidden want reads as a Type 9.', cites: ['TYPOLOGY SEED', 'INNER LIFE want architecture'], fix: 'Tie quitting to the fear of failing.' },
      { question: '', verdict: 'answers' },
      { question: 'Bad verdict', verdict: 'maybe' },
    ] }));
    const res = await test();
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('fails');
    expect(res.body.summary).toEqual({ answers: 1, gaps: 1, contradictions: 1 });
    expect(res.body.questions.map((q) => q.verdict)).toEqual(['contradiction', 'gap', 'answers']);
    expect(res.body.questions[2]).toMatchObject({ about: 'money', fix: null, cites: ['BEHIND THE MASK lifestyle reality'] });

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    for (const part of ['THE CHARACTER FILE for Maren', '- followers: 2M (2,000,000)', 'TYPOLOGY SEED', `WOUND-${tag}`, `MASK-PENTHOUSE-${tag}`, `BEHIND-LOFT-${tag}`]) expect(prompt).toContain(part);
    expect(prompt).toContain('a difference there is never a contradiction');
    const [[row]] = await run('SELECT canon_facts FROM registry_characters WHERE id = :char', ids);
    expect(row.canon_facts).toEqual({ occupation: 'Slow-fashion creator', income: { amount: 60000, cadence: 'per_year', source: 'brand deals' } });
  });

  it('holds when every answer comes from the file; an unreadable answer is a 502', async () => {
    mockCreate.mockResolvedValueOnce(reply({ questions: [{ question: 'Is she active?', about: 'status', verdict: 'answers', answer: 'Yes.', cites: ['FACTS'] }] }));
    expect((await test()).body).toMatchObject({ verdict: 'holds', summary: { answers: 1, gaps: 0, contradictions: 0 } });
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'no json here' }] });
    expect((await test()).status).toBe(502);
    mockCreate.mockResolvedValueOnce(reply({ questions: [] }));
    expect((await test()).status).toBe(502);
  });

  it('ADMIN only; too little written is a 409 with no AI call; unknown is a 404', async () => {
    expect((await test(ids.char, editor)).status).toBe(403);
    const thin = await test(ids.thin);
    expect(thin.status).toBe(409);
    expect(thin.body.error).toMatch(/too little written/);
    expect(mockCreate).not.toHaveBeenCalled();
    expect((await test(crypto.randomUUID())).status).toBe(404);
    expect((await test('nope')).status).toBe(400);
  });
});
