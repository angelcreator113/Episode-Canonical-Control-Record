/**
 * The typology seed (Character Consistency Engine step 6a), with the
 * Anthropic calls mocked:
 * - set, read and clear it (ADMIN to write);
 * - "suggest" reads their writing and proposes one, saving nothing;
 * - interior generation grows from the seed; the voice build gets the MBTI dial.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptsSent = () => mockCreate.mock.calls.map(([arg]) => [
  typeof arg.system === 'string' ? arg.system : JSON.stringify(arg.system || ''),
  ...(arg.messages || []).map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))),
].join('\n')).join('\n');

(shouldSkip ? describe.skip : describe)('the typology seed', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;
  const url = `/api/v1/cast/characters/${ids.char}/typology`;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-type', email: 'evoni@type.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-type', email: 'e@type.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Type ${TAG}`, slug: `type-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Type ${TAG}` });
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, created_at, updated_at)
      VALUES (:h, 'instagram', 'Slow fashion.', 'lalaverse', 'Type', NOW(), NOW()) RETURNING id`, { h: `@type${TAG}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, depth_level, feed_profile_id, description, core_wound, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren Type', 'support', 'accepted', 'active', :pid, 'Retakes every photo eleven times.', 'Only loved for what she made.', NOW(), NOW())`,
    { ...ids, key: `type-${TAG}`, pid });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :char', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('set, read and clear it; only an admin writes; a bad wing is refused', async () => {
    expect((await request(app).get(url).set('Authorization', `Bearer ${editor}`)).body).toMatchObject({ typology: null, label: null });
    const body = { enneagram: { type: 3, wing: 4 }, mbti: 'ENTJ', why: 'Her worth is her output.' };
    expect((await request(app).put(url).set('Authorization', `Bearer ${editor}`).send(body)).status).toBe(403);
    expect((await request(app).put(url).set('Authorization', `Bearer ${admin}`).send({ enneagram: { type: 3, wing: 7 } })).status).toBe(400);
    const saved = await request(app).put(url).set('Authorization', `Bearer ${admin}`).send(body);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ label: 'Type 3w4, The Achiever', typology: { enneagram: { type: 3, wing: 4 }, mbti: 'ENTJ', set_by: 'evoni@type.dev' } });
    expect((await request(app).get(url).set('Authorization', `Bearer ${editor}`)).body.label).toBe('Type 3w4, The Achiever');
  });

  it('suggest reads their writing and saves nothing', async () => {
    mockCreate.mockResolvedValue(reply({ enneagram: { type: 3, wing: 2 }, mbti: 'ESTJ', why: 'Retakes the photo; love was earned.' }));
    const res = await request(app).post(`${url}/suggest`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ label: 'Type 3w2, The Achiever', suggestion: { mbti: 'ESTJ' } });
    expect(promptsSent()).toContain('Retakes every photo eleven times.');
    const [[row]] = await run('SELECT typology FROM registry_characters WHERE id = :char', ids);
    expect(row.typology.enneagram.wing).toBe(4);
  });

  it('interior generation grows from the seed; the voice build gets the MBTI dial', async () => {
    mockCreate.mockResolvedValue(reply({ dilemma: 'Whether to post the eleventh take.' }));
    await request(app).post(`/api/v1/character-registry/characters/${ids.char}/interior/generate`).set('Authorization', `Bearer ${admin}`).send({ fields: ['dilemma'] });
    expect(promptsSent()).toContain('TYPOLOGY SEED');
    expect(promptsSent()).toContain('Enneagram Type 3w4, The Achiever');

    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply({ case: 'lowercase', punctuation: '', emoji: { use: 'never', favorites: [] }, sentence_length: 'short', topics: [], never_says: [], signature_phrases: [] }));
    const voice = await request(app).post(`/api/v1/pulse-voices/${ids.char}/build`).set('Authorization', `Bearer ${admin}`);
    expect(voice.status).toBe(200);
    expect(promptsSent()).toContain('MBTI dial: ENTJ.');
    expect(promptsSent()).not.toContain('TYPOLOGY SEED');
  });

  it('clear removes it', async () => {
    const res = await request(app).put(url).set('Authorization', `Bearer ${admin}`).send({ clear: true });
    expect(res.body).toMatchObject({ typology: null, label: null });
  });
});
