/**
 * What characters privately know (Task #3088; Evoni, 2026-10-13: "Use
 * 'knows' as private drafting context. Knowing a secret doesn't authorize
 * revealing it publicly."), with the Anthropic calls mocked:
 * - privateKnowledge reads each side's own knowledge of a confirmed
 *   relationship (source_knows for character_id_a, target_knows for
 *   character_id_b), never reader_knows and never an unconfirmed one;
 * - the drafter gives it to the model only in the PRIVATE block;
 * - a draft that quotes it is flagged and stays a draft for Review; one that
 *   does not publishes.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
const drafter = require('../../src/services/pulseDrafter');
const { privateKnowledge } = require('../../src/services/pulseKnowledge');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('What characters privately know (Task #3088)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep1: uuid() };
  const c = {};
  const p = {};
  const NIA_KNOWS = `Marcus is secretly broke ${tag}. He hides it from the sponsors`;
  const MARCUS_KNOWS = `Nia lied about the gala invite ${tag}`;
  const READER = `READER-ONLY-${tag}`;
  const UNCONFIRMED = `UNCONFIRMED-${tag} they never met`;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Knows ${tag}`, slug: `knows-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { automated_requests: 100, manual_requests: 100 });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Knows', :show, NOW(), NOW())`, ids);
    for (const key of ['nia', 'marcus', 'stranger']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, living_state, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, CAST(:state AS jsonb), NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key], state: JSON.stringify({ mood: 'fine' }) });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' },
        examples_json: [{ id: uuid(), text: 'ok but who approved beige', kind: 'pinned' }], status: 'built' });
    }
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, source_knows, target_knows, reader_knows, created_at, updated_at)
               VALUES (:id, :a, :b, 'rival', true, :sk, :tk, :rk, NOW(), NOW())`,
    { id: uuid(), a: c.nia, b: c.marcus, sk: NIA_KNOWS, tk: MARCUS_KNOWS, rk: READER });
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, source_knows, created_at, updated_at)
               VALUES (:id, :a, :b, 'friend', false, :sk, NOW(), NOW())`, { id: uuid(), a: c.nia, b: c.stranger, sk: UNCONFIRMED });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:a) OR character_id_b IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('each side\'s own knowledge of a confirmed relationship; never the reader\'s, never an unconfirmed one', async () => {
    expect(await privateKnowledge(models, c.nia)).toEqual([{ person: 'marcus', knows: NIA_KNOWS }]);
    expect(await privateKnowledge(models, c.marcus)).toEqual([{ person: 'nia', knows: MARCUS_KNOWS }]);
    expect(await privateKnowledge(models, c.stranger)).toEqual([]);
    expect(await privateKnowledge(models, null)).toEqual([]);
  });

  const draft = async (text) => {
    mockCreate.mockResolvedValueOnce(say({ text, hashtag: null, reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.9, why: 'sounds like them' }));
    return drafter.draftAndRoute(models, { showId: ids.show, characterId: c.nia, moment: 17, context: { about: 'the gala' } });
  };

  test('the drafter gets it only as private context, under the rule never to post it', async () => {
    await draft('ok the gala was a whole moment');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    const privateBlock = prompt.slice(prompt.indexOf('PRIVATE'));
    expect(privateBlock).toContain('What they privately know is not public: they never post it, reveal it or hint at it');
    expect(privateBlock).toContain(NIA_KNOWS);
    expect(prompt.indexOf(NIA_KNOWS)).toBeGreaterThan(prompt.indexOf('PRIVATE'));
    expect(prompt).not.toContain(READER);
    expect(prompt).not.toContain(MARCUS_KNOWS);
    expect(prompt).not.toContain('UNCONFIRMED');
  });

  test('a draft that discloses it is flagged and waits in Review; one that does not publishes', async () => {
    const leaked = await draft(`lol marcus is secretly broke ${tag} and everyone can tell`);
    expect(leaked.published).toBe(false);
    expect(leaked.gate.flags.map((f) => f.code)).toContain('private_state');
    await leaked.post.reload();
    expect(leaked.post.status).toBe('draft');

    const fine = await draft('marcus looked so good at the gala ngl');
    expect(fine.gate.flags.map((f) => f.code)).not.toContain('private_state');
    expect(fine.published).toBe(true);
  });
});
