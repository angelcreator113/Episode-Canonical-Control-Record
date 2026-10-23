/**
 * One person page (Evoni, 2026-10-23), against the test database:
 * GET /api/v1/person/:id gathers who they are, their Pulse account, their
 * relationships (stage, love interest, who knows, different online), their
 * episodes newest first with what changed for them, and the lines the
 * script writer reads about them, which match what the script writer's own
 * blocks write.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { lalaStoryTies, lalaTieFields } = require('../../src/services/relationshipTruth');
const { familyLines } = require('../../src/services/familyTies');
const sw = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('one person page (2026-10-23)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), event: uuid() };
  const c = {};
  const p = {};
  const rel = {};
  let token;
  let aliasesAdded = false;

  const profile = async (key, extra = {}) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status,
        follower_tier, follower_count_approx, lala_relationship, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', 'finalized', :tier, :count, :tie, NOW(), NOW()) RETURNING id`,
    { handle: `${key}${tag}`, display: extra.display || `${key}${tag}`, tier: extra.tier || null, count: extra.count || null, tie: extra.tie || null });
    p[key] = row.id;
    return row.id;
  };
  const person = async (key, name, { selected = null, withProfile = true, prose = null, profileExtra = {}, role = 'support' } = {}) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, prose_overview, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :selected, :role, :prose, :profile, NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name, selected, role, prose, profile: withProfile ? await profile(key, profileExtra) : null });
  };
  const relate = async (key, a, b, f = {}) => {
    rel[key] = uuid();
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role,
                 situation, public_state, known_by, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :romantic, :family, :situation, :state, CAST(:known AS jsonb),
                       NOW(), NOW() + (:n || ' seconds')::interval)`,
    { id: rel[key], a: c[a], b: c[b], type: f.type || 'friend', confirmed: f.confirmed !== false, romantic: !!f.romantic, family: f.family || null,
      situation: f.situation || null, state: f.state || 'known', known: JSON.stringify(f.known || []), n: String(Object.keys(rel).length) });
  };
  const get = (id, auth = true) => {
    const r = request(app).get(`/api/v1/person/${id}`);
    return auth ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-user-person', email: 'evoni@person.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Person ${tag}`, slug: `person-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'People', :show, NOW(), NOW())", ids);
    for (const [k, n] of [['ep1', 1], ['ep2', 2], ['ep3', 3]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:id, :show, :title, :n, 'draft', NOW(), NOW())`, { id: ids[k], show: ids.show, title: `Episode title ${n}`, n });
    }
    await person('lala', 'Lala');
    await person('marcus', `Truthville ${tag}`, {
      selected: `Marcus Hale ${tag}`, prose: 'A producer who never says what he wants. He collects favours.',
      profileExtra: { display: `Truthville ${tag}`, tier: 'micro', count: '48K', tie: 'aware' },
    });
    await person('jade', `Jade Monroe ${tag}`);
    await person('dre', `Dre ${tag}`, { withProfile: false });

    // A secret romance with Lala that Jade knows of; on the Pulse they are only "bestie".
    await relate('lm', 'lala', 'marcus', { type: 'love_interest', romantic: true, situation: 'They kiss in the stairwell', state: 'secret', known: [{ registry_character_id: c.jade }] });
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, public_visibility, character_relationship_id, created_at, updated_at)
               VALUES (:a, :b, 'bestie', 'public', :rel, NOW(), NOW())`, { a: p.lala, b: p.marcus, rel: rel.lm });
    // Jade is his sister: a family tie.
    await relate('mj', 'jade', 'marcus', { type: 'family', family: 'sister', state: 'rumoured' });
    // A rival with no Pulse profile.
    await relate('md', 'marcus', 'dre', { type: 'rival' });
    // Not confirmed: never on the page.
    await relate('mx', 'marcus', 'dre', { type: 'mentor', confirmed: false });

    // Episode 1 moved the romance on (the "What changed" card writes this).
    await run(`INSERT INTO relationship_events (id, relationship_id, event_type, title, description, relationship_stage, metadata, created_at, updated_at)
               VALUES (gen_random_uuid(), :rel, 'escalation', 'Episode 1', 'They kissed at the gala.', 'lovers', CAST(:meta AS jsonb), NOW(), NOW())`,
    { rel: rel.lm, meta: JSON.stringify({ episode_id: ids.ep1, stage_before: 'flirting', source: 'record' }) });
    // Episode 2's story record has a row for him.
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, characters, created_at, updated_at)
               VALUES (:ep, :show, 'approved', 'The gala.', CAST(:chars AS jsonb), NOW(), NOW())`,
    { ep: ids.ep2, show: ids.show, chars: JSON.stringify([
      { character_id: c.marcus, name: 'Marcus', knew: 'Lala was seeing someone', learned: 'it was him all along', changed: '' },
      { character_id: c.jade, name: 'Jade', knew: 'nothing' },
    ]) });
    // Episode 3: he is a guest at its event.
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, used_in_episode_id, created_at, updated_at)
               VALUES (:event, :show, 'Rooftop Launch', 'invite', CAST(:cc AS jsonb), 'ready', :ep, NOW(), NOW())`,
    { event: ids.event, show: ids.show, ep: ids.ep3, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.marcus }] } }) });
  });

  afterAll(async () => {
    const all = Object.values(c);
    if (aliasesAdded) await run('ALTER TABLE social_profiles DROP COLUMN IF EXISTS aliases');
    await run('DELETE FROM relationship_events WHERE relationship_id IN (:r)', { r: Object.values(rel) });
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM episode_story_records WHERE episode_id IN (:eps)', { eps: [ids.ep1, ids.ep2, ids.ep3] });
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM episodes WHERE id IN (:eps)', { eps: [ids.ep1, ids.ep2, ids.ep3] });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('needs a sign-in; a bad id is a 400 and a missing one a 404', async () => {
    expect((await get(c.marcus, false)).status).toBe(401);
    expect((await get('not-a-uuid')).status).toBe(400);
    expect((await get(uuid())).status).toBe(404);
  });

  test('who they are and their Pulse account, with their tie to Lala from the story', async () => {
    const res = await get(c.marcus);
    expect(res.status).toBe(200);
    const { who, pulse } = res.body.person;
    expect(who).toMatchObject({
      name: `Marcus Hale ${tag}`, online_as: `Truthville ${tag}`, role_type: 'support', is_lala: false,
      summary: 'A producer who never says what he wants.',
    });
    // No aliases column on this database yet: none, and no error.
    expect(who.aliases).toEqual([]);
    expect(pulse).toMatchObject({ id: p.marcus, handle: `marcus${tag}`, follower_tier: 'micro', follower_count: '48K', link: `/pulse?profile=${p.marcus}` });
    // The Lala story pair decides the tie, over the profile's "aware".
    expect(pulse.lala_tie).toMatchObject({ from: 'story', tie: 'direct' });
    expect(pulse.lala_tie.words).toMatch(/love interest/);

    // Dre has no Pulse account.
    const dre = (await get(c.dre)).body.person;
    expect(dre.pulse).toBeNull();
    expect(dre.writers.in_cast_block).toBe(false);
  });

  test('also-known-as names once social_profiles.aliases exists', async () => {
    await run("ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb");
    aliasesAdded = true;
    await run('UPDATE social_profiles SET aliases = CAST(:a AS jsonb) WHERE id = :id', { id: p.marcus, a: JSON.stringify(['Truth', ' Truth ', 'M.H.', '']) });
    const { who } = (await get(c.marcus)).body.person;
    expect(who.aliases).toEqual(['Truth', 'M.H.']);
    await run('ALTER TABLE social_profiles DROP COLUMN IF EXISTS aliases');
    aliasesAdded = false;
  });

  test('every confirmed relationship: stage, love interest, who knows, different online', async () => {
    const { relationships } = (await get(c.marcus)).body.person;
    expect(relationships.map((r) => r.id).sort()).toEqual([rel.lm, rel.mj, rel.md].sort());
    const lm = relationships.find((r) => r.id === rel.lm);
    expect(lm).toMatchObject({
      other: { id: c.lala, name: 'Lala' }, stage: 'lovers', love_interest: true,
      public_state: 'secret', public_label: 'Secret', known_by: [`Jade Monroe ${tag}`],
      online: { differs: true, says: 'bestie' }, link: `/relationships?rel=${rel.lm}`,
    });
    const mj = relationships.find((r) => r.id === rel.mj);
    expect(mj).toMatchObject({ other: { name: `Jade Monroe ${tag}` }, kind: 'sister', love_interest: false, public_label: 'Rumoured', online: null });
    const md = relationships.find((r) => r.id === rel.md);
    expect(md).toMatchObject({ kind: 'rival', public_label: 'Known', online: null });

    // A Pulse pair that fits is not "different".
    await run("UPDATE social_profile_relationships SET relationship_type = 'couple', public_visibility = 'hidden' WHERE character_relationship_id = :rel", { rel: rel.lm });
    const again = (await get(c.marcus)).body.person.relationships.find((r) => r.id === rel.lm);
    expect(again.online).toEqual({ differs: false, says: 'couple (hidden)' });
    await run("UPDATE social_profile_relationships SET relationship_type = 'bestie', public_visibility = 'public' WHERE character_relationship_id = :rel", { rel: rel.lm });
  });

  test('episode history newest first, each with what changed for them', async () => {
    const { episodes } = (await get(c.marcus)).body.person;
    expect(episodes.map((e) => e.episode_number)).toEqual([3, 2, 1]);
    const [e3, e2, e1] = episodes;
    expect(e3).toMatchObject({ id: ids.ep3, via: ['guest'], record: null, link: `/episodes/${ids.ep3}` });
    expect(e3.events).toEqual([{ id: ids.event, name: 'Rooftop Launch', role: 'guest' }]);
    expect(e2).toMatchObject({ via: ['story record'], record: { status: 'approved', knew: 'Lala was seeing someone', learned: 'it was him all along', changed: null } });
    expect(e1).toMatchObject({ via: ['relationship'], record: null });
    expect(e1.changes).toEqual([{ relationship_id: rel.lm, with: 'Lala', stage: 'flirting → lovers', note: 'They kissed at the gala.' }]);

    // Jade: only episode 2's record names her (and the romance she knows of is not hers).
    const jade = (await get(c.jade)).body.person;
    expect(jade.episodes.map((e) => e.episode_number)).toEqual([2]);
  });

  test("the writers' preview is what the script writer's own blocks write about them", async () => {
    const { writers } = (await get(c.marcus)).body.person;
    expect(writers.in_cast_block).toBe(true);
    // Jade is his sister; he has no gender on file, so he is her sibling (familyTies reverseRole).
    expect(writers.family).toEqual([`Marcus Hale ${tag}: Jade Monroe ${tag}'s sibling`]);
    expect(writers.family_block).toMatch(/^THEIR FAMILY \(stay consistent with it\):\n- Marcus Hale/);
    expect(writers.lala).toEqual([
      expect.stringMatching(/^With Lala in the story: love interest.*\(They kiss in the stairwell\)$/),
      'With Lala: love interest: They kiss in the stairwell',
    ]);
    expect(writers.secrecy).toEqual(expect.arrayContaining([
      `Lala and Marcus Hale ${tag}'s romance is SECRET: only Jade Monroe ${tag} knows. Nobody else mentions it.`,
    ]));

    // The cast block, built as loadScriptContext builds its row for him.
    const [[row]] = await run('SELECT id, handle, platform, display_name, lala_relationship FROM social_profiles WHERE id = :id', { id: p.marcus });
    const ties = await lalaStoryTies(sequelize, [c.marcus]);
    const cast = { ...row, registry_character_id: c.marcus, ...lalaTieFields(row, ties.get(c.marcus)) };
    const romances = await sw.lalaRomances(sequelize, [c.marcus]);
    if (romances.has(c.marcus)) cast.lala_romance = romances.get(c.marcus);
    const blocks = sw.storyContextBlocks({ socialProfiles: [cast], familyLines: await familyLines(sequelize, [c.marcus]) });
    for (const line of writers.lala) expect(blocks).toContain(`\n  ${line}`);
    expect(blocks).toContain(writers.family_block);
    const secrecy = await sw.relationshipSecrecyBlock(sequelize, [c.marcus]);
    for (const line of writers.secrecy) expect(secrecy).toContain(`- ${line}`);
  });
});
