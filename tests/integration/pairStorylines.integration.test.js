/**
 * A storyline from a kept pair (Evoni's idea 4, PR 3, 2026-10-17), the
 * Anthropic call mocked. Bea (Beauty Oracle) and Tess (Trendsetter) are
 * rivals; Bea is an Alive character in the show with a Voice Profile, Tess
 * has no character yet. Lala has a relationship with Bea.
 * - POST /feed-relationships/:id/storyline-seed (ADMIN) proposes a title and
 *   premise from the pair, says who of them can post, and saves nothing;
 * - Lala's relationships are never seeded (decision c), and the map marks
 *   them so the button does not show;
 * - an unreadable answer is a 502; a show that is not a show id is a 400.
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

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('a storyline from a kept pair', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), char: uuid() };
  const p = {};
  const rel = {};
  let admin;
  let editor;
  let lala;
  let madeLala = false;
  const auth = (r, token = admin) => r.set('Authorization', `Bearer ${token}`);
  const seed = (id, body = { show_id: ids.show }, token = admin) => auth(request(app).post(`/api/v1/feed-relationships/${id}/storyline-seed`), token).send(body);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-seeds', email: 'evoni@seeds.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-seeds', email: 'e@seeds.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Seeds ${tag}`, slug: `seeds-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(db, ids.show, { automated_requests: 100, manual_requests: 100 });
    for (const [key, type] of [['bea', 'The Beauty Oracle'], ['tess', 'The Trendsetter']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, content_category, city, status, created_at, updated_at)
        VALUES (:h, 'pulse', 'x', :d, 'lalaverse', :type, 'skincare', 'velour_city', 'finalized', NOW(), NOW()) RETURNING id`,
      { h: `${key}${tag}`, d: `${key}${tag}`, type });
      p[key] = row.id;
    }
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Seeds', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
      VALUES (:id, :reg, :key, 'Bea', 'alive', :feed, NOW(), NOW())`, { id: ids.char, reg: ids.reg, key: `bea-${tag}`, feed: p.bea });
    await db.PulseVoice.create({ registry_character_id: ids.char, social_profile_id: p.bea, habits_json: { case: 'lowercase' },
      examples_json: [{ text: 'ok so' }], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    lala = await require('../../src/services/lalaFeedProfile').lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'pulse', 'x', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    rel.pair = (await db.SocialProfileRelationship.create({ source_profile_id: p.bea, target_profile_id: p.tess, relationship_type: 'rival',
      description: 'Both call the next skincare trend first; only one gets credit.', drama_level: 6, direction: 'mutual', public_visibility: 'public' })).id;
    rel.lala = (await db.SocialProfileRelationship.create({ source_profile_id: lala, target_profile_id: p.bea, relationship_type: 'collab',
      direction: 'mutual', public_visibility: 'public' })).id;
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM social_profile_relationships WHERE id IN (:ids)', { ids: Object.values(rel) });
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :char', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: [...Object.values(p), ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('proposes a title and premise from the pair, says who can post, and saves nothing', async () => {
    mockCreate.mockResolvedValue(say({ title: 'Who Called It First', premise: `@bea${tag} posts a serum verdict; @tess${tag} swears she said it a month ago.` }));
    const [[{ n: before }]] = await run('SELECT COUNT(*)::int AS n FROM pulse_storylines WHERE show_id = :show', ids);
    const res = await seed(rel.pair);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Who Called It First',
      premise: `@bea${tag} posts a serum verdict; @tess${tag} swears she said it a month ago.`,
      pair: { relationship_id: rel.pair, type: 'rival', a: { id: p.bea, handle: `bea${tag}` }, b: { id: p.tess, handle: `tess${tag}` } },
      can_post: [`@bea${tag}`],
    });
    expect(res.body.note).toContain(`@tess${tag} cannot post in this show yet`);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`@bea${tag} (bea${tag}); known on The Pulse as The Beauty Oracle; posts about skincare; lives in velour city`);
    expect(prompt).toContain('What they are to each other: rival. Both call the next skincare trend first; only one gets credit.');
    expect(prompt).toContain('Drama level: 6 out of 10.');
    const [[{ n: after }]] = await run('SELECT COUNT(*)::int AS n FROM pulse_storylines WHERE show_id = :show', ids);
    expect(after).toBe(before);
  });

  it('is for ADMIN only and needs a show', async () => {
    expect((await seed(rel.pair, { show_id: ids.show }, editor)).status).toBe(403);
    expect((await seed(rel.pair, { show_id: 'nope' })).status).toBe(400);
    expect((await seed(999999999)).status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('never seeds Lala\'s relationships, and the map marks them', async () => {
    const res = await seed(rel.lala);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Lala/);
    expect(mockCreate).not.toHaveBeenCalled();
    const canvas = await auth(request(app).get('/api/v1/feed-relationships/canvas'));
    const edge = (id) => canvas.body.edges.find((e) => e.id === id);
    expect(edge(rel.pair).seedable).toBe(true);
    expect(edge(rel.lala).seedable).toBe(false);
  });

  it('an answer it cannot read is a 502', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'no json here' }], usage: { input_tokens: 1, output_tokens: 1 } });
    const res = await seed(rel.pair);
    expect(res.status).toBe(502);
  });
});
