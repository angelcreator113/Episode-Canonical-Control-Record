/**
 * The consistency check routes (Character Consistency Engine step 3):
 * GET /api/v1/cast/characters/:id/check and marking a flag intentional.
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

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

(shouldSkip ? describe.skip : describe)('the consistency check', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-check', email: 'evoni@check.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-check', email: 'e@check.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Check ${TAG}`, slug: `check-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Check ${TAG}` });
    const [[p]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, current_state, content_persona, display_name, created_at, updated_at)
       VALUES (:h, 'pulse', 'Slow fashion, two million followers strong.', 'lalaverse', '2M', 'gone_dark', 'Acts like 9M followers.', :name, NOW(), NOW()) RETURNING id`,
      { h: `@check${TAG}`, name: `Check ${TAG}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, description, created_at, updated_at)
      VALUES (:char, :reg, :key, :name, 'support', 'accepted', :pid, 'A creator with 1.2M followers.', NOW(), NOW())`,
    { ...ids, key: `check-${TAG}`, name: `Check ${TAG}`, pid });
    await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
      VALUES (:show, :pid, 0, 2000000, 2000000, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const check = () => request(app).get(`/api/v1/cast/characters/${ids.char}/check`).set('Authorization', `Bearer ${editor}`);

  it('flags the description, not the vibe that agrees or the persona that is the mask', async () => {
    const res = await check();
    expect(res.status).toBe(200);
    expect(res.body.flags).toHaveLength(1);
    expect(res.body.flags[0]).toMatchObject({ check: 'followers', field: 'character.description', found: '1.2M followers', expected: '2M followers' });
    expect(res.body.skipped.mask).toBeGreaterThan(0);
  });

  it('marking it intentional is ADMIN only, keeps it listed as intentional, and can be undone', async () => {
    const flag = (await check()).body.flags[0];
    const url = `/api/v1/cast/characters/${ids.char}/check/intentional`;
    expect((await request(app).post(url).set('Authorization', `Bearer ${editor}`).send({ flag_id: flag.id })).status).toBe(403);
    expect((await request(app).post(url).set('Authorization', `Bearer ${admin}`).send({ flag_id: 'nope' })).status).toBe(400);
    expect((await request(app).post(url).set('Authorization', `Bearer ${admin}`).send({ flag_id: flag.id, note: 'Old bio, on purpose' })).status).toBe(200);
    let res = await check();
    expect(res.body.flags).toEqual([]);
    expect(res.body.intentional).toEqual([expect.objectContaining({ id: flag.id, note: 'Old bio, on purpose' })]);
    expect((await request(app).delete(`${url}/${flag.id}`).set('Authorization', `Bearer ${admin}`)).status).toBe(200);
    res = await check();
    expect(res.body.flags.map((f) => f.id)).toEqual([flag.id]);
  });

  it('the check changes nothing', async () => {
    const [[c]] = await run('SELECT description FROM registry_characters WHERE id = :char', ids);
    expect(c.description).toBe('A creator with 1.2M followers.');
  });
});
