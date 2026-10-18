/**
 * Pair beats (Evoni's idea 4, follow-up to storyline seeds, 2026-10-17:
 * "yes start the pair beats follow-up"), the Anthropic call mocked. Bea
 * (Beauty Oracle) and Tess (Trendsetter) are the pair; Wen (Wellness Guide,
 * skincare too) shares Bea's audience; Con (Connector, parenting) shares
 * nobody's. All four are Alive with a Voice Profile.
 * - a premise that names posters by handle makes them the leads: the
 *   prompt gives them most beats and the payoff, and offers besides only
 *   the creators whose audience overlaps theirs; a beat by anyone else is
 *   dropped;
 * - a premise that names nobody offers every poster, as before.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
const storylines = require('../../src/services/pulseStorylines');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('pair beats', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const p = {};
  const c = {};
  const h = (key) => `${key}${tag}`;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Beats ${tag}`, slug: `beats-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { automated_requests: 100, manual_requests: 100 });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Beats', :show, NOW(), NOW())", ids);
    for (const [key, type, niche] of [['bea', 'The Beauty Oracle', 'skincare'], ['tess', 'The Trendsetter', 'skincare'], ['wen', 'The Wellness Guide', 'skincare'], ['con', 'The Connector', 'parenting']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, content_category, status, created_at, updated_at)
        VALUES (:h, 'pulse', 'x', :d, 'lalaverse', :type, :niche, 'finalized', NOW(), NOW()) RETURNING id`, { h: h(key), d: key, type, niche: `${niche} ${tag}` });
      p[key] = Number(row.id);
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
        VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' },
        examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM pulse_storylines WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:ids)', { ids: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('the posters a premise names lead; only creators whose audience overlaps theirs are offered besides', async () => {
    const line = await models.PulseStoryline.create({ show_id: ids.show, title: 'Who Called It First',
      premise: `@${h('bea')} posts a serum verdict. ${h('tess')}, swears she said it first.`, status: 'planned' });
    mockCreate.mockResolvedValue(say({ beats: [
      { kind: 'plant', story_order: 0, handle: `@${h('bea')}`, brief: 'a serum, half out of frame' },
      { kind: 'build', story_order: 0, handle: `@${h('wen')}`, brief: 'asks who said it first' },
      { kind: 'build', story_order: 0, handle: `@${h('con')}`, brief: 'not offered' },
      { kind: 'payoff', story_order: 0, handle: `@${h('tess')}`, brief: 'the receipts' },
    ] }));
    const out = await storylines.suggestBeats(models, line.id);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`The storyline is between: @${h('bea')}, @${h('tess')}. Give them most beats (at least two in three), and the payoff.`);
    expect(prompt).toContain(`would react: @${h('wen')}`);
    expect(prompt).not.toContain(h('con'));
    expect(out.map((b) => b.handle)).toEqual([h('bea'), h('wen'), h('tess')]);
  });

  it('a premise that names nobody offers every poster, as before', async () => {
    const line = await models.PulseStoryline.create({ show_id: ids.show, title: 'Quiet', premise: 'Someone is copying someone.', status: 'planned' });
    mockCreate.mockResolvedValue(say({ beats: [] }));
    await storylines.suggestBeats(models, line.id);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('The storyline is between');
    for (const key of ['bea', 'tess', 'wen', 'con']) expect(prompt).toContain(`@${h(key)}`);
  });
});
