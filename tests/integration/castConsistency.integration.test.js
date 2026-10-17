/**
 * The cast rollout: GET /api/v1/cast/consistency. One registry in a show:
 * - Maren: on the feed, 2M in the ledger, a description that says 1.2M, her
 *   income not decided, no occupation or possessions, Active, no voice;
 * - Nia: every fact set, no findings, an approved voice: ready;
 * - Ghost: no feed person.
 * Each row's facts, findings, voice and todo (the next step first), the
 * neediest first; the summary; a bad id refused.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the cast rollout', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), nia: uuid(), ghost: uuid() };
  const p = {};
  let token;
  const get = (q) => request(app).get(`/api/v1/cast/consistency?registry_id=${q}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-editor-rollout', email: 'e@rollout.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Rollout ${tag}`, slug: `rollout-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Rollout', :show, NOW(), NOW())", ids);
    for (const key of ['maren', 'nia']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, current_state, created_at, updated_at)
        VALUES (:h, 'pulse', 'test', :key, 'lalaverse', 'peaking', NOW(), NOW()) RETURNING id`, { h: `@${key}${tag}`, key });
      p[key] = row.id;
      await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
        VALUES (:show, :pid, 0, 2000000, 2000000, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid: row.id });
    }
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, description, canon_facts, created_at, updated_at)
      VALUES (:maren, :reg, :key, 'Maren', 'active', :pid, 'A creator with 1.2M followers.', CAST(:facts AS jsonb), NOW(), NOW())`,
    { ...ids, key: `maren-${tag}`, pid: p.maren, facts: JSON.stringify({ undecided: ['income'] }) });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, canon_facts, created_at, updated_at)
      VALUES (:nia, :reg, :key, 'Nia', 'alive', :pid, CAST(:facts AS jsonb), NOW(), NOW())`,
    { ...ids, key: `nia-${tag}`, pid: p.nia, facts: JSON.stringify({ occupation: 'Stylist', income: { amount: 90000, cadence: 'per_year' }, major_possessions: ['A vintage Vespa'] }) });
    await models.PulseVoice.create({ registry_character_id: ids.nia, social_profile_id: p.nia, habits_json: {}, examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
      VALUES (:ghost, :reg, :key, 'Ghost', NOW(), NOW())`, { ...ids, key: `ghost-${tag}` });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :nia', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('each character with their facts, findings, voice and what is left; the neediest first', async () => {
    const res = await get(ids.reg);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ characters: 3, ready: 1, with_findings: 1, without_voice: 2 });
    const [maren, ghost, nia] = res.body.characters;
    expect(maren).toMatchObject({
      name: 'Maren', handle: `@maren${tag}`, findings: 1, voice: 'none', has_show: true, ready: false,
      facts: { handle: 'set', followers: 'set', account_status: 'set', income: 'undecided', occupation: 'missing', major_possessions: 'missing' },
      todo: ['Fix 1 finding', 'Set their facts: occupation, what they own', 'Build their voice'],
    });
    expect(ghost).toMatchObject({ name: 'Ghost', todo: ['Match them to a feed person'], findings: 0 });
    expect(nia).toMatchObject({ name: 'Nia', ready: true, todo: [], voice: 'approved', findings: 0 });
  });

  it('refuses a bad registry id', async () => {
    expect((await get('nope')).status).toBe(400);
    expect((await get('')).status).toBe(400);
  });
});
