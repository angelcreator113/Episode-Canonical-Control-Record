/**
 * A character whose registry belongs to no show (Evoni, 2026-10-17: Maren's
 * page drafts posts, but Voices never listed her). Her feed profile has a
 * follower count in the show, so she belongs to it (characterFacts.showIdFor):
 * - Voices lists her (Active) and her Breathing friend (not posting yet);
 * - her voice builds, one manual request in that show;
 * - the Draft posts ideas say the next step: Make Active, or Build their
 *   voice, and nothing once the voice is built.
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

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('a character whose registry has no show', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), friend: uuid() };
  const p = {};
  let admin;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const ideas = (id) => as(request(app).get(`/api/v1/cast/characters/${id}/posts/ideas`));

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-showless', email: 'evoni@showless.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Showless ${tag}`, slug: `showless-${tag}` });
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'No show', NOW(), NOW())", ids);
    for (const [key, depth] of [['maren', 'active'], ['friend', 'breathing']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:h, 'pulse', 'Slow fashion.', :name, 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `${key}${tag}`, name: key });
      p[key] = row.id;
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, the_mask, created_at, updated_at)
        VALUES (:id, :reg, :key, :name, CAST(:depth AS enum_registry_characters_depth_level), :pid, CAST('{"face":"effortless"}' AS jsonb), NOW(), NOW())`,
      { id: ids[key], reg: ids.reg, key: `${key}-${tag}`, name: key, depth, pid: row.id });
      await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
        VALUES (:show, :pid, 0, 2000000, 2000000, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid: row.id });
    }
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:maren, :friend)', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('Voices lists her through her follower count, and her friend as not posting yet', async () => {
    const res = await as(request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect([...res.body.characters, ...res.body.not_met].map((r) => r.display_name)).toEqual(['maren']);
    expect(res.body.not_posting.map((r) => r.display_name)).toEqual(['friend']);
  });

  it('the ideas name the next step: Make Active for the friend, Build their voice for her', async () => {
    expect((await ideas(ids.friend)).body).toMatchObject({ ready: false, next: 'make_active', blocker: expect.stringMatching(/Make them Active, then build it/) });
    expect((await ideas(ids.maren)).body).toMatchObject({ ready: false, next: 'build_voice', blocker: expect.stringMatching(/Build it here/) });
  });

  it('her voice builds, one manual request in the show; then she is ready', async () => {
    mockCreate.mockResolvedValueOnce(reply({ case: 'lowercase', punctuation: 'few', emoji: { use: 'never', favorites: [] }, sentence_length: 'short', topics: ['linen'], never_says: [], signature_phrases: [] }));
    const built = await as(request(app).post(`/api/v1/pulse-voices/${ids.maren}/build`));
    expect(built.status).toBe(200);
    const [[{ n }]] = await run("SELECT COUNT(*)::int AS n FROM pulse_requests WHERE show_id = :show AND kind = 'voice'", ids);
    expect(n).toBe(1);
    expect((await ideas(ids.maren)).body).toMatchObject({ ready: true, next: null, blocker: null });
  });
});
