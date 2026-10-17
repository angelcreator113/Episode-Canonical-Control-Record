/**
 * Posts feed the script (Character Consistency Engine step 7). Episode 1's
 * event (not completed) has Maren as host and Nia as a guest.
 * - the script reads: a draft tied to the episode, a live post tied to the
 *   event, and Maren's load-bearing page post (no episode yet), in story order;
 * - not: an ambient page post, someone else's load-bearing post, a rejected
 *   (deleted) or empty one, Lala's own, one later than the episode;
 * - Maren and Nia meet Lala at this event, so they are not hidden from it;
 * - the block marks load-bearing posts and what is not public yet, and both
 *   writers get it through loadScriptContext + storyContextBlocks.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { scriptPulsePosts, pulseScriptBlock } = require('../../src/services/scriptPulsePosts');
const { loadScriptContext, storyContextBlocks } = require('../../src/services/episodeScriptWriterService');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the Pulse posts the script reads', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep: uuid(), ev: uuid() };
  const p = {};
  let lala;
  let madeLala = false;
  const post = (profile, handle, text, extra = {}) => models.FeedPost.create({
    show_id: ids.show, social_profile_id: profile, poster_handle: handle, poster_display_name: handle, poster_platform: 'lalaverse',
    post_type: 'post', content_text: text, status: 'draft', likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Script pulse ${tag}`, slug: `scriptpulse-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'The Swap', 1, 'draft', NOW(), NOW())`, ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    for (const key of ['maren', 'nia', 'other']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:h, 'pulse', 'test', :key, 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `${key}${tag}`, key });
      p[key] = row.id;
    }
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, 'Linen Swap', 'draft', :ep, :host, 0, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, host: p.maren, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.nia }] } }) });

    await post(p.nia, `nia${tag}`, 'Counting down to the swap.', { episode_id: ids.ep, story_order: 15 });
    await post(p.nia, `nia${tag}`, 'Bringing my best linen.', { event_id: ids.ev, status: 'live', story_order: 12 });
    await post(p.maren, `maren${tag}`, 'Breaking my silence for this one.', { post_weight: 'load_bearing', post_weight_why: 'She ends her silence for the swap', story_order: 7 });
    await post(p.maren, `maren${tag}`, 'Morning light.', { post_weight: 'ambient', story_order: 5 });
    // Story order 27 (After Ep 2) is later than this episode's After (17).
    await post(p.other, `other${tag}`, 'Not invited, not bothered.', { post_weight: 'load_bearing', story_order: 6 });
    const gone = await post(p.nia, `nia${tag}`, 'Rejected draft.', { episode_id: ids.ep, story_order: 7 });
    await gone.destroy();
    await post(p.nia, `nia${tag}`, '   ', { episode_id: ids.ep, story_order: 8 });
    await post(lala, 'lala', 'Lala from the script.', { episode_id: ids.ep, story_order: 9 });
    await post(p.nia, `nia${tag}`, 'After Episode 2.', { event_id: ids.ev, status: 'live', story_order: 27 });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [...Object.values(p), ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('reads the episode\'s, its event\'s, and the host\'s load-bearing page post, in story order', async () => {
    const posts = await scriptPulsePosts(models, ids.ep, ids.show);
    expect(posts.map((x) => x.text)).toEqual(['Breaking my silence for this one.', 'Bringing my best linen.', 'Counting down to the swap.']);
    expect(posts[0]).toMatchObject({ handle: `maren${tag}`, weight: 'load_bearing', why: 'She ends her silence for the swap', released: false });
    expect(posts[1].released).toBe(true);
  });

  it('the block marks load-bearing posts and what is not public yet; both writers get it', async () => {
    const block = pulseScriptBlock(await scriptPulsePosts(models, ids.ep, ids.show));
    expect(block).toContain('═══ THE PULSE AROUND THIS EPISODE ═══');
    expect(block).toContain(`- @maren${tag} (LOAD-BEARING: She ends her silence for the swap; not public yet): "Breaking my silence for this one."`);
    expect(block).toContain(`- @nia${tag}: "Bringing my best linen."`);
    expect(block).toContain('The story reacts to every LOAD-BEARING post');
    expect(pulseScriptBlock([])).toBe('');

    const context = await loadScriptContext(ids.ep, ids.show, models, { lite: true });
    expect(context.pulsePosts).toHaveLength(3);
    expect(storyContextBlocks(context, { withSeason: false })).toContain('═══ THE PULSE AROUND THIS EPISODE ═══');
  });
});
