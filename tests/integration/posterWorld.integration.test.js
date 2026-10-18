/**
 * The post drafter gets the world (Evoni, 2026-10-18: "yes start giving the
 * post drafter the world"), the Anthropic call mocked. Mira lives in Echo
 * Park, works from her studio and goes to a café; Plain has no city or
 * places. A Show Bible rule is always on for the show.
 * - a post's prompt carries her city and its culture, her studio and the
 *   places she goes, and the Show Bible's always-on rules, and the rules
 *   used are counted;
 * - a poster with no city or places gets no world lines (drafted as before);
 * - the character file says where she lives;
 * - a direct message's prompt carries the same world and rules.
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

(shouldSkip ? describe.skip : describe)('the post drafter gets the world', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const c = {};
  const p = {};
  const loc = {};
  let rule;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `World ${tag}`, slug: `world-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { automated_requests: 100, manual_requests: 100 });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'World', :show, NOW(), NOW())", ids);
    loc.studio = (await models.WorldLocation.create({ name: `Mira${tag}'s Studio`, slug: `mira-${tag}`, location_type: 'venue', venue_type: 'recording_studio', city: 'Echo Park' })).id;
    loc.cafe = (await models.WorldLocation.create({ name: `Night Owl ${tag}`, slug: `owl-${tag}`, location_type: 'venue', venue_type: 'cafe', city: 'Echo Park' })).id;
    for (const [key, city, home, haunts] of [['mira', 'echo_park', loc.studio, [loc.studio, loc.cafe]], ['plain', null, null, []]]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, home_location_id, frequent_venues, created_at, updated_at)
        VALUES (:h, 'pulse', 'test', :d, 'lalaverse', :city, :home, CAST(:haunts AS jsonb), NOW(), NOW()) RETURNING id`,
      { h: `${key}${tag}`, d: key, city, home, haunts: JSON.stringify(haunts) });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
        VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' },
        examples_json: [{ text: 'ok so' }], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    }
    const [[r]] = await run(`INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, status, scope, show_id, created_at, updated_at)
      VALUES (:t, 'Money is never discussed in public.', 'franchise_law', 'critical', true, 'active', 'show', :show, NOW(), NOW()) RETURNING id`,
    { t: `No money talk ${tag}`, show: ids.show });
    rule = r.id;
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM franchise_knowledge WHERE id = :rule', { rule });
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:ids)', { ids: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(p) });
    await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: Object.values(loc) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const answer = () => mockCreate.mockImplementation(async ({ messages }) => (
    messages[0].content.startsWith('Score how well') ? say({ score: 0.95, why: 'her', lane: 'in' }) : say({ text: 'late set, early coffee', hashtag: null, reveals_story: false })));

  it('a post carries her city and its culture, her studio, the places she goes and the Show Bible, and counts the rules used', async () => {
    answer();
    const { block, ids: ruleIds } = await require('../../src/services/posterWorld').showBible(models, ids.show);
    // A shared test database can hold more always-on rules than the limit:
    // the first rule used is the one counted.
    const counted = ruleIds[0];
    const [[before]] = await run('SELECT COALESCE(injection_count, 0) AS n FROM franchise_knowledge WHERE id = :id', { id: counted });
    await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.mira, moment: 5, context: {} });
    const prompt = drafts()[0];
    expect(prompt).toContain('Their world (a post may be set here; it need not name it):');
    expect(prompt).toContain('- They live in Echo Park, a DREAM city: Entertainment & nightlife hub.');
    expect(prompt).toContain(`- Where they work and create: Mira${tag}'s Studio (recording studio).`);
    expect(prompt).toContain(`- Places they go: Night Owl ${tag}.`);
    expect(block).toBeTruthy();
    expect(prompt).toContain(block.trim());
    if (ruleIds.includes(rule)) expect(prompt).toContain(`No money talk ${tag}`);
    const [[after]] = await run('SELECT injection_count AS n FROM franchise_knowledge WHERE id = :id', { id: counted });
    expect(Number(after.n)).toBe(Number(before.n) + 1);
  });

  it('a poster with no city or places gets no world lines', async () => {
    answer();
    await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.plain, moment: 6, context: {} });
    expect(drafts()[0]).not.toContain('Their world');
  });

  it('in a batch, each poster carries their own world', async () => {
    mockCreate.mockImplementation(async ({ messages }) => (messages[0].content.startsWith('Score how well')
      ? say({ score: 0.95, why: 'x', lane: 'in' })
      : say({ items: [{ n: 1, text: 'a', hashtag: null, reveals_story: false }, { n: 2, text: 'b', hashtag: null, reveals_story: false }] })));
    await drafter.draftPostsAndRoute(models, { showId: ids.show, moment: 7, items: [{ characterId: c.mira }, { characterId: c.plain }], context: { about: 'a night out' } });
    const prompt = drafts()[0];
    expect(prompt.match(/Their world/g)).toHaveLength(1);
    expect(prompt).toContain('They live in Echo Park');
    expect(prompt).toContain('Rules for every post:');
  });

  it('the character file says where she lives', async () => {
    const character = await models.RegistryCharacter.findByPk(c.mira);
    const { block } = await require('../../src/services/characterFile').characterFilePrompt(models, { character });
    expect(block).toContain('WHERE THEY LIVE (their DREAM city and places; anything set in their world agrees with it):\n- They live in Echo Park');
    expect(block).toContain(`Mira${tag}'s Studio`);
  });

  it('a direct message carries the same world and Show Bible', () => {
    const { buildPrompt } = require('../../src/services/pulseDms');
    const sender = { profile: { id: p.mira, handle: `mira${tag}`, display_name: 'Mira' }, voice: { habits_json: {}, examples_json: [] }, character: {} };
    const prompt = buildPrompt({ sender, other: { handle: 'tess' }, history: [], topic: 'tonight', label: 'now', known: null,
      world: 'Their world (a post may be set here; it need not name it):\n- They live in Echo Park\n', bible: '\nTHE RULES\n- [CRITICAL] No money talk\n' });
    expect(prompt).toContain('- They live in Echo Park');
    expect(prompt).toContain('- [CRITICAL] No money talk');
  });
});
