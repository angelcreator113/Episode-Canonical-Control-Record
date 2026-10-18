/**
 * Suggested pairs (Evoni's idea 4, PR 2, 2026-10-17), the Anthropic call
 * mocked. Bea (Beauty Oracle) and Tess (Trendsetter) post skincare in the
 * same city; Rel (Relatable Friend) posts parenting; Lala is never paired.
 * - suggestPairs scores unrelated pairs by audience overlap, one AI call
 *   names each pair's kind and why, and they wait (nothing is made);
 * - GET /feed-relationships/suggestions lists them with both creators;
 * - Keep (ADMIN) makes the relationship and clears the suggestion; a pair
 *   that is already related is never suggested;
 * - Dismiss (ADMIN) clears it and it is never suggested again;
 * - auto-discover's matches (addRulePairs) wait too, never with Lala.
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
const STORE_SQL = "page_name = 'feed_relationships' AND constant_key = 'PAIR_SUGGESTIONS'";

(shouldSkip ? describe.skip : describe)('suggested pairs', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const p = {};
  let admin;
  let editor;
  let before;
  let lala;
  let madeLala = false;
  const pairs = require('../../src/services/pairSuggestions');
  const auth = (r, token = admin) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-pairs', email: 'evoni@pairs.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-pairs', email: 'e@pairs.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    [[before]] = await run(`SELECT data FROM page_content WHERE ${STORE_SQL}`);
    await run(`DELETE FROM page_content WHERE ${STORE_SQL}`);
    for (const [key, type, niche] of [['bea', 'The Beauty Oracle', `skincare ${tag}`], ['tess', 'The Trendsetter', `skincare ${tag}`], ['rel', 'The Relatable Friend', `parenting ${tag}`]]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, content_category, city, status, created_at, updated_at)
        VALUES (:h, 'pulse', 'x', :d, 'lalaverse', :type, :niche, 'velour_city', 'finalized', NOW(), NOW()) RETURNING id`,
      { h: `@${key}${tag}`, d: `${key}${tag}`, type, niche });
      p[key] = row.id;
    }
    lala = await require('../../src/services/lalaFeedProfile').lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, content_category, city, status, created_at, updated_at)
        VALUES ('lala', 'pulse', 'x', 'Lala', 'lalaverse', 'The Beauty Oracle', :niche, 'velour_city', 'finalized', NOW(), NOW()) RETURNING id`, { niche: `skincare ${tag}` });
      lala = row.id;
      madeLala = true;
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run(`DELETE FROM page_content WHERE ${STORE_SQL}`);
    if (before) await run(`INSERT INTO page_content (page_name, constant_key, data, created_at, updated_at) VALUES ('feed_relationships', 'PAIR_SUGGESTIONS', CAST(:d AS jsonb), NOW(), NOW())`, { d: JSON.stringify(before.data) });
    const ids = [...Object.values(p), ...(madeLala ? [lala] : [])];
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:ids) OR target_profile_id IN (:ids)', { ids });
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids });
    await sequelize.close();
  });

  it('suggests the overlapping pair, never Lala, and makes nothing', async () => {
    mockCreate.mockResolvedValue(say({ items: [{ n: 1, type: 'rival', why: 'Both call the next skincare trend first; only one gets credit.', drama_level: 6 }] }));
    const { added } = await pairs.suggestPairs(db, { onlyIds: [p.bea, p.tess, p.rel, lala] });
    expect(added).toEqual([expect.objectContaining({ key: pairs.pairKey(p.bea, p.tess), type: 'rival', drama_level: 6, source: 'suggest', why: expect.stringContaining('skincare') })]);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`niche: skincare ${tag}`);
    expect(prompt).not.toMatch(/@lala\b/);
    const [[rels]] = await run('SELECT COUNT(*)::int AS n FROM social_profile_relationships WHERE source_profile_id IN (:ids) OR target_profile_id IN (:ids)', { ids: Object.values(p) });
    expect(rels.n).toBe(0);
  });

  it('lists what is waiting, with both creators', async () => {
    const res = await auth(request(app).get('/api/v1/feed-relationships/suggestions'));
    expect(res.status).toBe(200);
    const mine = res.body.pairs.find((x) => x.key === pairs.pairKey(p.bea, p.tess));
    expect(mine.profile_a.handle).toMatch(/bea|tess/);
    expect(mine.profile_b.content_category).toBe(`skincare ${tag}`);
  });

  it('keeps a pair as a relationship (ADMIN only), with Evoni\'s kind and line; it is never suggested again', async () => {
    const key = pairs.pairKey(p.bea, p.tess);
    expect((await auth(request(app).post(`/api/v1/feed-relationships/suggestions/${key}/keep`), editor).send({})).status).toBe(403);
    const res = await auth(request(app).post(`/api/v1/feed-relationships/suggestions/${key}/keep`)).send({ type: 'collab', why: 'They co-host a skincare live.' });
    expect(res.status).toBe(201);
    const [[rel]] = await run(`SELECT relationship_type::text AS type, description, auto_generated FROM social_profile_relationships
      WHERE (source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a)`, { a: p.bea, b: p.tess });
    expect(rel).toEqual({ type: 'collab', description: 'They co-host a skincare live.', auto_generated: false });
    expect((await auth(request(app).post(`/api/v1/feed-relationships/suggestions/${key}/keep`)).send({})).status).toBe(404);
    const { added } = await pairs.suggestPairs(db, { onlyIds: [p.bea, p.tess] });
    expect(added).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('dismisses a pair for good; auto-discover\'s matches wait too, never with Lala', async () => {
    const added = await pairs.addRulePairs(db, [
      { a: p.bea, b: p.rel, type: 'collab', why: 'Shared city' },
      { a: lala, b: p.rel, type: 'collab' },
      { a: p.bea, b: p.tess, type: 'rival' },
    ]);
    expect(added.map((x) => x.key)).toEqual([pairs.pairKey(p.bea, p.rel)]);
    expect(added[0]).toMatchObject({ source: 'auto', why: 'Shared city' });
    const key = pairs.pairKey(p.bea, p.rel);
    expect((await auth(request(app).post(`/api/v1/feed-relationships/suggestions/${key}/dismiss`))).status).toBe(200);
    expect(await pairs.addRulePairs(db, [{ a: p.rel, b: p.bea, type: 'collab' }])).toEqual([]);
    const list = (await auth(request(app).get('/api/v1/feed-relationships/suggestions'))).body.pairs;
    expect(list.find((x) => x.key === key)).toBeUndefined();
  });
});
