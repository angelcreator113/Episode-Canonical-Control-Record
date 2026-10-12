/**
 * Drafting in voice and the quality gate (Task #2969; The Pulse spec §7),
 * with the Anthropic calls mocked (the draft, then the voice score):
 * - a passing everyday post by another character publishes, numbers proposed;
 * - Lala's posts, posts about Lala, story-revealing posts and anything the
 *   gate flags stay drafts for Review, with the gate result on the post;
 * - the gate flags Living State quoted, banned phrases, a low voice score,
 *   a character Lala has not met yet, and an event from a later episode;
 * - Living State goes to the drafter only as private context;
 * - no Voice Profile, no draft.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
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
const SECRET = 'secretly terrified the brand deal will collapse';

(shouldSkip ? describe.skip : describe)('The Pulse drafting and quality gate (Task #2969)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep1: uuid(), ep3: uuid() };
  const c = {};
  const p = {};
  let lala;
  let madeLala = false;

  /** Mocks one draft and its voice score, then drafts and routes for a character at story order 17. */
  const draft = async (key, { text, hashtag = null, revealsStory = false, score = 0.9 }) => {
    mockCreate.mockResolvedValueOnce(say({ text, hashtag, reveals_story: revealsStory }));
    mockCreate.mockResolvedValueOnce(say({ score, why: 'sounds like them' }));
    return drafter.draftAndRoute(models, { showId: ids.show, characterId: c[key], moment: 17, context: { about: 'the gala' } });
  };
  const codes = (r) => r.gate.flags.map((f) => f.code);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Drafts ${tag}`, slug: `drafts-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'used', :ep3, NOW(), NOW())`, { id: uuid(), show: ids.show, ep3: ids.ep3, name: `Starlight Ball ${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Drafts registry', :show, NOW(), NOW())`, ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    for (const key of ['marcus', 'nia', 'novoice', 'lala']) {
      if (key === 'lala') p.lala = lala;
      else {
        const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
          VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: `${key}${tag}` });
        p[key] = row.id;
      }
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, living_state, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, CAST(:state AS jsonb), NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key], state: JSON.stringify({ worry: SECRET }) });
      if (key !== 'novoice') {
        await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' },
          examples_json: [{ id: uuid(), text: 'ok but who approved beige', kind: 'pinned' }], status: 'built' });
      }
    }
    // Lala has not met nia until long after story order 17.
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'character', item_id: String(p.nia), moment: 'story_time', story_order: 999, mode: 'hidden', source: 'set' });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [p.marcus, p.nia, p.novoice, ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('an everyday post by another character that passes publishes, stamped with its story order; numbers are proposed', async () => {
    const r = await draft('marcus', { text: 'ok but who approved the beige at the gala', hashtag: '#GalaNight' });
    expect(r.published).toBe(true);
    expect(r.review).toEqual([]);
    await r.post.reload();
    expect(r.post).toMatchObject({ status: 'live', story_order: 17, social_profile_id: p.marcus, trending_topic: '#GalaNight', ai_generated: true });
    expect(r.post.posted_at).toBeTruthy();
    expect(r.post.gate_json).toMatchObject({ pass: true, voice: 0.9, flags: [], review: [] });
    // The drafter saw the voice, an example and the Living State only as private context.
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('ok but who approved beige');
    expect(prompt).toMatch(/PRIVATE \(shapes the mood only; never state/);
    expect(prompt).toContain(SECRET);
    for (let i = 0; i < 40 && !(await models.PulsePostNumber.findOne({ where: { post_id: r.post.id } })); i += 1) {
      await new Promise((res) => { setTimeout(res, 50); });
    }
    expect(await models.PulsePostNumber.findOne({ where: { post_id: r.post.id } })).not.toBeNull();
  });

  test('Living State quoted in the post is flagged and never published', async () => {
    const r = await draft('marcus', { text: `lowkey ${SECRET} but whatever` });
    expect(r.published).toBe(false);
    expect(codes(r)).toContain('private_state');
    expect((await r.post.reload()).status).toBe('draft');
  });

  test('banned phrases and a low voice score are flagged', async () => {
    expect(codes(await draft('marcus', { text: 'what a vibrant tapestry of looks tonight' }))).toEqual(['banned_phrase']);
    const low = await draft('marcus', { text: 'Greetings, esteemed followers.', score: 0.2 });
    expect(codes(low)).toEqual(['voice']);
    expect(low.post.gate_json.flags[0].detail).toBe('Voice match 0.2 (below 0.6).');
  });

  test('a character Lala has not met yet, and an event from a later episode, are flagged', async () => {
    expect(codes(await draft('marcus', { text: `cannot wait to see @nia${tag} there` }))).toEqual(['unrevealed_character']);
    const future = await draft('marcus', { text: `who else is going to the Starlight Ball ${tag}?` });
    expect(future.gate.flags).toEqual([{ code: 'future_event', detail: `Starlight Ball ${tag}` }]);
  });

  test("Lala's own post, a post about Lala, and a story-revealing post go to Review even when they pass", async () => {
    const own = await draft('lala', { text: 'the gold one won.' });
    expect(own).toMatchObject({ published: false, review: ['lala'] });
    expect(own.gate.pass).toBe(true);
    const about = await draft('marcus', { text: 'saw lala at the gala and wow' });
    expect(about.review).toEqual(['about_lala']);
    const reveal = await draft('marcus', { text: 'not saying who but someone is leaving the agency', revealsStory: true });
    expect(reveal.review).toEqual(['reveals_story']);
    expect((await reveal.post.reload()).gate_json.review).toEqual(['reveals_story']);
  });

  test('no Voice Profile, no draft; an unreadable draft is an error and saves nothing', async () => {
    await expect(drafter.draftAndRoute(models, { showId: ids.show, characterId: c.novoice, moment: 17 }))
      .rejects.toThrow(/has no Voice Profile yet/);
    expect(mockCreate).not.toHaveBeenCalled();
    const before = await models.FeedPost.count({ where: { show_id: ids.show } });
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'no.' }] });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(drafter.draftAndRoute(models, { showId: ids.show, characterId: c.marcus, moment: 17 })).rejects.toThrow('could not be read');
    console.error.mockRestore();
    expect(await models.FeedPost.count({ where: { show_id: ids.show } })).toBe(before);
  });
});
