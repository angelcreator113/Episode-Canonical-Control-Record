/**
 * Known of (Evoni, 2026-10-16: "Maren is a public figure with 2M followers,
 * and Lala should be able to see her public posts before they meet. Public
 * posts can appear in Lala's feed before the meeting, while DMs, replies to
 * Lala and relationship moves still wait until they've met").
 * Maren meets Lala at story order 20 (a set character reveal).
 * - Before then she is unmet and hidden; known of, she is unmet but not
 *   hidden: she posts in public (ambient eligible) and shows on Voices;
 * - event reactions and storylines (met only), DMs with Lala, replies to
 *   Lala's posts and closeness moves with Lala still wait for the meeting;
 * - the toggle is ADMIN only.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');
const reveals = require('../../src/services/pulseReveals');
const { eligible } = require('../../src/services/pulseVoices');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const BEFORE = 5;
const AFTER = 30;

(shouldSkip ? describe.skip : describe)('Known of: a public figure before the meeting', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), nia: uuid() };
  const p = {};
  let lala;
  let madeLala = false;
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const knownOf = (on, token = admin) => as(token, request(app).put(`/api/v1/pulse-voices/${ids.maren}/known-of`)).send({ known_of: on });
  const names = (rows) => rows.map((r) => r.character.display_name);
  const post = (profileId, handle, order, text = 'just a day') => models.FeedPost.create({
    show_id: ids.show, social_profile_id: profileId, poster_handle: handle, poster_display_name: handle, poster_platform: 'lalaverse',
    post_type: 'post', content_text: text, status: 'live', story_order: order, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
  });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-known', email: 'evoni@known.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-known', email: 'ed@known.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Known ${tag}`, slug: `known-${tag}` });
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Known registry', :show, NOW(), NOW())", ids);
    for (const key of ['maren', 'nia']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      // A generated profile, so the reaction picker may choose it.
      await run("UPDATE social_profiles SET status = 'finalized' WHERE id = :id", { id: row.id });
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: ids[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
    }
    // Maren meets Lala at story order 20; Nia has always known her.
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'character', item_id: String(p.maren), moment: 'story_time', story_order: 20, mode: 'hidden', source: 'set' });
    // A close tie between Maren and Lala, so ignoring and mentions could move it.
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, created_at, updated_at)
               VALUES (:a, :b, 'collab', NOW(), NOW())`, { a: p.maren, b: lala });
  });

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id = :a OR target_profile_id = :a', { a: p.maren });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [p.maren, p.nia, ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  test('not known of: before the meeting she is unmet and hidden, after it neither', async () => {
    const before = await reveals.revealsAt(models, ids.show, BEFORE, { lalaProfileId: lala });
    expect(before.unmetProfiles.has(p.maren)).toBe(true);
    expect(before.hiddenProfiles.has(p.maren)).toBe(true);
    const after = await reveals.revealsAt(models, ids.show, AFTER, { lalaProfileId: lala });
    expect(after.unmetProfiles.has(p.maren)).toBe(false);
    expect(after.hiddenProfiles.has(p.maren)).toBe(false);
    // Evoni, 2026-10-18: "it shouldnt matter if lala has met them they should
    // still be building themselves on the pulse": she posts before the meeting.
    expect(names(await eligible(models, ids.show, { at: BEFORE }))).toEqual(['maren', 'nia']);
  });

  test('the toggle is admin only and must be true or false', async () => {
    expect((await knownOf(true, editor)).status).toBe(403);
    expect((await as(admin, request(app).put(`/api/v1/pulse-voices/${ids.maren}/known-of`)).send({ known_of: 'yes' })).status).toBe(400);
    expect((await as(admin, request(app).put(`/api/v1/pulse-voices/${uuid()}/known-of`)).send({ known_of: true })).status).toBe(404);
  });

  test('known of: still unmet before the meeting, but not hidden, so she posts in public and shows on Voices', async () => {
    expect((await knownOf(true)).status).toBe(200);
    const before = await reveals.revealsAt(models, ids.show, BEFORE, { lalaProfileId: lala });
    expect(before.unmetProfiles.has(p.maren)).toBe(true);
    expect(before.hiddenProfiles.has(p.maren)).toBe(false);
    expect(before.knownOfProfiles.has(p.maren)).toBe(true);
    // Ambient posting (public) takes her; event reactions and storylines (with Lala) do not.
    expect(names(await eligible(models, ids.show, { at: BEFORE }))).toEqual(['maren', 'nia']);
    expect(names(await eligible(models, ids.show, { at: BEFORE, stage: 'alive', met: true }))).toEqual(['nia']);
    expect(names(await eligible(models, ids.show, { at: AFTER, stage: 'alive', met: true }))).toEqual(['maren', 'nia']);
  });

  test('DMs with Lala wait for the meeting; a DM between two others does not', async () => {
    const dms = require('../../src/services/pulseDms');
    await expect(dms.startConversation(models, { showId: ids.show, a: lala, b: p.maren, at: BEFORE, senderProfileId: p.maren }))
      .rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Lala has not met @maren.* yet/) });
    expect(await models.PulseDmThread.count({ where: { show_id: ids.show } })).toBe(0);
    expect(await reveals.hasMetLala(models, ids.show, p.maren, BEFORE)).toBe(false);
    expect(await reveals.hasMetLala(models, ids.show, p.maren, AFTER)).toBe(true);
    expect(await reveals.hasMetLala(models, ids.show, lala, BEFORE)).toBe(true);
  });

  test("replies to Lala's posts wait for the meeting; replies to others' posts do not", async () => {
    const { pickReactors } = require('../../src/services/feedCommentDrafter');
    const lalaPost = await post(lala, 'lala', BEFORE);
    const reactorIds = (await pickReactors(models, lalaPost, { limit: 50 })).map((r) => Number(r.profile.id));
    expect(reactorIds).not.toContain(p.maren);
    expect(reactorIds).toContain(p.nia);
    const laterPost = await post(lala, 'lala', AFTER);
    expect((await pickReactors(models, laterPost, { limit: 50 })).map((r) => Number(r.profile.id))).toContain(p.maren);
    const niaPost = await post(p.nia, `nia${tag}`, BEFORE);
    expect((await pickReactors(models, niaPost, { limit: 50 })).map((r) => Number(r.profile.id))).toContain(p.maren);
  });

  test('a relationship move with Lala waits for the meeting', async () => {
    const closeness = require('../../src/services/pulseCloseness');
    const early = await post(p.maren, `maren${tag}`, BEFORE, 'thinking about @lala today');
    expect(await closeness.proposeFromPost(models, early.id)).toEqual([]);
    const late = await post(p.maren, `maren${tag}`, AFTER, 'thinking about @lala today');
    const made = await closeness.proposeFromPost(models, late.id);
    expect(made.map((r) => r.cause)).toContain('mention');
  });
});
