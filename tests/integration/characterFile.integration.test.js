/**
 * The character file (Evoni, 2026-10-17: "are the generators all in
 * communication with each other"; services/characterFile): one source every
 * character generator reads. It gathers the facts, the typology seed, the
 * inner life, the mask, what is behind it, confirmed relationships, events
 * and the latest live posts, each under its zone; publicOnly leaves out
 * what the public never sees. A character found from their feed profile
 * alone gives the same file.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { loadCharacterFile, characterFileBlock, characterFilePrompt } = require('../../src/services/characterFile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the character file', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const c = {};
  const p = {};

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `File ${tag}`, slug: `file-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'File', :show, NOW(), NOW())", ids);
    for (const key of ['maren', 'kai', 'ghost']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, public_persona, lifestyle_claim, private_reality, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :pub, :claim, :priv, NOW(), NOW()) RETURNING id`,
      { handle: `${key}${tag}`, display: key, pub: `effortless calm ${tag}`, claim: 'slow mornings, linen, no alarms', priv: `retakes every photo eleven times ${tag}` });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, core_wound, typology, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, :wound, CAST(:typ AS jsonb), NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: key === 'ghost' ? null : p[key], wound: `worthless without achievement ${tag}`,
        typ: JSON.stringify({ enneagram: { type: 3, wing: 4 }, mbti: 'ENFJ', why: 'image first' }) });
    }
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, source_knows, created_at, updated_at)
               VALUES (:id, :a, :b, 'rival', true, :sk, NOW(), NOW())`, { id: uuid(), a: c.maren, b: c.kai, sk: `Kai is broke ${tag}` });
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, created_at, updated_at)
               VALUES (:id, :a, :b, 'friend', false, NOW(), NOW())`, { id: uuid(), a: c.maren, b: c.ghost });
    const post = (text, status, ago) => models.FeedPost.create({
      show_id: ids.show, social_profile_id: p.maren, poster_handle: `maren${tag}`, poster_display_name: 'Maren', poster_platform: 'lalaverse', post_type: 'post',
      content_text: text, status, posted_at: new Date(Date.now() - ago), likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    });
    await post(`still beautiful ${tag}`, 'live', 1000);
    await post(`older post ${tag}`, 'live', 100000);
    await post(`a draft nobody has seen ${tag}`, 'draft', 10);
  });

  afterAll(async () => {
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:a) OR character_id_b IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  test('gathers every part, each in its zone; only confirmed relationships and live posts, newest first', async () => {
    const character = await models.RegistryCharacter.findByPk(c.maren);
    const file = await loadCharacterFile(models, { character });
    expect(file.feedProfile.id).toBe(p.maren);
    expect(file.inner.core_wound).toBe(`worthless without achievement ${tag}`);
    expect(file.mask).toMatchObject({ public_persona: `effortless calm ${tag}`, lifestyle_claim: 'slow mornings, linen, no alarms' });
    expect(file.behind.private_reality).toBe(`retakes every photo eleven times ${tag}`);
    expect(file.relationships).toEqual([{ person: 'kai', kind: 'rival', status: 'Active', knows: `Kai is broke ${tag}` }]);
    expect(file.recentPosts).toEqual([`still beautiful ${tag}`, `older post ${tag}`]);

    const block = characterFileBlock(file);
    expect(block).toMatch(/^THE CHARACTER FILE for maren/);
    for (const heading of ['TYPOLOGY SEED', 'INNER LIFE (author-only', 'THE MASK', 'BEHIND THE MASK', 'PEOPLE IN THEIR LIFE', 'THEIR LATEST POSTS']) expect(block).toContain(heading);
    expect(block).toContain('- kai (rival): privately knows Kai is broke');
    expect(block).not.toContain('a draft nobody has seen');
    // The mask comes before what is behind it.
    expect(block.indexOf('THE MASK')).toBeLessThan(block.indexOf('BEHIND THE MASK'));
  });

  test('publicOnly: only what the public sees', async () => {
    const { block } = await characterFilePrompt(models, { character: await models.RegistryCharacter.findByPk(c.maren), publicOnly: true });
    expect(block).toContain('THE MASK');
    expect(block).toContain(`still beautiful ${tag}`);
    for (const hidden of ['INNER LIFE', 'BEHIND THE MASK', 'PEOPLE IN THEIR LIFE', 'TYPOLOGY SEED', 'retakes every photo', 'Kai is broke', 'worthless without']) expect(block).not.toContain(hidden);
  });

  test('from a feed profile alone, the same character; with no feed profile, no mask from it and no posts', async () => {
    const profile = await models.SocialProfile.findByPk(p.maren);
    const fromProfile = await characterFilePrompt(models, { feedProfile: profile });
    expect(fromProfile.file.character.id).toBe(c.maren);
    expect(fromProfile.facts).toMatchObject({ feed_linked: true });
    expect(fromProfile.block).toContain('PEOPLE IN THEIR LIFE');

    const ghost = await loadCharacterFile(models, { character: await models.RegistryCharacter.findByPk(c.ghost) });
    expect(ghost.feedProfile).toBeNull();
    expect(ghost.mask).toEqual({});
    expect(ghost.recentPosts).toEqual([]);
    expect(characterFileBlock(ghost)).toContain('INNER LIFE');
    expect(characterFileBlock(await loadCharacterFile(models, {}))).toBe('');
  });
});
