/**
 * The character profile audit's fixes (Evoni, 2026-10-19: "yes to all with
 * your recommendations"):
 *
 *   1  one follower number: deciding a ledger change brings the profile's
 *      stored label and tier to the accepted count (pulseFollowers.decide /
 *      override → characterFacts.syncFollowerCopies)
 *   5  the profile's writes are ADMIN only ("this whole part of the site is
 *      admin only"): a signed-in non-admin is refused and nothing changes
 *   8  a confidential professional (Dr. Sinclair) is never matched to a
 *      profile, never among The Pulse's voices, never drafted posts
 *   9  an archived character's link: an ADMIN gets it flagged archived; a
 *      non-admin still gets 404
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

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

(shouldSkip ? describe.skip : describe)('the character profile audit fixes', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), reg: crypto.randomUUID(),
    maren: crypto.randomUUID(), sinclair: crypto.randomUUID(), gone: crypto.randomUUID(),
  };
  const profiles = {};
  let adminToken;
  let editorToken;
  const asAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`);
  const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);

  const addProfile = async (key) => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, created_at, updated_at)
       VALUES (:handle, 'instagram', 'test', 'lalaverse', '900K', NOW(), NOW()) RETURNING id`,
      { handle: `${key}${TAG}` });
    profiles[key] = row.id;
  };
  const addCharacter = (id, name, { feed = null, depth = 'active', extra = null, key = null } = {}) => run(
    `INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status,
       feed_profile_id, depth_level, extra_fields, created_at, updated_at)
     VALUES (:id, :reg, :key, :name, :name, 'support', 'accepted', :feed, :depth, CAST(:extra AS jsonb), NOW(), NOW())`,
    { id, reg: ids.reg, key: key || `audit-${crypto.randomUUID().slice(0, 8)}`, name: `${name} ${TAG}`, feed, depth,
      extra: extra ? JSON.stringify(extra) : null });

  beforeAll(async () => {
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-audit-fix', email: 'a@audit-fix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-user-audit-fix', email: 'u@audit-fix.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Audit ${TAG}`, slug: `audit-${TAG}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`,
      { ...ids, title: `Audit ${TAG}` });
    await addProfile('maren');
    await addProfile('spare');
    await addCharacter(ids.maren, 'Maren', { feed: profiles.maren });
    await addCharacter(ids.sinclair, 'Sinclair', { extra: { classification: 'confidential_professional' } });
    await addCharacter(ids.gone, 'Gone');
    await run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :gone', ids);
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('1: deciding a ledger change brings the stored label and tier to the accepted count', async () => {
    const followers = require('../../src/services/pulseFollowers');
    const start = await db.PulseFollower.create({
      show_id: ids.show, social_profile_id: profiles.maren, story_order: 0, change: 1200000, count_after: 1200000,
      cause: 'start', reason: 'Start', status: 'proposed',
    });
    await followers.decide(db, start, { by: 'test' });
    let profile = await db.SocialProfile.findByPk(profiles.maren);
    expect(profile.follower_count_approx).toBe('1.2M');

    await followers.override(db, { showId: ids.show, profileId: profiles.maren, change: 300000, reason: 'A viral week', at: 1, by: 'test' });
    profile = await db.SocialProfile.findByPk(profiles.maren);
    expect(profile.follower_count_approx).toBe('1.5M');
    expect(profile.follower_tier).toBe(require('../../src/services/pulseAudience').tierFor(1500000).key);

    // The facts the profile reads say the same number.
    const facts = await asAdmin(request(app).get(`/api/v1/cast/characters/${ids.maren}/facts`));
    expect(facts.status).toBe(200);
    expect(facts.body.facts.followers).toMatchObject({ count: 1500000, label: '1.5M', source: 'ledger' });
  });

  it('5: a signed-in non-admin is refused on the profile writes, and nothing changes', async () => {
    const writes = [
      request(app).put(`/api/v1/character-registry/characters/${ids.maren}`).send({ subtitle: 'Not allowed' }),
      request(app).post(`/api/v1/character-registry/characters/${ids.maren}/set-status`).send({ status: 'finalized' }),
      request(app).delete(`/api/v1/character-registry/characters/${ids.maren}`),
      request(app).post(`/api/v1/cast/characters/${ids.maren}/keep`).send({ kept: true }),
      request(app).post(`/api/v1/cast/characters/${ids.gone}/restore`),
      request(app).delete(`/api/v1/cast/characters/${ids.gone}/permanent`),
      request(app).put(`/api/v1/cast/characters/${ids.maren}/feed-profile`).send({ feed_profile_id: profiles.spare }),
      request(app).put(`/api/v1/social-profiles/${profiles.maren}`).send({ bio: 'Not allowed' }),
      request(app).post(`/api/v1/character-registry/characters/${ids.maren}/interior/generate`).send({ preview: true }),
      request(app).post(`/api/v1/character-registry/characters/${ids.maren}/writer-paragraph/generate`),
      request(app).post(`/api/v1/character-depth/${ids.maren}/generate`),
      request(app).post(`/api/v1/cast/characters/${ids.maren}/places/describe`).send({}),
    ];
    for (const w of writes) expect((await asEditor(w)).status).toBe(403);
    const [[row]] = await run('SELECT subtitle, status, cast_review, deleted_at FROM registry_characters WHERE id = :maren', ids);
    expect(row).toMatchObject({ subtitle: null, status: 'accepted', cast_review: null, deleted_at: null });
    const [[gone]] = await run('SELECT deleted_at FROM registry_characters WHERE id = :gone', ids);
    expect(gone.deleted_at).not.toBeNull();
    // Reading stays open to anyone signed in.
    expect((await asEditor(request(app).get(`/api/v1/character-registry/characters/${ids.maren}`))).status).toBe(200);
  });

  it('8: a confidential professional is never matched, never a voice, never drafted posts', async () => {
    const match = await asAdmin(request(app).put(`/api/v1/cast/characters/${ids.sinclair}/feed-profile`).send({ feed_profile_id: profiles.spare }));
    expect(match.status).toBe(403);
    expect(match.body.error).toMatch(/confidential/i);
    const [[s]] = await run('SELECT feed_profile_id FROM registry_characters WHERE id = :sinclair', ids);
    expect(s.feed_profile_id).toBeNull();

    // Even matched by hand, The Pulse leaves her out.
    await run('UPDATE registry_characters SET feed_profile_id = :p WHERE id = :sinclair', { ...ids, p: profiles.spare });
    try {
      const voices = await require('../../src/services/pulseVoices').eligible(db, ids.show, { includeUnmet: true });
      const names = voices.map((v) => v.character.id);
      expect(names).toContain(ids.maren);
      expect(names).not.toContain(ids.sinclair);
      await expect(require('../../src/services/characterPosts').generatePosts(db, { characterId: ids.sinclair, count: 1 }))
        .rejects.toMatchObject({ status: 403 });
    } finally {
      await run('UPDATE registry_characters SET feed_profile_id = NULL WHERE id = :sinclair', ids);
    }
  });

  it('9: an archived character\'s link: flagged for an ADMIN, still 404 for anyone else', async () => {
    const admin = await asAdmin(request(app).get(`/api/v1/character-registry/characters/${ids.gone}`));
    expect(admin.status).toBe(200);
    expect(admin.body).toMatchObject({ archived: true, character: { id: ids.gone } });
    const editor = await asEditor(request(app).get(`/api/v1/character-registry/characters/${ids.gone}`));
    expect(editor.status).toBe(404);
    const live = await asAdmin(request(app).get(`/api/v1/character-registry/characters/${ids.maren}`));
    expect(live.body.archived).toBeUndefined();
  });
});
