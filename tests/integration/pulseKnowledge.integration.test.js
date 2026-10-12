/**
 * Who knows what (Task #2982; The Pulse spec §6), against the test database
 * with the Anthropic calls mocked:
 * - there: a guest, and Lala, from the event's During;
 * - told: a close tie of a guest (bestie, not mentor), from the event's After;
 * - public: a live post at or before the moment that names or tags it;
 * - the gate flags a draft naming an event its poster could not know, and it
 *   stays a draft; the drafter is told what the poster knows;
 * - a comment under a live post about the event is not flagged.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
const knowledge = require('../../src/services/pulseKnowledge');
const drafter = require('../../src/services/pulseDrafter');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('The Pulse: who knows what (Task #2982)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep1: uuid(), ep2: uuid(), gala: uuid(), roof: uuid() };
  const GALA = `Gala ${tag}`;
  const ROOF = `Rooftop ${tag}`;
  const c = {};
  const p = {};
  let lala;
  let madeLala = false;
  const knows = async (key, at) => Object.fromEntries(await knowledge.knowsAt(models, ids.show, p[key], at));

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Knows ${tag}`, slug: `knows-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'published', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Knows registry', :show, NOW(), NOW())`, ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    p.lala = lala;
    for (const key of ['marcus', 'kim', 'rio', 'zed']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: `${key}${tag}` });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' }, examples_json: [], status: 'built' });
    }
    // The gala (Ep 1): Marcus was a guest. The rooftop (Ep 2): no guests, so only Lala was there.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:gala, :show, :galaName, 'used', :ep1, 0, 5, CAST(:cc AS jsonb), NOW(), NOW()),
                      (:roof, :show, :roofName, 'used', :ep2, 0, 5, NULL, NOW(), NOW())`,
    { ...ids, galaName: GALA, roofName: ROOF, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.marcus }] } }) });
    // Kim is Marcus's bestie (close); Rio is his mentor (not close); Zed knows nobody.
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, created_at, updated_at)
               VALUES (:kim, :marcus, 'bestie', NOW(), NOW()), (:marcus, :rio, 'mentor', NOW(), NOW())`, { kim: p.kim, marcus: p.marcus, rio: p.rio });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:a) OR target_profile_id IN (:a)', { a: [p.marcus, p.kim, p.rio, p.zed] });
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [p.marcus, p.kim, p.rio, p.zed, ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('there: a guest and Lala know the event from its During, not before', async () => {
    expect(await knows('marcus', 14)).toEqual({});
    expect(await knows('marcus', 15)).toEqual({ [ids.gala]: 'there' });
    expect(await knows('lala', 15)).toEqual({ [ids.gala]: 'there' });
    expect(await knows('lala', 25)).toEqual({ [ids.gala]: 'there', [ids.roof]: 'there' });
  });

  test("told: a guest's close tie knows from the After; a mentor and a stranger do not", async () => {
    expect(await knows('kim', 15)).toEqual({});
    expect(await knows('kim', 17)).toEqual({ [ids.gala]: 'told' });
    expect(await knows('rio', 17)).toEqual({});
    expect(await knows('zed', 17)).toEqual({});
  });

  test('public: a live post naming it, or tagged with it, at or before the moment', async () => {
    await models.FeedPost.create({ show_id: ids.show, social_profile_id: p.marcus, poster_handle: `marcus${tag}`, poster_display_name: 'marcus',
      poster_platform: 'lalaverse', post_type: 'post', content_text: `still thinking about the ${GALA}`, status: 'live', story_order: 18,
      likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0 });
    await models.FeedPost.create({ show_id: ids.show, event_id: ids.roof, social_profile_id: lala, poster_handle: 'lala', poster_display_name: 'Lala',
      poster_platform: 'lalaverse', post_type: 'post', content_text: 'up here', status: 'live', story_order: 26,
      likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0 });
    // A draft never makes anything public.
    await models.FeedPost.create({ show_id: ids.show, social_profile_id: p.rio, poster_handle: `rio${tag}`, poster_display_name: 'rio',
      poster_platform: 'lalaverse', post_type: 'post', content_text: `the ${GALA} tea`, status: 'draft', story_order: 15,
      likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0 });
    expect(await knows('zed', 17)).toEqual({});
    expect(await knows('zed', 18)).toEqual({ [ids.gala]: 'public' });
    expect(await knows('zed', 26)).toEqual({ [ids.gala]: 'public', [ids.roof]: 'public' });
    // How they know keeps the closest way: Kim was told before it was posted.
    expect((await knows('kim', 18))[ids.gala]).toBe('told');
  });

  test('the gate flags a draft naming an event its poster could not know; it stays a draft', async () => {
    mockCreate.mockResolvedValueOnce(say({ text: `heard the ${GALA} was wild`, hashtag: null, reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.9, why: 'them' }));
    const rio = await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.rio, moment: 17, context: {} });
    expect(rio.published).toBe(false);
    expect(rio.gate.flags).toEqual([{ code: 'doesnt_know', detail: GALA }]);
    expect((await rio.post.reload()).status).toBe('draft');
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('They know of no events yet: name none.');

    mockCreate.mockResolvedValueOnce(say({ text: `the ${GALA} though`, hashtag: null, reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.9, why: 'them' }));
    const kim = await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.kim, moment: 17, context: {} });
    expect(kim.gate.flags).toEqual([]);
    expect(kim.published).toBe(true);
    expect(mockCreate.mock.calls[2][0].messages[0].content).toContain(`Events they know about by now: ${GALA} (a close friend told you). Name no other event.`);
  });

  test('a comment under a live post about the event is not flagged: the post made it public', async () => {
    const post = await models.FeedPost.findOne({ where: { show_id: ids.show, story_order: 18 } });
    mockCreate.mockResolvedValueOnce(say({ text: `wait the ${GALA}??` }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.9, why: 'them' }));
    const r = await drafter.draftCommentAndRoute(models, { postId: post.id, characterId: c.zed });
    expect(r.gate.flags).toEqual([]);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain(`${GALA} (it was posted)`);
  });
});
