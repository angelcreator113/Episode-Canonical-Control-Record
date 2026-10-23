/**
 * One truth for relationships (Evoni, 2026-10-23: "We need to make sure
 * everywhere relationships are mentioned all information is the same";
 * "feed profiles and pulse profiles should be the same thing now"),
 * against the test database:
 * - migration 20261023230000 copies any feed_profile_relationships row not
 *   yet copied, then drops the table; down recreates it empty; up again;
 * - migration 20261023230100's backfill links a Pulse pair to the story pair
 *   of the same two people (both with registry characters), once;
 * - saving a story pair finds or makes its Pulse pair and never changes the
 *   Pulse side's public status;
 * - the drift report: story vs Pulse kind, a Pulse couple with someone else,
 *   lala_relationship vs the Lala story pair, relationships_map vs the story;
 *   Fix and Different on purpose (which comes back when a store changes);
 * - the script writer and the character file read the story pair.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const truth = require('../../src/services/relationshipTruth');
const retire = require('../../src/migrations/20261023230000-retire-feed-profile-relationships');
const link = require('../../src/migrations/20261023230100-link-pulse-pairs-to-story-pairs');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');
const { characterFilePrompt } = require('../../src/services/characterFile');

const { sequelize, Sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) => (await run(sql, replacements))[0][0];
const exists = async (name) => Boolean((await one('SELECT to_regclass(:name) AS reg', { name: `public.${name}` })).reg);

(shouldSkip ? describe.skip : describe)('one truth for relationships', () => {
  const tag = uuid().slice(0, 8);
  const ids = { reg: uuid(), show: uuid(), ep: uuid(), event: uuid(), brief: uuid() };
  const p = {}; // Pulse profile ids
  const c = {}; // registry character ids
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const qi = () => sequelize.getQueryInterface();

  const story = async (a, b, type, extra = {}) => {
    const id = uuid();
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, status,
                 is_romantic, family_role, situation, created_at, updated_at)
               VALUES (:id, :a, :b, :type, true, :status, :romantic, :family, :situation, NOW(), NOW())`,
    { id, a: c[a], b: c[b], type, status: extra.status || 'Active', romantic: Boolean(extra.romantic), family: extra.family || null, situation: extra.situation || null });
    return id;
  };
  const pulse = async (a, b, type, visibility = 'public') => (await one(
    `INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, public_visibility, created_at, updated_at)
     VALUES (:a, :b, :type, :visibility, NOW(), NOW()) RETURNING id`, { a: p[a], b: p[b], type, visibility })).id;
  const pulseRow = (id) => one(`SELECT relationship_type::text AS type, public_visibility::text AS visibility, character_relationship_id AS story
                                  FROM social_profile_relationships WHERE id = :id`, { id });
  const report = async () => (await as(request(app).get('/api/v1/relationships/drift'))).body.items;
  const mine = (items) => items.filter((i) => (i.who || []).some((w) => w.handle && w.handle.endsWith(tag)) || (i.who || []).some((w) => Object.values(c).includes(w.character_id)));

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-reltruth', email: 'evoni@reltruth.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Rel truth ${tag}`, slug: `rel-truth-${tag}` });
    await run(`INSERT INTO character_registries (id, title, book_tag, show_id, created_at, updated_at) VALUES (:reg, 'Rel truth', :tag, :show, NOW(), NOW())`,
      { reg: ids.reg, tag: `rt-${tag}`, show: ids.show });
    for (const key of ['lala', 'nia', 'marcus', 'kim', 'dee', 'jo', 'ana', 'bea']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
    }
    // Registry characters for all but ana and bea (Pulse-only people).
    for (const key of ['lala', 'nia', 'marcus', 'kim', 'dee', 'jo']) {
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, :name, :pid, NOW(), NOW() + INTERVAL '1 day')`,
      { id: c[key], reg: ids.reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name: key[0].toUpperCase() + key.slice(1), pid: p[key] });
    }
  });

  afterAll(async () => {
    const all = Object.values(p);
    await run(`DELETE FROM relationship_drift_keeps WHERE drift_key LIKE ANY (ARRAY[:keys])`,
      { keys: all.map((id) => `%${id}%`).concat(Object.values(c).map((id) => `%${id}%`)) }).catch(() => {});
    await run('DELETE FROM episode_briefs WHERE id = :brief', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:all) OR target_profile_id IN (:all)', { all });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:c) OR character_id_b IN (:c)', { c: Object.values(c) });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:all)', { all });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('migration 20261023230000: copies what was not copied, drops the old table; down recreates it empty; up again', async () => {
    expect(await exists('feed_profile_relationships')).toBe(false);
    await retire.down(qi(), Sequelize);
    expect(await exists('feed_profile_relationships')).toBe(true);
    await run(`INSERT INTO feed_profile_relationships (id, influencer_a_id, influencer_b_id, relationship_type, is_public, notes, created_at, updated_at)
               VALUES (:id, :a, :b, 'beef', false, 'the tour', NOW(), NOW())`, { id: uuid(), a: p.ana, b: p.bea });
    await retire.up(qi(), Sequelize);
    expect(await exists('feed_profile_relationships')).toBe(false);
    const copied = await one(`SELECT relationship_type::text AS type, public_visibility::text AS v, description FROM social_profile_relationships
                               WHERE source_profile_id = :a AND target_profile_id = :b`, { a: p.ana, b: p.bea });
    expect(copied).toEqual({ type: 'feud', v: 'hidden', description: 'the tour' });
    // Run again with the table gone: nothing to do.
    await retire.up(qi(), Sequelize);
    expect(models.FeedProfileRelationship).toBeUndefined();
  });

  test('migration 20261023230100: links a Pulse pair to the story pair of the same two people, once; down and up', async () => {
    const s = await story('nia', 'marcus', 'rival');
    const spr = await pulse('marcus', 'nia', 'feud');
    const pulseOnly = await one(`SELECT id FROM social_profile_relationships WHERE source_profile_id = :a AND target_profile_id = :b`, { a: p.ana, b: p.bea });

    await link.down(qi(), Sequelize);
    expect((await one(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = 'social_profile_relationships' AND column_name = 'character_relationship_id'`)).n).toBe(0);
    expect(await exists('relationship_drift_keeps')).toBe(false);
    await link.up(qi(), Sequelize);
    expect((await pulseRow(spr)).story).toBe(s);
    expect((await pulseRow(pulseOnly.id)).story).toBeNull();
    expect(await exists('relationship_drift_keeps')).toBe(true);
    // Again: already linked, nothing new.
    expect(await truth.linkStoryAndPulse(sequelize)).toEqual({ linked: 0 });
    await link.up(qi(), Sequelize);
    expect((await pulseRow(spr)).story).toBe(s);
  });

  test('saving a story pair makes its Pulse pair (a romance hidden); an existing one keeps its public status', async () => {
    const made = await as(request(app).post('/api/v1/relationships')).send({ character_id_a: c.kim, character_id_b: c.dee, relationship_type: 'girlfriend' });
    expect(made.status).toBe(201);
    expect(made.body.pulse).toMatchObject({ made: true });
    const row = await pulseRow(made.body.pulse.pulse_relationship_id);
    expect(row).toEqual({ type: 'couple', visibility: 'hidden', story: made.body.relationship.id });

    // Evoni makes it public online; a later story edit keeps that.
    await run(`UPDATE social_profile_relationships SET public_visibility = 'public' WHERE id = :id`, { id: made.body.pulse.pulse_relationship_id });
    const edited = await as(request(app).put(`/api/v1/relationships/${made.body.relationship.id}`)).send({ relationship_type: 'wife' });
    expect(edited.status).toBe(200);
    expect(edited.body.pulse).toEqual({ pulse_relationship_id: made.body.pulse.pulse_relationship_id, made: false });
    expect((await pulseRow(made.body.pulse.pulse_relationship_id)).visibility).toBe('public');

    // An unlinked Pulse pair the two already have is linked, not duplicated, and its status is left alone.
    const secret = await pulse('jo', 'kim', 'secret_link', 'rumored');
    const res = await as(request(app).post('/api/v1/relationships')).send({ character_id_a: c.kim, character_id_b: c.jo, relationship_type: 'friend' });
    expect(res.body.pulse).toEqual({ pulse_relationship_id: secret, made: false });
    expect(await pulseRow(secret)).toEqual({ type: 'secret_link', visibility: 'rumored', story: res.body.relationship.id });
    // Someone with no Pulse profile: nothing is made.
    expect(await truth.syncStoryPair(sequelize, uuid())).toEqual({ skipped: 'not a confirmed story pair' });
  });

  test('the drift report: story rival vs Pulse bestie; Fix changes only the kind', async () => {
    await run('DELETE FROM social_profile_relationships WHERE id IN (SELECT id FROM social_profile_relationships WHERE source_profile_id = :m AND target_profile_id = :n)', { m: p.marcus, n: p.nia });
    const bestie = await pulse('nia', 'marcus', 'bestie', 'rumored');
    let items = mine(await report());
    const item = items.find((i) => i.key === `pulse_kind:${bestie}`);
    expect(item).toMatchObject({
      kind: 'pulse_kind',
      says: [{ store: 'Story (Relationships)', value: 'rival' }, { store: 'The Pulse', value: 'bestie (rumored)' }],
      fix: { label: 'Make it rival on The Pulse' },
    });
    expect(item.who.map((w) => w.name)).toEqual(['Nia', 'Marcus']);
    expect((await request(app).get('/api/v1/relationships/drift')).status).toBe(401);

    const fixed = await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/fix`));
    expect(fixed.status).toBe(200);
    expect(await pulseRow(bestie)).toMatchObject({ type: 'rival', visibility: 'rumored' });
    items = mine(await report());
    expect(items.find((i) => i.key === item.key)).toBeUndefined();
    expect((await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/fix`))).status).toBe(404);
  });

  test('a Pulse couple with someone else while the story has a romance; Different on purpose, until a store changes', async () => {
    // Kim's story romance is Dee; on The Pulse Kim is a couple with Marcus.
    const couple = await pulse('kim', 'marcus', 'couple');
    let item = mine(await report()).find((i) => i.key === `pulse_couple_elsewhere:${couple}:${p.kim}`);
    expect(item).toMatchObject({
      kind: 'pulse_couple_elsewhere',
      says: [{ store: 'Story (Relationships)', value: "Kim's love interest is Dee" }, { store: 'The Pulse', value: `a couple with @marcus${tag}` }],
      fix: { label: `Make @kim${tag} and @marcus${tag} exes on The Pulse` },
    });
    const kept = await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/keep`)).send({ note: 'a fake public couple' });
    expect(kept.status).toBe(200);
    expect(mine(await report()).find((i) => i.key === item.key)).toBeUndefined();
    const withKept = (await as(request(app).get('/api/v1/relationships/drift').query({ include_kept: 'true' }))).body.items;
    expect(withKept.find((i) => i.key === item.key)).toMatchObject({ kept: true });
    const stored = await one('SELECT note, kept_by FROM relationship_drift_keeps WHERE drift_key = :key', { key: item.key });
    expect(stored).toEqual({ note: 'a fake public couple', kept_by: 'evoni@reltruth.dev' });

    // Kim's story romance moves on to Jo: what the story says changed, so it is back.
    await run(`UPDATE character_relationships SET is_romantic = false, relationship_type = 'ex' WHERE character_id_a = :k AND character_id_b = :d`, { k: c.kim, d: c.dee });
    await story('kim', 'jo', 'boyfriend');
    item = mine(await report()).find((i) => i.key === `pulse_couple_elsewhere:${couple}:${p.kim}`);
    expect(item.says[0].value).toBe("Kim's love interest is Jo");
    expect(item.kept).toBeUndefined();
    await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/fix`));
    expect((await pulseRow(couple)).type).toBe('ex');
  });

  test('a story pair with no Pulse pair is listed; Fix adds it', async () => {
    const s = await story('dee', 'jo', 'Mentor');
    const item = mine(await report()).find((i) => i.key === `pulse_missing:${s}`);
    expect(item).toMatchObject({ says: [{ store: 'Story (Relationships)', value: 'Mentor' }, { store: 'The Pulse', value: 'nothing' }] });
    await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/fix`));
    const made = await one(`SELECT relationship_type::text AS type, character_relationship_id AS story FROM social_profile_relationships
                             WHERE source_profile_id = :a AND target_profile_id = :b`, { a: p.dee, b: p.jo });
    expect(made).toEqual({ type: 'mentor', story: s });
  });

  test("lala_relationship against Lala's story pair; Fix sets it", async () => {
    await run(`UPDATE social_profiles SET lala_relationship = 'competitive' WHERE id = :id`, { id: p.dee });
    await story('lala', 'dee', 'sister', { family: 'sister' });
    const item = mine(await report()).find((i) => i.key === `lala_tie:${p.dee}`);
    expect(item).toMatchObject({
      kind: 'lala_tie',
      says: [{ store: 'Story (Relationships)', value: 'sister' }, { store: "Pulse profile's tie to Lala", value: "Lala's rival" }],
      fix: { label: 'Set their tie to Lala to "knows Lala in person"' },
    });
    await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/fix`));
    expect((await one('SELECT lala_relationship::text AS t FROM social_profiles WHERE id = :id', { id: p.dee })).t).toBe('direct');
    expect(mine(await report()).find((i) => i.key === item.key)).toBeUndefined();
  });

  test('relationships_map: a story person listed under another kind; read from the story; Fix rewrites it', async () => {
    await run(`UPDATE registry_characters SET relationships_map = CAST(:m AS jsonb) WHERE id = :id`,
      { id: c.nia, m: JSON.stringify({ allies: ['Marcus', 'Someone Unknown'], rivals: [], dynamic_notes: 'old wounds' }) });
    const item = mine(await report()).find((i) => i.key === `relationships_map:${c.nia}`);
    expect(item.says).toEqual([{ store: 'Story (Relationships)', value: 'Marcus: rival' }, { store: 'Character relationships map', value: 'Marcus under allies' }]);

    const character = await models.RegistryCharacter.findByPk(c.nia);
    expect(await truth.relationshipsMapOf(models, character)).toEqual({ allies: ['Someone Unknown'], rivals: ['Marcus'], dynamic_notes: 'old wounds' });

    await as(request(app).post(`/api/v1/relationships/drift/${encodeURIComponent(item.key)}/fix`));
    const row = await one('SELECT relationships_map FROM registry_characters WHERE id = :id', { id: c.nia });
    expect(row.relationships_map).toEqual({ allies: ['Someone Unknown'], rivals: ['Marcus'], dynamic_notes: 'old wounds' });
  });

  test("the script writer reads Lala's story pair first; the character file shows family role, love interest and stage", async () => {
    // Dee is Lala's sister in the story; her profile still says competitive.
    await run(`UPDATE social_profiles SET lala_relationship = 'competitive' WHERE id = :id`, { id: p.dee });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Rel truth episode', 1, 'draft', NOW(), NOW())`, ids);
    const cc = { automation: { guest_profiles: [{ profile_id: p.dee }, { profile_id: p.marcus }] } };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'The Gala', 'fashion_event', CAST(:cc AS jsonb), NOW(), NOW())`, { ...ids, cc: JSON.stringify(cc) });
    await run(`INSERT INTO episode_briefs (id, episode_id, event_id, created_at, updated_at) VALUES (:brief, :ep, :event, NOW(), NOW())`, ids);
    await run(`UPDATE social_profiles SET lala_relationship = 'direct' WHERE id = :id`, { id: p.marcus });

    const context = await loadScriptContext(ids.ep, ids.show, models);
    const dee = context.socialProfiles.find((x) => x.id === p.dee);
    expect(dee).toMatchObject({ lala_relationship: null, lala_story_tie: 'sister' });
    const marcus = context.socialProfiles.find((x) => x.id === p.marcus);
    expect(marcus).toMatchObject({ lala_relationship: 'direct', lala_story_tie: null });
    const prompt = buildFullPrompt(context);
    const deeBlock = prompt.slice(prompt.indexOf(`@dee${tag}`), prompt.indexOf(`@dee${tag}`) + 600);
    expect(deeBlock).toContain('With Lala in the story: sister');
    expect(deeBlock).not.toContain("Lala's rival");

    // The character file: Kim's relationships, the story's words.
    const s = await one(`SELECT id FROM character_relationships WHERE character_id_a = :k AND character_id_b = :j AND relationship_type = 'boyfriend'`, { k: c.kim, j: c.jo });
    await run(`INSERT INTO relationship_events (id, relationship_id, event_type, title, relationship_stage, created_at, updated_at)
               VALUES (:id, :rel, 'confession', 'They said it', 'lovers', NOW(), NOW())`, { id: uuid(), rel: s.id });
    const kim = await models.RegistryCharacter.findByPk(c.kim);
    const { block } = await characterFilePrompt(models, { character: kim });
    expect(block).toContain('- Jo (boyfriend, now lovers)');
    expect(block).toContain('- Dee (ex)');
    const { block: deeFile } = await characterFilePrompt(models, { character: await models.RegistryCharacter.findByPk(c.dee) });
    expect(deeFile).toContain('- Lala (sister)');
  });
});
