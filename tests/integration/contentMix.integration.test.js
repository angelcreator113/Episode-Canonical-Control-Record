/**
 * The content mix (Evoni's idea 3, 2026-10-17: "yes start the content
 * mix"), the Anthropic calls mocked. Bea is known on The Pulse as The
 * Beauty Oracle; her last posts were all tutorials.
 * - /cast/content-pillars: every type on the Society tab with its mix (the
 *   defaults); Evoni's own saved over a default (ADMIN only; a type off the
 *   list or no pillars is a 400); reset back to the default; suggest one
 *   (nothing saved);
 * - Generate Posts plans each post as the pillar furthest below its share
 *   (not another tutorial) and records each draft's pillar; with "what is
 *   happening" given, the AI frames it as any pillar;
 * - post ideas offer the next pillar in her mix;
 * - the gate's lane check and her character file carry the mix.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });
const prompts = () => mockCreate.mock.calls.map(([arg]) => arg.messages[0].content);

(shouldSkip ? describe.skip : describe)('the content mix', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;
  let before;
  const auth = (r, token = admin) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-mix', email: 'evoni@mix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-mix', email: 'e@mix.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    [[before]] = await run("SELECT data FROM page_content WHERE page_name = 'influencer_systems' AND constant_key = 'CONTENT_PILLARS'");
    await run("DELETE FROM page_content WHERE page_name = 'influencer_systems' AND constant_key = 'CONTENT_PILLARS'");
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Mix ${TAG}`, slug: `mix-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Mix ${TAG}` });
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, society_archetype, public_persona, display_name, created_at, updated_at)
      VALUES (:h, 'pulse', 'Skin first.', 'lalaverse', 'The Beauty Oracle', 'The last word on skin', 'Bea', NOW(), NOW()) RETURNING id`, { h: `@bea${TAG}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Bea', 'support', 'accepted', :pid, NOW(), NOW())`, { ...ids, key: `bea-${TAG}`, pid });
    await db.PulseVoice.create({
      registry_character_id: ids.char, social_profile_id: pid, habits_json: { temperament: 'certain' },
      examples_json: [{ text: 'Double cleanse. Always.' }], status: 'built', approved_at: new Date(), approved_by: 'evoni',
    });
    for (let i = 0; i < 4; i += 1) {
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, gate_json, created_at, updated_at)
        VALUES (:id, :show, :h, :pid, :t, 'live', CAST(:g AS jsonb), NOW() - (:i || ' hours')::interval, NOW())`,
      { id: crypto.randomUUID(), show: ids.show, h: `bea${TAG}`, pid, t: `Tutorial ${i}`, g: JSON.stringify({ pillar: 'Tutorial or technique' }), i: String(i + 1) });
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run("DELETE FROM page_content WHERE page_name = 'influencer_systems' AND constant_key = 'CONTENT_PILLARS'");
    if (before) {
      await run(`INSERT INTO page_content (page_name, constant_key, data, created_at, updated_at)
        VALUES ('influencer_systems', 'CONTENT_PILLARS', CAST(:d AS jsonb), NOW(), NOW())`, { d: JSON.stringify(before.data) });
    }
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :char', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('lists every type with its default mix', async () => {
    const res = await auth(request(app).get('/api/v1/cast/content-pillars'));
    expect(res.status).toBe(200);
    const bea = res.body.types.find((t) => t.name === 'The Beauty Oracle');
    expect(bea).toMatchObject({ custom: false, has_default: true });
    expect(bea.pillars.map((p) => p.name)).toEqual(['Tutorial or technique', 'Product verdict', '"This is over" call', 'Routine']);
    expect(bea.pillars.reduce((a, p) => a + p.share, 0)).toBe(100);
  });

  it('saves Evoni\'s own mix over the default (ADMIN only), refuses bad ones, and resets', async () => {
    const mine = { name: 'The Beauty Oracle', pillars: [{ name: 'Glass skin', share: 3, example: 'x' }, { name: 'Verdict', share: 1 }] };
    expect((await auth(request(app).put('/api/v1/cast/content-pillars'), editor).send(mine)).status).toBe(403);
    expect((await auth(request(app).put('/api/v1/cast/content-pillars')).send({ name: 'The Night Nurse', pillars: mine.pillars })).status).toBe(400);
    expect((await auth(request(app).put('/api/v1/cast/content-pillars')).send({ name: 'The Beauty Oracle', pillars: [{ share: 50 }] })).status).toBe(400);
    const saved = await auth(request(app).put('/api/v1/cast/content-pillars')).send(mine);
    expect(saved.status).toBe(200);
    expect(saved.body.pillars).toEqual([{ name: 'Glass skin', share: 75, example: 'x' }, { name: 'Verdict', share: 25, example: '' }]);
    const listed = (await auth(request(app).get('/api/v1/cast/content-pillars'))).body.types.find((t) => t.name === 'The Beauty Oracle');
    expect(listed).toMatchObject({ custom: true });
    const reset = await auth(request(app).put('/api/v1/cast/content-pillars')).send({ name: 'The Beauty Oracle', pillars: null });
    expect(reset.body.pillars[0].name).toBe('Tutorial or technique');
  });

  it('suggests a mix and saves nothing', async () => {
    mockCreate.mockResolvedValue(say({ pillars: [{ name: 'Skit', share: 60, example: 'a' }, { name: 'Reaction', share: 40, example: 'b' }] }));
    const res = await auth(request(app).post('/api/v1/cast/content-pillars/suggest')).send({ name: 'The Entertainer' });
    expect(res.status).toBe(200);
    expect(res.body.pillars.map((p) => p.share)).toEqual([60, 40]);
    expect(prompts()[0]).toContain('Content type: The Entertainer');
    const [[row]] = await run("SELECT COUNT(*)::int AS n FROM page_content WHERE page_name = 'influencer_systems' AND constant_key = 'CONTENT_PILLARS' AND data ? 'The Entertainer'");
    expect(row.n).toBe(0);
  });

  it('plans each post as the pillar she is behind on and records each draft\'s pillar', async () => {
    mockCreate.mockImplementation(async ({ messages }) => {
      const prompt = messages[0].content;
      if (prompt.startsWith('Score how well')) return say({ score: 0.92, why: 'her', lane: 'in' });
      return say({ items: [
        { n: 1, text: 'Verdict: overrated.', weight: 'ambient', pillar: 'product verdict' },
        { n: 2, text: 'Glitter brows are over.', weight: 'ambient', pillar: 'Not a pillar' },
      ] });
    });
    const res = await auth(request(app).post(`/api/v1/cast/characters/${ids.char}/posts/generate`)).send({ count: 2 });
    expect(res.status).toBe(201);
    const write = prompts().find((p) => p.startsWith('You write'));
    expect(write).toContain('Their content mix (the kinds of post they make');
    expect(write).toContain('post 1 is a Product verdict post; post 2 is a "This is over" call post');
    expect(write).not.toContain('post 1 is a Tutorial or technique post');
    const [rows] = await run(`SELECT content_text, gate_json->>'pillar' AS pillar FROM feed_posts
      WHERE social_profile_id = :pid AND status = 'draft' ORDER BY content_text`, { pid });
    expect(rows).toEqual([
      { content_text: 'Glitter brows are over.', pillar: '"This is over" call' },
      { content_text: 'Verdict: overrated.', pillar: 'Product verdict' },
    ]);
    const gatePrompt = prompts().find((p) => p.startsWith('Score how well'));
    expect(gatePrompt).toContain('Their content mix: Tutorial or technique, Product verdict');
  });

  it('with what is happening given, lets the AI frame it as any pillar', async () => {
    mockCreate.mockImplementation(async ({ messages }) => (messages[0].content.startsWith('Score how well')
      ? say({ score: 0.92, why: 'her' })
      : say({ items: [{ n: 1, text: 'Gala skin prep.', weight: 'ambient', pillar: 'Routine' }] })));
    const res = await auth(request(app).post(`/api/v1/cast/characters/${ids.char}/posts/generate`)).send({ count: 1, about: 'The night before the gala.' });
    expect(res.status).toBe(201);
    expect(prompts().find((p) => p.startsWith('You write'))).toContain('Frame each post as one of these pillars');
    expect(res.body.drafted[0].pillar).toBe('Routine');
  });

  it('post ideas offer the next pillar in her mix; her character file carries the mix', async () => {
    const res = await auth(request(app).get(`/api/v1/cast/characters/${ids.char}/posts/ideas`));
    expect(res.status).toBe(200);
    const idea = res.body.ideas.find((i) => i.key === 'known_for');
    expect(idea.label).toMatch(/^Next in their mix: /);
    expect(idea.label).not.toBe('Next in their mix: Tutorial or technique');

    const { characterFilePrompt } = require('../../src/services/characterFile');
    const { block } = await characterFilePrompt(db, { character: await db.RegistryCharacter.findByPk(ids.char), publicOnly: true });
    expect(block).toContain('Their content mix (the kinds of post they make');
  });
});
