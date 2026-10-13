/**
 * Active vs Alive (Task #3030; Evoni, 2026-10-12: "A character gets a Voice
 * Profile and can post once Active. Alive means they also participate in
 * ongoing conversations, relationships, and event reactions."), against the
 * test database, no AI:
 * - eligible() at 'active' lists Active and Alive characters; at 'alive',
 *   Alive ones only;
 * - an Active character can be a storyline poster; one below Active cannot;
 *   suggestions need an Alive character;
 * - DMs: an Active sender is refused, an Alive one is queued, Lala is exempt;
 * - closeness moves only between Alive characters (and Lala).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const voices = require('../../src/services/pulseVoices');
const dms = require('../../src/services/pulseDms');
const closeness = require('../../src/services/pulseCloseness');
const storylines = require('../../src/services/pulseStorylines');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse Active vs Alive (Task #3030)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const STAGES = { ana: 'active', al: 'alive', spark: 'sparked' };
  const c = {};
  const p = {};
  let lala;
  let madeLala = false;
  const post = (key, order) => models.FeedPost.create({
    show_id: ids.show, social_profile_id: p[key], poster_handle: `${key}${tag}`, poster_display_name: key, poster_platform: 'lalaverse',
    post_type: 'post', content_text: 'just a day', status: 'live', story_order: order, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
  });
  const comment = (postRow, key, profileId = p[key]) => models.FeedComment.create({
    feed_post_id: postRow.id, show_id: ids.show, social_profile_id: profileId, handle: `${key}${tag}`, display_name: key, text: 'obsessed', status: 'live', sort_order: 0,
  });
  const refusal = (promise) => promise.then(() => null, (err) => ({ status: err.status, message: err.message }));

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Stages ${tag}`, slug: `stages-${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Stages registry', :show, NOW(), NOW())`, ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    for (const [key, depth] of Object.entries(STAGES)) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, CAST(:depth AS enum_registry_characters_depth_level), :feed, NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, depth, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { temperament: 'regular' }, examples_json: [], status: 'built' });
    }
  });

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_dm_threads WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_storyline_beats WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_storylines WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [...Object.values(p), ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('eligible: Active and Alive post; only Alive at the alive stage; aliveProfiles picks the Alive ones', async () => {
    const names = (rows) => rows.map((r) => r.character.display_name).sort();
    expect(names(await voices.eligible(models, ids.show))).toEqual(['al', 'ana']);
    expect(names(await voices.eligible(models, ids.show, { stage: 'alive' }))).toEqual(['al']);
    expect(await voices.aliveProfiles(models, [p.ana, p.al, p.spark, lala])).toEqual(new Set([Number(p.al)]));
    expect(await voices.aliveProfiles(models, [])).toEqual(new Set());
  });

  test('storylines: an Active character can post a beat; below Active cannot; suggestions need an Alive character', async () => {
    const story = await models.PulseStoryline.create({ show_id: ids.show, title: 'The rumour', status: 'planned' });
    const beat = await storylines.addBeat(models, story, { kind: 'plant', story_order: 1, poster_profile_id: p.ana, brief: 'hint at it' });
    expect(beat.status).toBe('planned');
    expect(await refusal(storylines.addBeat(models, story, { kind: 'plant', story_order: 1, poster_profile_id: p.spark, brief: 'hint' })))
      .toEqual({ status: 400, message: 'spark is not Active yet, so cannot post.' });

    await run(`UPDATE registry_characters SET depth_level = 'active' WHERE id = :id`, { id: c.al });
    try {
      expect(await refusal(storylines.suggestBeats(models, story.id)))
        .toEqual({ status: 400, message: 'No Alive character has a Voice Profile yet. Build one in Voices.' });
    } finally {
      await run(`UPDATE registry_characters SET depth_level = 'alive' WHERE id = :id`, { id: c.al });
    }
  });

  test('DMs: an Active sender is refused; an Alive one is queued; Lala is exempt', async () => {
    const withAna = await dms.openThread(models, { showId: ids.show, a: p.al, b: p.ana });
    expect(await refusal(dms.enqueueMessage(models, { threadId: withAna.id, senderProfileId: p.ana })))
      .toEqual({ status: 409, message: `@ana${tag} is not Alive yet: only Alive characters take part in conversations.` });
    const job = await dms.enqueueMessage(models, { threadId: withAna.id, senderProfileId: p.al });
    expect(job).toMatchObject({ kind: 'dm', status: 'queued' });
    expect(job.payload_json.sender_profile_id).toBe(Number(p.al));

    const withLala = await dms.openThread(models, { showId: ids.show, a: lala, b: p.ana });
    expect((await dms.enqueueMessage(models, { threadId: withLala.id, senderProfileId: Number(lala) })).payload_json.sender_profile_id).toBe(Number(lala));
    expect(await models.PulseJob.count({ where: { show_id: ids.show, kind: 'dm' } })).toBe(2);
  });

  test('closeness moves only between Alive characters and Lala', async () => {
    const byAl = await post('al', 11);
    await comment(byAl, 'ana');
    expect(await closeness.proposeFromPost(models, byAl.id)).toEqual([]);

    await comment(byAl, 'lala', lala);
    const made = await closeness.proposeFromPost(models, byAl.id);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ cause: 'comment' });
    expect([Number(made[0].profile_a_id), Number(made[0].profile_b_id)].sort()).toEqual([Number(p.al), Number(lala)].sort());

    const byAna = await post('ana', 12);
    await comment(byAna, 'lala', lala);
    expect(await closeness.proposeFromPost(models, byAna.id)).toEqual([]);
  });
});
