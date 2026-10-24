/**
 * Relationship seeds (Evoni, 2026-10-24: "How can we improve relationship
 * seeds", then "I want them all"), against the test database:
 * - Generate is grounded on the story (the approved record, threads,
 *   twists, family, what she turned down), aimed by kind, an episode's
 *   guests or a twist; it keeps basis ids that exist, the page's types,
 *   and skips pairs by the skip rule, each with its reason;
 * - Confirm applies the Inspector's edits first, in one transaction: a
 *   family type becomes a family tie both ways, a romance on a non-spouse
 *   family role is refused, and the Pulse pair follows;
 * - Confirm all confirms each one alone and lists the refused;
 * - Keep as idea / Bring back; Dismiss with a reason ("too soon" puts it
 *   off for later, the others mark it deleted with the reason); Undo;
 * - POST /seeds takes the scene banner's and the Pulse's suggestions;
 * - GET /cast returns kept and later seeds with every new field;
 * - every write is ADMIN only.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const truth = require('../../src/services/relationshipTruth');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const api = '/api/v1/relationships';

(shouldSkip ? describe.skip : describe)('relationship seeds (2026-10-24)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep: uuid(), ep2: uuid(), thread: uuid(), twist: uuid(), event: uuid() };
  const c = {};
  const p = {};
  const rel = {};
  let admin;
  let viewer;
  // Each test writes from its own address, so the app's 60-writes-a-minute
  // limit (app.js writeLimiter) counts each test apart.
  let ip = 0;
  const from = (req) => req.set('X-Forwarded-For', `10.77.${ip}.1`);
  const auth = (req) => from(req).set('Authorization', `Bearer ${admin}`);
  const asViewer = (req) => from(req).set('Authorization', `Bearer ${viewer}`);
  const rowOf = async (id) => (await q('SELECT * FROM character_relationships WHERE id = :id', { id }))[0];
  const promptOf = (n = 0) => mockCreate.mock.calls[n][0].messages[0].content;

  const profile = async (key) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
    p[key] = row.id;
    return row.id;
  };
  const person = async (key, name, { withProfile = true, extra = null, gender = null } = {}) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, feed_profile_id, extra_fields, gender, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, 'support', :profile, CAST(:extra AS jsonb), :gender, NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name, profile: withProfile ? await profile(key) : null, extra: extra ? JSON.stringify(extra) : null, gender });
  };
  const relate = async (key, a, b, f = {}) => {
    rel[key] = uuid();
    const v = { type: 'friend', confirmed: true, romantic: false, family: null, deleted: false, reason: null, note: null, state: null, ...f };
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role,
                 dismiss_reason, dismiss_note, seed_state, deleted_at, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :romantic, :family, :reason, :note, :state,
                 CASE WHEN :deleted THEN NOW() ELSE NULL END, NOW(), NOW())`,
    { id: rel[key], a: c[a], b: c[b], ...v });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-seeds', email: 'evoni@seeds.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    viewer = TokenService.generateTokenPair({ id: 'test-viewer-seeds', email: 'viewer@seeds.dev', name: 'Viewer', groups: [], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Seeds ${tag}`, slug: `seeds-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Seeds', :show, NOW(), NOW())", ids);
    await person('lala', 'Lala');
    await person('marcus', `Marcus ${tag}`, { gender: 'male' });
    await person('jade', `Jade ${tag}`, { gender: 'female' });
    await person('dre', `Dre ${tag}`, { gender: 'male' });
    await person('sable', `Sable ${tag}`);
    await person('amara', `Amara ${tag}`, { extra: { classification: 'confidential_professional' } });
    await person('oldie', `Oldie ${tag}`, { withProfile: false });

    await relate('lm', 'lala', 'marcus', { type: 'love_interest', romantic: true });
    await relate('jd', 'jade', 'dre', { type: 'sister', family: 'sister' });
    await relate('wrong', 'marcus', 'sable', { type: 'friend', confirmed: false, deleted: true, reason: 'wrong_for_them', note: `never-${tag}` });
    await relate('ntt', 'dre', 'sable', { type: 'rival', confirmed: false, deleted: true, reason: 'not_this_type' });

    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 3, 'draft', NOW(), NOW()), (:ep2, :show, 'The Brunch', 4, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, relationships, threads, approved_at)
               VALUES (:ep, :show, 'approved', :what, CAST(:rels AS jsonb), CAST(:threads AS jsonb), NOW())`, {
      ...ids, what: `Lala wins the gala; GROUND-${tag} Marcus watches Jade.`,
      rels: JSON.stringify([{ a_name: 'Lala', b_name: `Marcus ${tag}`, type: 'love_interest', is_romantic: true, stage_before: 'acquaintances', stage_after: 'flirting', note: 'a look', keep: true }]),
      threads: JSON.stringify([{ title: `Who leaked it ${tag}`, keep: true }]),
    });
    await run("INSERT INTO show_story_threads (id, show_id, title, status, created_at, updated_at) VALUES (:thread, :show, :title, 'open', NOW(), NOW())",
      { ...ids, title: `Thread-${tag}` });
    await run(`INSERT INTO season_twists (id, show_id, title, description, plant_slot_id, status, character_ids)
               VALUES (:twist, :show, :title, 'She sold the list', gen_random_uuid(), 'planted', CAST(:chars AS jsonb))`,
    { ...ids, title: `Twist-${tag}`, chars: JSON.stringify([c.jade]) });
    await run(`INSERT INTO world_events (id, show_id, name, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Brunch', :ep2, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.sable }, { profile_id: p.dre }] } }) });
  });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all))', { all });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM season_twists WHERE id = :twist', ids);
    await run('DELETE FROM show_story_threads WHERE id = :thread', ids);
    await run('DELETE FROM episode_story_records WHERE episode_id = :ep', ids);
    await run('DELETE FROM episodes WHERE id IN (:ep, :ep2)', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => {
    mockCreate.mockReset();
    ip += 1;
  });

  test('Generate: grounded on the story, basis ids kept only when real, types normalised, each skip with its reason', async () => {
    mockCreate.mockResolvedValue(reply({ seeds: [
      { a: c.marcus, b: c.jade, relationship_type: 'emotional affair', is_romantic: false, situation: 'Late texts.', tension_state: 'simmering',
        seed_why: 'Episode 3 left them alone at the rail', basis: { episodes: [ids.ep, uuid()], threads: [ids.thread, 'made-up'], twists: [ids.twist], facts: ['He watched her'] } },
      { a: c.marcus, b: c.sable, relationship_type: 'mentor' },
      { a: c.dre, b: c.sable, relationship_type: 'rival' },
      { a: c.dre, b: c.sable, relationship_type: 'Mentor' },
      { a: c.lala, b: c.marcus, relationship_type: 'friend' },
      { a: c.jade, b: c.dre, relationship_type: 'love_interest', is_romantic: true },
      { a: c.amara, b: c.jade, relationship_type: 'mentor' },
      { a: c.lala, b: c.sable, relationship_type: 'keeper of keys' },
    ] }));
    const res = await auth(request(app).post(`${api}/generate`)).send({ count: 6 });
    expect(res.status).toBe(201);

    const prompt = promptOf();
    expect(prompt).toContain(`GROUND-${tag}`);
    expect(prompt).toContain(`[thread ${ids.thread}] Thread-${tag}`);
    expect(prompt).toContain(`[twist ${ids.twist}] Twist-${tag}`);
    expect(prompt).toContain(`[episode ${ids.ep}] Episode 3 "The Gala"`);
    expect(prompt).toContain(`Jade ${tag} is Dre ${tag}'s sister`);
    expect(prompt).toContain(`Marcus ${tag} and Sable ${tag} as friend: wrong for them ("never-${tag}")`);
    expect(prompt).toContain('No romance between family');
    expect(prompt).toContain('Suggest 6 NEW seeds');
    expect(prompt).not.toContain(`Amara ${tag}`);
    expect(prompt).not.toContain(`Oldie ${tag}`);

    expect(res.body.candidates.map((r) => [r.character_id_a, r.character_id_b, r.relationship_type])).toEqual([
      [c.marcus, c.jade, 'love_interest'],
      [c.dre, c.sable, 'mentor'],
    ]);
    const [first] = res.body.candidates;
    expect(first).toMatchObject({
      confirmed: false, is_romantic: true, seed_source: 'generate', situation: 'Emotional affair: Late texts.', tension_state: 'simmering',
      seed_why: 'Episode 3 left them alone at the rail', seed_state: null,
      seed_aim: { kind: 'any', focus_character_id: null, episode_id: null, twist_id: null },
    });
    expect(first.seed_basis).toEqual({
      episodes: [{ id: ids.ep, number: 3, title: 'The Gala' }],
      threads: [{ id: ids.thread, title: `Thread-${tag}` }],
      twists: [{ id: ids.twist, title: `Twist-${tag}` }],
      facts: ['He watched her'],
    });
    expect(res.body.skipped.map((s) => [s.index, s.code])).toEqual([
      [1, 'dismissed_wrong_for_them'], [2, 'dismissed_same_type'], [4, 'already_there'], [5, 'family_romance'], [6, 'not_in_cast'], [7, 'unknown_type'],
    ]);
    expect(res.body.skipped[0].why).toMatch(/wrong for them/);
    rel.gen1 = first.id;
    rel.gen2 = res.body.candidates[1].id;
  });

  test('Generate aimed at an episode (its guests), a twist, a focus and a kind; refuses a bad aim', async () => {
    mockCreate.mockResolvedValue(reply({ seeds: [
      { a: c.sable, b: c.jade, relationship_type: 'rival', basis: { twists: [ids.twist], episodes: [ids.ep2] } },
      { a: c.sable, b: c.lala, relationship_type: 'friend' },
    ] }));
    const res = await auth(request(app).post(`${api}/generate`)).send({ kind: 'rivals', episode_id: ids.ep2, twist_id: ids.twist, focus_character_id: c.sable, count: 3 });
    expect(res.status).toBe(201);
    const prompt = promptOf();
    expect(prompt).toContain('Kind: rivalries.');
    expect(prompt).toContain(`Built for [episode ${ids.ep2}] Episode 4 "The Brunch" (the event: Brunch)`);
    expect(prompt).toMatch(new RegExp(`its guests (Dre ${tag} \\[${c.dre}\\], Sable ${tag} \\[${c.sable}\\]|Sable ${tag} \\[${c.sable}\\], Dre ${tag} \\[${c.dre}\\])`));
    expect(prompt).toContain(`Built to pay off [twist ${ids.twist}] "Twist-${tag}"`);
    expect(prompt).toContain(`Every seed involves Sable ${tag}`);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0]).toMatchObject({
      relationship_type: 'rival',
      seed_aim: { kind: 'rivals', focus_character_id: c.sable, episode_id: ids.ep2, twist_id: ids.twist },
      seed_basis: { episodes: [{ id: ids.ep2, number: 4, title: 'The Brunch' }], twists: [{ id: ids.twist, title: `Twist-${tag}` }] },
    });
    expect(res.body.skipped.map((s) => s.code)).toEqual(['not_this_kind']);
    rel.aimed = res.body.candidates[0].id;

    expect((await auth(request(app).post(`${api}/generate`)).send({ episode_id: uuid() })).status).toBe(404);
    expect((await auth(request(app).post(`${api}/generate`)).send({ kind: 'enemies' })).status).toBe(400);
    expect((await auth(request(app).post(`${api}/generate`)).send({ focus_character_id: c.oldie })).status).toBe(400);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('Generate kind family (and Propose Family) saves family roles: both ways, the kind, source family', async () => {
    mockCreate.mockResolvedValue(reply({ seeds: [
      { a: c.marcus, b: c.dre, family_role: 'stepbrother', relationship_type: 'resentful stepbrother', conflict_summary: 'The will' },
    ] }));
    const res = await auth(request(app).post(`${api}/generate`)).send({ kind: 'family' });
    expect(res.status).toBe(201);
    expect(promptOf()).toContain('"family_role"');
    expect(res.body.candidates[0]).toMatchObject({
      relationship_type: 'family', family_role: 'stepbrother', reverse_family_role: 'stepsibling', family_kind: 'step',
      is_romantic: false, seed_source: 'family', conflict_summary: 'The will', confirmed: false,
    });
    rel.famSeed = res.body.candidates[0].id;

    mockCreate.mockResolvedValue(reply({ family_bonds: [{ character_a_id: c.marcus, character_b_id: c.dre, family_role: 'cousin' }] }));
    const fam = await auth(request(app).post(`${api}/generate-family`)).send({});
    expect(fam.status).toBe(201);
    expect(fam.body.family_bonds).toEqual([]);
    expect(fam.body.skipped.map((s) => s.code)).toEqual(['already_there']);
  });

  test('Confirm with edits: applied, then confirmed; the Pulse pair follows', async () => {
    const spy = jest.spyOn(truth, 'afterStorySave');
    const res = await auth(request(app).post(`${api}/confirm/${rel.gen2}`)).send({ situation: '  Edited  ', tension_state: 'volatile', connection_mode: 'Professional', notes: '' });
    expect(res.status).toBe(200);
    expect(res.body.relationship).toMatchObject({ id: rel.gen2, confirmed: true, situation: 'Edited', tension_state: 'volatile', connection_mode: 'Professional', notes: null, seed_state: null });
    expect(spy).toHaveBeenCalledWith(expect.anything(), rel.gen2);
    expect(res.body.pulse).toBeDefined();
    spy.mockRestore();
    expect((await auth(request(app).post(`${api}/confirm/${rel.gen1}`)).send({ tension_state: 'boiling' })).status).toBe(400);
    expect((await auth(request(app).post(`${api}/confirm/${uuid()}`)).send({})).status).toBe(404);
  });

  test('Confirm a family type: a family tie, both directions; a romance on a non-spouse family role is refused (409) and nothing changes', async () => {
    const made = await auth(request(app).post(`${api}/seeds`)).send({ source: 'manual', seeds: [{ character_id_a: c.jade, character_id_b: c.lala, relationship_type: 'friend' }] });
    const seedId = made.body.candidates[0].id;
    const bad = await auth(request(app).post(`${api}/confirm/${seedId}`)).send({ relationship_type: 'aunt', is_romantic: true, situation: 'should not stick' });
    expect(bad.status).toBe(409);
    expect(bad.body.error).toMatch(/family \(aunt\)/);
    expect(await rowOf(seedId)).toMatchObject({ confirmed: false, relationship_type: 'friend', situation: null, is_romantic: false });

    const spy = jest.spyOn(truth, 'afterStorySave');
    const ok = await auth(request(app).post(`${api}/confirm/${seedId}`)).send({ relationship_type: 'aunt' });
    expect(ok.status).toBe(200);
    expect(ok.body.family).toBe(true);
    expect(ok.body.relationship).toMatchObject({ id: seedId, confirmed: true, relationship_type: 'aunt', family_role: 'aunt', reverse_family_role: 'niece or nephew', family_kind: 'blood', is_romantic: false });
    expect(spy).toHaveBeenCalledWith(expect.anything(), seedId);
    spy.mockRestore();
    // The Pulse family link, both having profiles.
    const pulse = await q("SELECT relationship_type::text AS kind, character_relationship_id FROM social_profile_relationships WHERE relationship_type = 'family' AND ((source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a))", { a: p.jade, b: p.lala });
    expect(pulse).toEqual([{ kind: 'family', character_relationship_id: seedId }]);

    // A Propose-Family seed confirms as a tie too, read the other way from Dre's gender.
    const fam = await auth(request(app).post(`${api}/confirm/${rel.famSeed}`)).send({});
    expect(fam.status).toBe(200);
    expect(fam.body.relationship).toMatchObject({ confirmed: true, family_role: 'stepbrother', reverse_family_role: 'stepbrother', family_kind: 'step' });
  });

  test('Confirm all: each alone, the refused listed with why', async () => {
    const made = await auth(request(app).post(`${api}/seeds`)).send({ source: 'manual', seeds: [
      { character_id_a: c.lala, character_id_b: c.sable, relationship_type: 'collaborator' },
      { character_id_a: c.lala, character_id_b: c.dre, relationship_type: 'mentor' },
    ] });
    const [okId, badId] = made.body.candidates.map((r) => r.id);
    await run("UPDATE character_relationships SET family_role = 'mother', is_romantic = true WHERE id = :id", { id: badId });
    const missing = uuid();
    const res = await auth(request(app).post(`${api}/confirm-all`)).send({ ids: [okId, badId, missing] });
    expect(res.status).toBe(200);
    expect(res.body.confirmed.map((r) => [r.id, r.confirmed])).toEqual([[okId, true]]);
    expect(res.body.refused).toEqual([
      { id: badId, error: expect.stringMatching(/family \(mother\)/) },
      { id: missing, error: 'Relationship not found' },
    ]);
    expect((await rowOf(badId)).confirmed).toBe(false);
    expect((await auth(request(app).post(`${api}/confirm-all`)).send({ ids: Array.from({ length: 51 }, uuid) })).status).toBe(400);
    expect((await auth(request(app).post(`${api}/confirm-all`)).send({})).status).toBe(400);
    rel.badFamily = badId;
  });

  test('Keep as idea and Bring back; a confirmed row is refused; /cast returns kept and later with every field', async () => {
    const kept = await auth(request(app).post(`${api}/${rel.gen1}/seed-state`)).send({ state: 'kept' });
    expect(kept.status).toBe(200);
    expect(kept.body.relationship).toMatchObject({ id: rel.gen1, seed_state: 'kept', confirmed: false });

    const later = await auth(request(app).delete(`${api}/dismiss/${rel.aimed}`)).send({ reason: 'too_soon', note: 'after the finale' });
    expect(later.status).toBe(200);
    expect(later.body).toMatchObject({ later: true, relationship: { id: rel.aimed, seed_state: 'later', dismiss_reason: 'too_soon', dismiss_note: 'after the finale' } });
    expect((await rowOf(rel.aimed)).deleted_at).toBeNull();

    const cast = await auth(request(app).get(`${api}/cast`));
    expect(cast.status).toBe(200);
    const byId = new Map(cast.body.candidates.map((r) => [r.id, r]));
    expect(byId.get(rel.gen1)).toMatchObject({ seed_state: 'kept', seed_source: 'generate', seed_why: expect.any(String), seed_basis: expect.any(Object), seed_aim: expect.any(Object), dismiss_reason: null, dismiss_note: null });
    expect(byId.get(rel.aimed)).toMatchObject({ seed_state: 'later', dismiss_reason: 'too_soon' });

    const back = await auth(request(app).post(`${api}/${rel.gen1}/seed-state`)).send({ state: null });
    expect(back.body.relationship.seed_state).toBeNull();
    expect((await auth(request(app).post(`${api}/${rel.gen2}/seed-state`)).send({ state: 'kept' })).status).toBe(409);
    expect((await auth(request(app).post(`${api}/${rel.gen1}/seed-state`)).send({ state: 'later' })).status).toBe(400);
    expect((await auth(request(app).post(`${api}/${rel.gen1}/seed-state`)).send({})).status).toBe(400);
    expect((await auth(request(app).post(`${api}/${uuid()}/seed-state`)).send({ state: 'kept' })).status).toBe(404);
  });

  test('Restore brings a later seed back, cleared', async () => {
    const res = await auth(request(app).post(`${api}/${rel.aimed}/restore`));
    expect(res.status).toBe(200);
    expect(res.body.relationship).toMatchObject({ id: rel.aimed, seed_state: null, dismiss_reason: null, dismiss_note: null, confirmed: false });
    expect((await auth(request(app).post(`${api}/${rel.aimed}/restore`))).status).toBe(404);
  });

  test.each(['wrong_for_them', 'already_covered', 'not_this_type', 'other'])('Dismiss as %s: marked deleted with the reason and note; Undo clears them', async (reason) => {
    const made = await auth(request(app).post(`${api}/seeds`)).send({ source: 'manual', seeds: [{ character_id_a: c.oldie, character_id_b: c.amara, relationship_type: `rival` }] });
    expect(made.status).toBe(201);
    const id = made.body.candidates[0].id;
    const res = await auth(request(app).delete(`${api}/dismiss/${id}`)).send({ reason, note: `why ${reason}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dismissed: true });
    const row = await rowOf(id);
    expect(row.deleted_at).not.toBeNull();
    expect(row).toMatchObject({ dismiss_reason: reason, dismiss_note: `why ${reason}`, confirmed: false });
    const undo = await auth(request(app).post(`${api}/${id}/restore`));
    expect(undo.body.relationship).toMatchObject({ id, dismiss_reason: null, dismiss_note: null, seed_state: null });
    await run('DELETE FROM character_relationships WHERE id = :id', { id });
  });

  test('Dismiss refuses an unknown reason and a confirmed relationship', async () => {
    expect((await auth(request(app).delete(`${api}/dismiss/${rel.gen1}`)).send({ reason: 'meh' })).status).toBe(400);
    expect((await auth(request(app).delete(`${api}/dismiss/${rel.gen2}`)).send({ reason: 'other' })).status).toBe(400);
    expect((await rowOf(rel.gen1)).deleted_at).toBeNull();
  });

  test('POST /seeds from the scene banner and the Pulse: made as seeds, the rest skipped with why', async () => {
    const scene = await auth(request(app).post(`${api}/seeds`)).send({ source: 'scene', seeds: [
      { character_id_a: c.oldie, character_id_b: c.jade, relationship_type: 'confidant', situation: 'Shared a cab', seed_why: 'Scene: the cab ride',
        seed_basis: { episodes: [{ id: ids.ep, number: 3, title: 'The Gala' }, { id: 'bad' }], facts: ['They talked'] } },
      { character_id_a: c.jade, character_id_b: c.jade, relationship_type: 'friend' },
      { character_id_a: c.jade, character_id_b: uuid(), relationship_type: 'friend' },
      { character_id_a: c.marcus, character_id_b: c.lala, relationship_type: 'rival' },
      { character_id_a: c.jade, character_id_b: c.oldie, relationship_type: 'rival' },
      { character_id_a: c.oldie, character_id_b: c.marcus, relationship_type: 'brother', is_romantic: true },
      { character_id_a: c.marcus, character_id_b: c.sable, relationship_type: 'collaborator' },
    ] });
    expect(scene.status).toBe(201);
    expect(scene.body.candidates.map((r) => [r.character_id_a, r.relationship_type, r.seed_source])).toEqual([[c.oldie, 'friend', 'scene']]);
    expect(scene.body.candidates[0]).toMatchObject({ seed_why: 'Scene: the cab ride', situation: 'Shared a cab', seed_basis: { episodes: [{ id: ids.ep, number: 3, title: 'The Gala' }], facts: ['They talked'] } });
    expect(scene.body.skipped.map((s) => [s.index, s.code])).toEqual([
      [1, 'same_person'], [2, 'not_found'], [3, 'already_there'], [4, 'duplicate'], [5, 'family_romance'], [6, 'dismissed_wrong_for_them'],
    ]);
    expect(scene.body.skipped.every((s) => typeof s.why === 'string' && s.why)).toBe(true);

    const pulse = await auth(request(app).post(`${api}/seeds`)).send({ source: 'pulse', seeds: [{ character_id_a: c.sable, character_id_b: c.amara, relationship_type: 'bestie' }] });
    expect(pulse.status).toBe(201);
    expect(pulse.body.candidates[0]).toMatchObject({ relationship_type: 'best friend', seed_source: 'pulse', confirmed: false });

    expect((await auth(request(app).post(`${api}/seeds`)).send({ source: 'generate', seeds: [{}] })).status).toBe(400);
    expect((await auth(request(app).post(`${api}/seeds`)).send({ source: 'scene', seeds: [] })).status).toBe(400);
    expect((await auth(request(app).post(`${api}/seeds`)).send({ source: 'scene', seeds: Array.from({ length: 21 }, () => ({})) })).status).toBe(400);
  });

  test('Generate answers an AI failure the way it always did', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('AI daily budget exceeded'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const res = await auth(request(app).post(`${api}/generate`)).send({});
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }] });
    expect((await auth(request(app).post(`${api}/generate`)).send({})).status).toBe(500);
  });

  test('every write is ADMIN only', async () => {
    const writes = [
      ['post', `${api}/generate`], ['post', `${api}/generate-family`], ['post', `${api}/confirm/${rel.gen1}`],
      ['post', `${api}/confirm-all`], ['post', `${api}/${rel.gen1}/seed-state`], ['delete', `${api}/dismiss/${rel.gen1}`],
      ['post', `${api}/${rel.gen1}/restore`], ['post', `${api}/seeds`],
    ];
    for (const [method, url] of writes) {
      expect((await asViewer(request(app)[method](url)).send({ state: 'kept', ids: [rel.gen1], source: 'manual', seeds: [{}] })).status).toBe(403);
      expect((await from(request(app)[method](url)).send({})).status).toBe(401);
    }
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await rowOf(rel.gen1)).toMatchObject({ confirmed: false, seed_state: null, deleted_at: null });
  });
});
