/**
 * Shared audiences (Evoni's idea 4, 2026-10-17), the Anthropic call mocked.
 * Bea is a Beauty Oracle; Tess a Trendsetter (shares Bea's audience), Lux a
 * Luxury Icon (no link to Bea), Rel a Relatable Friend (competes with Lux).
 * Bea, Tess and Lux are all in skincare; Rel posts about parenting.
 * - /cast/audience-map: every type with its links (the defaults); Evoni's
 *   own saved over a default (ADMIN only; a type off the list is a 400);
 *   reset; suggest (nothing saved);
 * - audienceScores: a poster's overlap with others by their content types;
 *   Lala is never scored, as poster or as other (decision c);
 * - drafting reactions: after the poster's relationships, creators whose
 *   audience overlaps come before the general fill.
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
const KEY_SQL = "page_name = 'influencer_systems' AND constant_key = 'AUDIENCE_MAP'";

(shouldSkip ? describe.skip : describe)('shared audiences', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const p = {};
  let admin;
  let editor;
  let before;
  let lala;
  let madeLala = false;
  const auth = (r, token = admin) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-aud', email: 'evoni@aud.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-aud', email: 'e@aud.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    [[before]] = await run(`SELECT data FROM page_content WHERE ${KEY_SQL}`);
    await run(`DELETE FROM page_content WHERE ${KEY_SQL}`);
    for (const [key, type, niche] of [['bea', 'The Beauty Oracle', `skincare ${tag}`], ['tess', 'The Trendsetter', `skincare ${tag}`], ['lux', 'The Luxury Icon', `skincare ${tag}`], ['rel', 'The Relatable Friend', `parenting ${tag}`]]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, content_category, status, lala_relevance_score, created_at, updated_at)
        VALUES (:h, 'pulse', 'x', :d, 'lalaverse', :type, :niche, 'finalized', :rel, NOW(), NOW()) RETURNING id`,
      { h: `@${key}${tag}`, d: `${key}${tag}`, type, niche, rel: key === 'lux' ? 99 : 1 });
      p[key] = row.id;
    }
    lala = await require('../../src/services/lalaFeedProfile').lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'pulse', 'x', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run(`DELETE FROM page_content WHERE ${KEY_SQL}`);
    if (before) await run(`INSERT INTO page_content (page_name, constant_key, data, created_at, updated_at) VALUES ('influencer_systems', 'AUDIENCE_MAP', CAST(:d AS jsonb), NOW(), NOW())`, { d: JSON.stringify(before.data) });
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: [...Object.values(p), ...(madeLala ? [lala] : [])] });
    await sequelize.close();
  });

  it('lists every type with its default links', async () => {
    const res = await auth(request(app).get('/api/v1/cast/audience-map'));
    expect(res.status).toBe(200);
    const bea = res.body.types.find((t) => t.name === 'The Beauty Oracle');
    expect(bea).toEqual({ name: 'The Beauty Oracle', shares: ['The Trendsetter', 'The Wellness Guide', 'The Educator'], competes: [], custom: false, has_default: true });
  });

  it('saves Evoni\'s own links (ADMIN only), refuses a type off the list, and resets', async () => {
    const mine = { name: 'The Beauty Oracle', shares: ['The Luxury Icon', 'Not a type', 'The Beauty Oracle'], competes: ['The Trendsetter'] };
    expect((await auth(request(app).put('/api/v1/cast/audience-map'), editor).send(mine)).status).toBe(403);
    expect((await auth(request(app).put('/api/v1/cast/audience-map')).send({ ...mine, name: 'The Night Owl' })).status).toBe(400);
    const saved = await auth(request(app).put('/api/v1/cast/audience-map')).send(mine);
    expect(saved.status).toBe(200);
    expect(saved.body.type).toMatchObject({ shares: ['The Luxury Icon'], competes: ['The Trendsetter'], custom: true });
    const { audienceScores } = require('../../src/services/audienceMap');
    expect((await audienceScores(db, p.bea, [p.lux, p.tess])).get(p.lux)).toBe(1);
    const reset = await auth(request(app).put('/api/v1/cast/audience-map')).send({ name: 'The Beauty Oracle', reset: true });
    expect(reset.body.type).toMatchObject({ shares: ['The Trendsetter', 'The Wellness Guide', 'The Educator'], custom: false });
  });

  it('suggests links and saves nothing', async () => {
    mockCreate.mockResolvedValue(say({ shares: ['The Entertainer', 'nope'], competes: ['The Educator'], why: 'Both read the room.' }));
    const res = await auth(request(app).post('/api/v1/cast/audience-map/suggest')).send({ name: 'The Commentator' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'The Commentator', shares: ['The Entertainer'], competes: ['The Educator'], why: 'Both read the room.' });
    const [[row]] = await run(`SELECT COUNT(*)::int AS n FROM page_content WHERE ${KEY_SQL} AND data ? 'The Commentator'`);
    expect(row.n).toBe(0);
  });

  it('scores a poster\'s overlap with others by niche, then content type, never Lala', async () => {
    const { audienceScores } = require('../../src/services/audienceMap');
    const scores = await audienceScores(db, p.bea, [p.tess, p.lux, p.rel, lala]);
    // Tess: same niche and linked types; Lux: same niche, no type link; Rel: nothing.
    expect(new Map(scores)).toEqual(new Map([[p.tess, 1], [p.lux, 0.6]]));
    // Lux and Rel compete by type but post about different things: half.
    expect((await audienceScores(db, p.lux, [p.rel])).get(p.rel)).toBe(0.35);
    expect((await audienceScores(db, lala, [p.tess, p.bea])).size).toBe(0);
  });

  it('drafting reactions: overlapping creators come before the general fill', async () => {
    const { pickReactors } = require('../../src/services/feedCommentDrafter');
    const reactors = await pickReactors(db, { social_profile_id: p.bea }, { limit: 2 });
    // Lux is the most relevant to Lala but shares nothing with Bea; the
    // first reactor is one whose audience overlaps hers (Tess, or another
    // profile of an overlapping type in a shared test database).
    const [first] = await run('SELECT society_archetype FROM social_profiles WHERE id = :id', { id: reactors[0].profile.id });
    expect(['The Trendsetter', 'The Wellness Guide', 'The Educator', 'The Beauty Oracle']).toContain(first[0].society_archetype);
    expect(reactors[0].profile.id).not.toBe(p.lux);
    expect(reactors.map((r) => r.profile.id)).not.toContain(p.bea);
  });
});
