/**
 * Appearance (Evoni, 2026-10-17: "we need an appearance tab and a
 * generator"; "yes to the portrait images"), the AI, the image provider and
 * storage stubbed:
 * - their look is read and saved (ADMIN), its portraits kept across saves;
 * - "suggest" reads their whole character file, keeps to the LalaVerse (no
 *   real brands) and to no measurements, and saves nothing;
 * - a portrait needs a saved look; it is made from it, kept in the studio's
 *   storage and listed; one becomes their profile photo; a spent image
 *   budget is a 429;
 * - the look joins their character file.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const imageGen = require('../../src/services/imageGenerationService');
const pulseImage = require('../../src/services/pulseImageService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('appearance', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let admin;
  let editor;
  const as = (method, path, body, token = admin) => request(app)[method](`/api/v1/cast/characters/${ids.char}/appearance${path}`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-look', email: 'evoni@look.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-look', email: 'e@look.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Look ${tag}`, slug: `look-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Look', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, core_wound, physical_presence, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren', :wound, 'Takes up very little room on purpose', CAST(:facts AS jsonb), NOW(), NOW())`,
    { ...ids, key: `look-${tag}`, wound: `WOUND-${tag}: worthless without achievement`, facts: JSON.stringify({ occupation: 'Slow-fashion creator', income: { amount: 60000, cadence: 'per_year' } }) });
  });

  beforeEach(() => {
    mockCreate.mockReset();
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('reads and saves their look (ADMIN); nothing written is a 400', async () => {
    const empty = await as('get', '');
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ appearance: null, lines: '', portrait_url: null });
    expect((await as('put', '', { summary: 'x' }, editor)).status).toBe(403);
    expect((await as('put', '', { summary: '  ' })).status).toBe(400);
    const saved = await as('put', '', { summary: 'Tall, still, linen-pale', hair: 'Ash blonde, cropped', palette: 'oat, ink, bone' });
    expect(saved.status).toBe(200);
    expect(saved.body.appearance).toMatchObject({ summary: 'Tall, still, linen-pale', hair: 'Ash blonde, cropped', palette: ['oat', 'ink', 'bone'], set_by: 'evoni@look.dev', portraits: [] });
    expect(saved.body.lines).toContain('- hair: Ash blonde, cropped');
  });

  it('suggests a look from their whole file, LalaVerse and no measurements; saves nothing', async () => {
    mockCreate.mockResolvedValue(reply({ summary: 'Linen and stillness', face: 'Sharp, unsmiling', palette: ['oat'], never_wears: 'Logos', why: 'Her mask is calm.' }));
    const res = await as('post', '/suggest');
    expect(res.status).toBe(200);
    expect(res.body.proposal).toEqual({ summary: 'Linen and stillness', face: 'Sharp, unsmiling', palette: ['oat'], never_wears: 'Logos', why: 'Her mask is calm.' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    for (const part of [`WOUND-${tag}`, 'what they do: Slow-fashion creator', 'Takes up very little room on purpose', 'no real brands', 'No measurements']) expect(prompt).toContain(part);
    // Her saved look is in the file it read; nothing changed.
    expect(prompt).toContain('HOW THEY LOOK');
    const [[row]] = await run('SELECT appearance FROM registry_characters WHERE id = :char', ids);
    expect(row.appearance.summary).toBe('Tall, still, linen-pale');
    expect((await as('post', '/suggest', {}, editor)).status).toBe(403);
  });

  it('makes a portrait from the saved look, keeps it, and one becomes their profile photo', async () => {
    const gen = jest.spyOn(imageGen, 'generateImage').mockResolvedValue({ url: 'https://fal.example/tmp.jpg', cost_estimate: 0.04 });
    jest.spyOn(axios, 'get').mockResolvedValue({ data: Buffer.from('jpeg') });
    const store = jest.spyOn(pulseImage, 'storePulseImage').mockResolvedValue({ url: `https://studio.example/characters/${ids.char}/generated/p1.jpg` });
    const made = await as('post', '/portrait');
    expect(made.status).toBe(200);
    expect(made.body).toMatchObject({ url: `https://studio.example/characters/${ids.char}/generated/p1.jpg`, cost: 0.04 });
    const [prompt, options] = gen.mock.calls[0];
    expect(prompt).toContain('Tall, still, linen-pale');
    expect(prompt).toContain('Hair: Ash blonde, cropped');
    expect(prompt).toContain('No text, no letters, no logos');
    expect(options).toEqual({ useCase: 'character', size: 'portrait' });
    expect(store.mock.calls[0][1]).toMatchObject({ keyPrefix: `characters/${ids.char}/generated` });
    expect(made.body.appearance.portraits).toEqual([expect.objectContaining({ url: made.body.url, prompt })]);

    // Saving the look again keeps the portraits.
    const resaved = await as('put', '', { summary: 'Tall, still, linen-pale', hair: 'Ash blonde, grown out' });
    expect(resaved.body.appearance.portraits).toHaveLength(1);

    expect((await as('post', '/portrait/use', { url: 'https://elsewhere/x.jpg' })).status).toBe(400);
    const used = await as('post', '/portrait/use', { url: made.body.url });
    expect(used.status).toBe(200);
    expect(used.body.portrait_url).toBe(made.body.url);
  });

  it('a portrait needs a saved look; a spent image budget is a 429', async () => {
    const budget = Object.assign(new Error('Today\'s image budget is spent.'), { code: 'AI_BUDGET_EXCEEDED', status: 429 });
    jest.spyOn(imageGen, 'generateImage').mockRejectedValue(budget);
    const spent = await as('post', '/portrait');
    expect(spent.status).toBe(429);
    expect(spent.body.error).toBe('Today\'s image budget is spent.');
    await run('UPDATE registry_characters SET appearance = NULL WHERE id = :char', ids);
    const none = await as('post', '/portrait');
    expect(none.status).toBe(409);
    expect(none.body.error).toMatch(/Save their appearance first/);
  });
});
