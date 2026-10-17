/**
 * Cross-character checks (the spec's #2; Evoni, 2026-10-17): GET
 * /api/v1/cast/cross-check?registry_id=. Maren hosts the Linen Gala
 * (Episode 3); Kai is its guest; Nia is not.
 * - Nia's post "I'm at the Linen Gala" puts her where she was not: at_event;
 *   Kai saying the same is fine (he was there);
 * - Nia's later post about the Gala, never told and never posted publicly:
 *   knows_event; Maren talking about her own Gala is fine;
 * - Maren's description gives Kai 1.2M followers (he has 50K) and says Nia
 *   went dark (she is rising): other_followers, other_status; a sentence
 *   naming two cast members is not judged; the mask is never checked;
 * - flag-only: nothing changes; registry ids are required.
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
const uuid = () => crypto.randomUUID();

(shouldSkip ? describe.skip : describe)('cross-character checks', () => {
  const tag = uuid().slice(0, 8);
  const GALA = `Linen Gala ${tag}`;
  const ids = { show: uuid(), reg: uuid(), ep3: uuid(), gala: uuid() };
  const c = { maren: uuid(), kai: uuid(), nia: uuid() };
  const p = {};
  const posts = {};
  let token;
  const check = (q = `registry_id=${ids.reg}`) => request(app).get(`/api/v1/cast/cross-check?${q}`).set('Authorization', `Bearer ${token}`);
  const post = async (key, profile, text, order, status = 'live') => {
    const [[row]] = await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, poster_display_name, poster_platform, post_type, content_text, status, story_order,
        likes, comments_count, shares, sample_comments, sort_order, ai_generated, is_viral, created_at, updated_at)
      VALUES (:id, :show, :pid, :h, :h, 'lalaverse', 'post', :text, :status, :order, 0, 0, 0, '[]'::jsonb, 0, false, false, NOW(), NOW()) RETURNING id`,
    { id: uuid(), show: ids.show, pid: p[profile], h: `${profile}${tag}`, text, status, order });
    posts[key] = row.id;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-cross', email: 'evoni@cross.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Cross ${tag}`, slug: `cross-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Cross', :show, NOW(), NOW())", ids);
    await run("INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep3, :show, 'Three', 3, 'published', NOW(), NOW())", ids);
    for (const key of ['maren', 'kai', 'nia']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lifestyle_claim, created_at, updated_at)
        VALUES (:h, 'pulse', 'test', :name, 'lalaverse', :claim, NOW(), NOW()) RETURNING id`,
      { h: `@${key}${tag}`, name: key, claim: key === 'maren' ? `Kai has 9 million followers, says Maren ${tag}` : null });
      p[key] = row.id;
    }
    const maren = `Maren runs a slow-fashion label. Her rival Kai has 1.2M followers. Nia went dark last spring. Kai and Nia have 3M followers between them.`;
    for (const [key, desc, facts] of [
      ['maren', maren, {}],
      ['kai', 'Kai designs shoes.', {}],
      ['nia', 'Nia paints.', {}],
    ]) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, description, canon_facts, created_at, updated_at)
        VALUES (:id, :reg, :key, :name, :pid, :desc, CAST(:facts AS jsonb), NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key[0].toUpperCase() + key.slice(1), pid: p[key], desc, facts: JSON.stringify(facts) });
    }
    await run("UPDATE social_profiles SET current_state = 'rising' WHERE id = :id", { id: p.nia });
    for (const [key, count] of [['maren', 2000000], ['kai', 50000], ['nia', 8000]]) {
      await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
        VALUES (:show, :pid, 0, :n, :n, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid: p[key], n: count });
    }
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:gala, :show, :name, 'used', :ep3, :host, 0, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, name: GALA, host: p.maren, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.kai }] } }) });
    await post('niaThere', 'nia', `I'm at the ${GALA} and the linen is everything`, 35, 'draft');
    await post('kaiThere', 'kai', `we were at the ${GALA} all night`, 35, 'draft');
    await post('niaHeard', 'nia', `the ${GALA} looked like a mess honestly`, 38, 'draft');
    await post('marenOwn', 'maren', `thank you for coming to the ${GALA}`, 37, 'draft');
    // All drafts: nothing live names the Gala, so it was never posted publicly.
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE id = :gala', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('finds who was where, who knew what, and what one character says about another', async () => {
    const res = await check();
    expect(res.status).toBe(200);
    const flags = res.body.flags;
    const by = (check, extra = {}) => flags.filter((f) => f.check === check && Object.entries(extra).every(([k, v]) => f[k] === v));

    const at = by('at_event');
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ character_id: c.nia, character_name: 'Nia', post_id: posts.niaThere, event_id: ids.gala, event_name: GALA, where: 'Draft post' });
    expect(at[0].expected).toBe(`Nia is not on the guest list of ${GALA}`);

    const knows = by('knows_event');
    expect(knows.map((f) => f.post_id)).toEqual([posts.niaHeard]);

    const followers = by('other_followers');
    expect(followers).toHaveLength(1);
    expect(followers[0]).toMatchObject({ character_id: c.maren, other_id: c.kai, other_name: 'Kai', found: '1.2M followers', expected: 'Kai has 50k followers', where: 'Profile: Description' });
    const status = by('other_status');
    expect(status).toHaveLength(1);
    expect(status[0]).toMatchObject({ character_id: c.maren, other_id: c.nia, found: 'went dark', expected: "Nia's account is rising" });

    // Kai was there; Maren hosted; the two-name sentence and the mask are not judged.
    expect(flags.some((f) => f.post_id === posts.kaiThere || f.post_id === posts.marenOwn)).toBe(false);
    expect(flags.some((f) => /3M|9 million/.test(f.found))).toBe(false);
    expect(flags.map((f) => f.check)).toEqual(['at_event', 'knows_event', 'other_followers', 'other_status']);
    expect(res.body.summary).toEqual({ characters: 3, posts_checked: 4, flags: 4, characters_flagged: 2 });

    const [[row]] = await run('SELECT description FROM registry_characters WHERE id = :id', { id: c.maren });
    expect(row.description).toContain('1.2M followers');
  });

  it('a fact not decided yet is not checked; registry ids are required', async () => {
    await run(`UPDATE registry_characters SET canon_facts = '{"undecided":["account_status"]}'::jsonb WHERE id = :id`, { id: c.nia });
    const res = await check();
    expect(res.body.flags.some((f) => f.check === 'other_status')).toBe(false);
    expect((await check('registry_id=')).status).toBe(400);
    expect((await check('registry_id=nope')).status).toBe(400);
    expect((await request(app).get(`/api/v1/cast/cross-check?registry_id=${ids.reg}`)).status).toBe(401);
  });
});
