/**
 * Fixing what the consistency check finds (Evoni, 2026-10-16: "I have no way
 * of correcting these findings"), on a Maren-like profile: facts 2M, the
 * stored copies and the description still 1.2M, a private account with its
 * own 88K, and a rebrand note about an old 4K account.
 * - the private account's count is not a copy of the fact, so not flagged;
 * - each finding carries a fix, and prose findings their field's text;
 * - POST /check/fix puts the fix in place, or saves Evoni's own text, in
 *   that one field only; ADMIN only;
 * - setting followers on the fact sheet updates the stored copies too.
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
const REASON = 'Quiet deletion. 4K followers abandoned without announcement.';

(shouldSkip ? describe.skip : describe)('fixing what the check finds', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const check = () => as(editor, request(app).get(`/api/v1/cast/characters/${ids.char}/check`));
  const fix = (body, token = admin) => as(token, request(app).post(`/api/v1/cast/characters/${ids.char}/check/fix`)).send(body);
  const flagAt = (flags, field) => flags.find((f) => f.field === field);
  const profile = async () => (await run('SELECT follower_count_approx, follower_tier, full_profile, platform_presences FROM social_profiles WHERE id = :pid', { pid }))[0][0];

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-fix', email: 'evoni@fix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-fix', email: 'e@fix.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Fix ${TAG}`, slug: `fix-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Fix ${TAG}` });
    const [[p]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, current_state, display_name, full_profile, platform_presences, created_at, updated_at)
       VALUES (:h, 'pulse', 'Slow fashion.', 'lalaverse', '2M', 'gone_dark', :name, :full, :pres, NOW(), NOW()) RETURNING id`,
      {
        h: `@fix${TAG}`,
        name: `Fix ${TAG}`,
        full: JSON.stringify({ follower_count_approx: '1.2M', follower_tier: 'mega', rebrand_history: [{ year: 2022, reason: REASON }] }),
        pres: JSON.stringify({ pulse: { followers: '1.2M' }, pulse_private: { followers: '88K subscribers' } }),
      });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, description, created_at, updated_at)
      VALUES (:char, :reg, :key, :name, 'support', 'accepted', :pid, 'A creator with 1.2M followers who went dark.', NOW(), NOW())`,
    { ...ids, key: `fix-${TAG}`, name: `Fix ${TAG}`, pid });
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

  it('each finding carries its fix; the private account is not a copy of the fact', async () => {
    const { flags } = (await check()).body;
    expect(flags.map((f) => f.field).sort()).toEqual([
      'character.description',
      'feed.full_profile.follower_count_approx',
      'feed.full_profile.rebrand_history.0.reason',
      'feed.platform_presences.pulse.followers',
    ]);
    expect(flagAt(flags, 'character.description')).toMatchObject({ fix: '2M followers', editable: true, text: 'A creator with 1.2M followers who went dark.' });
    expect(flagAt(flags, 'feed.full_profile.rebrand_history.0.reason')).toMatchObject({ found: '4K followers', fix: '2M followers', editable: true, text: REASON });
    expect(flagAt(flags, 'feed.platform_presences.pulse.followers')).toMatchObject({ fix: '2M', editable: false });
  });

  it('is ADMIN only, needs a flag id, and refuses one that is not there', async () => {
    const flag = flagAt((await check()).body.flags, 'character.description');
    expect((await fix({ flag_id: flag.id }, editor)).status).toBe(403);
    expect((await fix({ flag_id: 'nope' })).status).toBe(400);
    const gone = await fix({ flag_id: 'abcdefabcdef' });
    expect(gone.status).toBe(404);
    expect(gone.body.error).toMatch(/Check again/);
  });

  it('the fix swaps only the number in the description, and the finding goes', async () => {
    const flag = flagAt((await check()).body.flags, 'character.description');
    const res = await fix({ flag_id: flag.id });
    expect(res.status).toBe(200);
    expect(flagAt(res.body.flags, 'character.description')).toBeUndefined();
    const [[c]] = await run('SELECT description FROM registry_characters WHERE id = :char', ids);
    expect(c.description).toBe('A creator with 2M followers who went dark.');
  });

  it('the fix on a stored copy writes that one key and keeps the rest of the profile', async () => {
    const flag = flagAt((await check()).body.flags, 'feed.full_profile.follower_count_approx');
    expect((await fix({ flag_id: flag.id })).status).toBe(200);
    const row = await profile();
    expect(row.full_profile).toEqual({ follower_count_approx: '2M', follower_tier: 'mega', rebrand_history: [{ year: 2022, reason: REASON }] });
    expect(row.platform_presences.pulse.followers).toBe('1.2M');
  });

  it("Evoni's own text replaces the field's text; a stored copy has no text to edit", async () => {
    const { flags } = (await check()).body;
    const copy = flagAt(flags, 'feed.platform_presences.pulse.followers');
    expect((await fix({ flag_id: copy.id, text: '2M' })).status).toBe(400);
    const note = flagAt(flags, 'feed.full_profile.rebrand_history.0.reason');
    expect((await fix({ flag_id: note.id, text: '   ' })).status).toBe(400);
    const mine = 'Quiet deletion of her first account. No explanation.';
    expect((await fix({ flag_id: note.id, text: mine })).status).toBe(200);
    expect((await profile()).full_profile.rebrand_history).toEqual([{ year: 2022, reason: mine }]);
  });

  it("setting followers on the fact sheet updates the count's stored copies, not the private account", async () => {
    const res = await as(admin, request(app).put(`/api/v1/cast/characters/${ids.char}/facts`)).send({ followers: { count: 3000000, reason: 'test' } });
    expect(res.status).toBe(200);
    const row = await profile();
    expect(row).toMatchObject({ follower_count_approx: '3M', follower_tier: 'mega' });
    expect(row.full_profile.follower_count_approx).toBe('3M');
    expect(row.platform_presences).toEqual({ pulse: { followers: '3M' }, pulse_private: { followers: '88K subscribers' } });
    const { flags } = (await check()).body;
    expect(flags.filter((f) => f.field !== 'character.description')).toEqual([]);
  });
});
