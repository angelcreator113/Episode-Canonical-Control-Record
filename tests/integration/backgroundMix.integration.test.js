/**
 * Background posts keep each creator's content mix (Evoni, 2026-10-17:
 * "yes start the background posts"), the Anthropic calls mocked. Bea is
 * known as The Beauty Oracle and her last posts were all tutorials; Plain
 * has no content type.
 * - an everyday post (ambient: nothing happened) is the pillar she is
 *   furthest behind on, and records it;
 * - a post about something that happened (an event, a storyline beat) is
 *   framed as whichever pillar fits, and records the one the AI names;
 * - in a batch, only a poster with a mix gets it, and each draft records
 *   its own pillar; a poster with no content type is drafted as before.
 *
 * Each draft's format (text, quote, photo, carousel) is picked at random
 * (postFormatMix); it is pinned here to a photo post so every run drafts the
 * same prompt. Unpinned, a quote card ("This post is a quote card: …") came
 * up about one run in twenty and failed the second test (CI, 2026-10-20).
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
const drafter = require('../../src/services/pulseDrafter');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });
const drafts = () => mockCreate.mock.calls.map(([a]) => a.messages[0].content).filter((t) => !t.startsWith('Score how well'));

/** The draft answer for any drafting call; a passing voice score for the gate's. */
const answer = (draftReply) => mockCreate.mockImplementation(async ({ messages }) => (
  messages[0].content.startsWith('Score how well') ? say({ score: 0.95, why: 'her', lane: 'in' }) : say(draftReply)));

(shouldSkip ? describe.skip : describe)('background posts keep the content mix', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const c = {};
  const p = {};

  beforeAll(async () => {
    // 0.5 picks a photo post in every mix these posters use (postFormatMix.MIXES).
    require('../../src/services/postFormatMix').setRandom(() => 0.5);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `BgMix ${tag}`, slug: `bgmix-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { automated_requests: 100, manual_requests: 100 });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'BgMix', :show, NOW(), NOW())", ids);
    for (const [key, type] of [['bea', 'The Beauty Oracle'], ['plain', null]]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, created_at, updated_at)
        VALUES (:h, 'pulse', 'test', :d, 'lalaverse', :type, NOW(), NOW()) RETURNING id`, { h: `${key}${tag}`, d: `${key}${tag}`, type });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
        VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' },
        examples_json: [{ text: 'ok so' }], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    }
    for (let i = 0; i < 4; i += 1) {
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, gate_json, created_at, updated_at)
        VALUES (:id, :show, :h, :pid, :t, 'live', CAST(:g AS jsonb), NOW() - (:i || ' hours')::interval, NOW())`,
      { id: uuid(), show: ids.show, h: `bea${tag}`, pid: p.bea, t: `Tutorial ${i}`, g: JSON.stringify({ pillar: 'Tutorial or technique' }), i: String(i + 10) });
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    require('../../src/services/postFormatMix').setRandom(null);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:ids)', { ids: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('an everyday post is the pillar she is furthest behind on, and records it', async () => {
    answer({ text: 'verdict: overrated', hashtag: null, reveals_story: false });
    const r = await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.bea, moment: 5, context: {} });
    const prompt = drafts()[0];
    expect(prompt).toContain('They are known on The Pulse as The Beauty Oracle.');
    expect(prompt).toContain('Their content mix (the kinds of post they make');
    expect(prompt).toContain('This post is a Product verdict post');
    expect(prompt).toContain('"pillar": "the pillar from their mix');
    await r.post.reload();
    expect(r.post.gate_json.pillar).toBe('Product verdict');
  });

  it('a post about something that happened is framed as whichever pillar fits, and records the one named', async () => {
    answer({ text: 'gala skin prep, step one', hashtag: null, reveals_story: false, pillar: 'routine' });
    const r = await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.bea, moment: 6, context: { about: 'the night before the gala' } });
    const prompt = drafts()[0];
    expect(prompt).toContain('Frame the post as whichever of these pillars fits what happened.');
    // No planned pillar (that line is pulseDrafter's "This post is a <pillar> post …: their mix needs one.").
    expect(prompt).not.toContain('their mix needs one');
    await r.post.reload();
    expect(r.post.gate_json.pillar).toBe('Routine');
  });

  it('in a batch, only the poster with a mix gets it; each draft records its own pillar', async () => {
    answer({ items: [
      { n: 1, text: 'this is over: glitter brows', hashtag: null, reveals_story: false, pillar: '"This is over" call' },
      { n: 2, text: 'what a night', hashtag: null, reveals_story: false, pillar: null },
    ] });
    const { routed, failed } = await drafter.draftPostsAndRoute(models, {
      showId: ids.show, moment: 7, items: [{ characterId: c.bea }, { characterId: c.plain }], context: { about: 'the gala' },
    });
    expect(failed).toEqual([]);
    const prompt = drafts()[0];
    expect(prompt.match(/They are known on The Pulse as/g)).toHaveLength(1);
    const pillarOf = async (cid) => {
      const r = routed.find((x) => x.characterId === cid);
      await r.post.reload();
      return r.post.gate_json.pillar ?? null;
    };
    expect(await pillarOf(c.bea)).toBe('"This is over" call');
    expect(await pillarOf(c.plain)).toBeNull();
  });

  it('a poster with no content type is drafted as before', async () => {
    answer({ text: 'ok so', hashtag: null, reveals_story: false });
    const r = await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.plain, moment: 8, context: {} });
    expect(drafts()[0]).not.toContain('known on The Pulse');
    expect(drafts()[0]).not.toContain('"pillar"');
    await r.post.reload();
    expect(r.post.gate_json.pillar).toBeUndefined();
  });
});
