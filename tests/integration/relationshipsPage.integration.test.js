/**
 * The Relationships page's server (routes/relationships.js), against the
 * test database (2026-10-23 audit of /relationships): only confirmed, live
 * rows count as relationships; Delete marks the row deleted so its story so
 * far survives, and Undo brings it back; an edit clears what is sent empty;
 * the generators work on the cast and land seeds; GET /:id/events is the
 * story so far with each episode.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('the Relationships page (2026-10-23 audit)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), r1: uuid(), r2: uuid(), ep: uuid() };
  const c = {};
  const p = {};
  const rel = {};
  let admin;
  const auth = (req) => req.set('Authorization', `Bearer ${admin}`);

  const person = async (key, { reg, name, selected = null, profile = null }) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :selected, 'support', :profile, NOW(), NOW())`,
    { id: c[key], reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name, selected, profile });
  };
  const profile = async (key, status = 'finalized') => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', :status, NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, status });
    p[key] = row.id;
    return row.id;
  };
  const relate = async (key, a, b, fields = {}) => {
    rel[key] = uuid();
    const f = { type: 'friend', confirmed: true, romantic: false, family: null, situation: null, tension: null, notes: null, deleted: false, ...fields };
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role,
                 situation, tension_state, notes, deleted_at, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :romantic, :family, :situation, :tension, :notes,
                 CASE WHEN :deleted THEN NOW() ELSE NULL END, NOW(), NOW())`,
    { id: rel[key], a: c[a], b: c[b], ...f });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-relpage', email: 'evoni@relpage.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Rel ${tag}`, slug: `rel-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:r1, 'One', :show, NOW(), NOW()), (:r2, 'Two', :show, NOW(), NOW())", ids);
    await person('lala', { reg: ids.r1, name: 'Lala' });
    await person('marcus', { reg: ids.r1, name: `Truthville ${tag}`, selected: `Marcus Hale ${tag}`, profile: await profile('marcus') });
    await person('jade', { reg: ids.r1, name: `Jade ${tag}`, profile: await profile('jade') });
    await person('oldie', { reg: ids.r1, name: `Oldie ${tag}` }); // no feed profile: not cast
    await person('gone', { reg: ids.r1, name: `Gone ${tag}`, profile: await profile('gone', 'archived') });
    await person('dre', { reg: ids.r2, name: `Dre ${tag}`, profile: await profile('dre') }); // the other registry
    await person('sable', { reg: ids.r2, name: `Sable ${tag}`, profile: await profile('sable') });

    await relate('lm', 'lala', 'marcus', { type: 'love_interest', romantic: true, situation: 'Flirting at the rail' });
    await relate('lj', 'lala', 'jade', { type: 'best friend', situation: 'There since the first fit check', tension: 'calm', notes: 'keep' });
    await relate('ld', 'lala', 'dre', { type: 'collaborator' }); // split across registries
    await relate('seed', 'marcus', 'jade', { type: 'temptation', confirmed: false });
    await relate('old', 'lala', 'oldie', { type: 'mentor' });
    await relate('dead', 'jade', 'dre', { type: 'sister', family: 'sister', deleted: true });
    await relate('fam', 'jade', 'oldie', { type: 'siblings', family: 'sister' });
    await relate('badfam', 'jade', 'marcus', { type: 'ex', romantic: true, family: 'mother' });

    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 4, 'draft', NOW(), NOW())`, ids);
    const ev = (relId, stage, metadata, ago, deleted = false) => run(
      `INSERT INTO relationship_events (id, relationship_id, event_type, title, description, tension_before, tension_after, relationship_stage, metadata, created_at, updated_at, deleted_at)
       VALUES (gen_random_uuid(), :relId, 'escalation', :title, :desc, 2, 4, :stage, CAST(:metadata AS jsonb), NOW() - (:ago || ' minutes')::interval, NOW(), CASE WHEN :deleted THEN NOW() ELSE NULL END)`,
      { relId, stage, metadata: JSON.stringify(metadata), ago: String(ago), deleted, title: `Event ${stage}`, desc: `note ${stage}` });
    await ev(rel.lm, 'acquaintances', {}, 30);
    await ev(rel.lm, 'flirting', { episode_id: ids.ep, beat: 11, stage_before: 'acquaintances', quote: 'Same time next week?', source: 'record' }, 10);
    await ev(rel.lm, 'lovers', {}, 5, true); // a deleted event is not part of the story
    await ev(rel.lj, 'close_friends', {}, 20);
  });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all))', { all });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM character_registries WHERE id IN (:r1, :r2)', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => mockCreate.mockReset());

  test('GET /cast: the cast across registries, confirmed live pairs, seeds apart, one name each, the latest stage', async () => {
    const res = await auth(request(app).get('/api/v1/relationships/cast'));
    expect(res.status).toBe(200);
    const cast = res.body.characters.map((x) => x.id);
    expect(cast).toEqual(expect.arrayContaining([c.lala, c.marcus, c.jade, c.dre]));
    expect(cast).not.toContain(c.oldie);
    expect(cast).not.toContain(c.gone);
    expect(res.body.lala_id).toBe(c.lala);
    const relIds = res.body.relationships.map((r) => r.id);
    expect(relIds).toEqual(expect.arrayContaining([rel.lm, rel.lj, rel.ld, rel.badfam]));
    expect(relIds).not.toContain(rel.seed);
    expect(relIds).not.toContain(rel.old);
    expect(relIds).not.toContain(rel.dead);
    expect(res.body.candidates.map((r) => r.id)).toEqual([rel.seed]);
    const lm = res.body.relationships.find((r) => r.id === rel.lm);
    expect(lm.character_b_name).toBe(`Marcus Hale ${tag}`);
    expect(lm.character_b_display).toBe(`Truthville ${tag}`);
    expect(lm.stage).toBe('flirting');
  });

  test('GET /tree and /family-tree: only confirmed, live rows; a romantic row is never family', async () => {
    const tree = await auth(request(app).get(`/api/v1/relationships/tree/${ids.r1}`));
    expect(tree.status).toBe(200);
    const treeIds = tree.body.relationships.map((r) => r.id);
    expect(treeIds).toEqual(expect.arrayContaining([rel.lm, rel.lj, rel.old, rel.fam]));
    expect(treeIds).not.toContain(rel.seed);
    expect(tree.body.relationships.every((r) => r.confirmed)).toBe(true);

    const fam = await auth(request(app).get(`/api/v1/relationships/family-tree/${ids.r1}`));
    expect(fam.body.family_bonds.map((r) => r.id)).toEqual([rel.fam]);
    expect(fam.body.romantic_bonds.map((r) => r.id)).toEqual(expect.arrayContaining([rel.lm, rel.badfam]));

    const fam2 = await auth(request(app).get(`/api/v1/relationships/family-tree/${ids.r2}`));
    expect(fam2.body.family_bonds.map((r) => r.id)).not.toContain(rel.dead);

    const mine = await auth(request(app).get(`/api/v1/relationships/character/${c.jade}`));
    expect(mine.body.relationships.map((r) => r.id)).not.toContain(rel.dead);
    expect(mine.body.relationships.find((r) => r.id === rel.badfam).related_name).toBe(`Marcus Hale ${tag}`);
  });

  test('PUT /:id: a field sent empty is cleared, a field not sent stays; the type cannot be emptied', async () => {
    const res = await auth(request(app).put(`/api/v1/relationships/${rel.lj}`)).send({ situation: '', tension_state: null, connection_mode: '' });
    expect(res.status).toBe(200);
    expect(res.body.relationship).toMatchObject({ situation: null, tension_state: null, connection_mode: 'IRL', notes: 'keep', relationship_type: 'best friend' });
    const bad = await auth(request(app).put(`/api/v1/relationships/${rel.lj}`)).send({ relationship_type: '  ' });
    expect(bad.status).toBe(400);
    const set = await auth(request(app).put(`/api/v1/relationships/${rel.lj}`)).send({ situation: 'Back on', is_romantic: false });
    expect(set.body.relationship).toMatchObject({ situation: 'Back on', notes: 'keep', is_romantic: false });
    const none = await auth(request(app).put(`/api/v1/relationships/${uuid()}`)).send({ notes: 'x' });
    expect(none.status).toBe(404);
  });

  test('PUT /:id/family will not make a love interest family; a partner role it takes', async () => {
    const bad = await auth(request(app).put(`/api/v1/relationships/${rel.lm}/family`)).send({ family_role: 'mother' });
    expect(bad.status).toBe(400);
    const [row] = await q('SELECT family_role FROM character_relationships WHERE id = :id', { id: rel.lm });
    expect(row.family_role).toBeNull();
    const ok = await auth(request(app).put(`/api/v1/relationships/${rel.fam}/family`)).send({ family_role: 'cousin' });
    expect(ok.status).toBe(200);
    expect(ok.body.relationship.family_role).toBe('cousin');
  });

  test('DELETE marks the row deleted and keeps its story; Undo restores it; a new one of the same type revives it', async () => {
    const del = await auth(request(app).delete(`/api/v1/relationships/${rel.lj}`));
    expect(del.status).toBe(200);
    const [row] = await q('SELECT deleted_at FROM character_relationships WHERE id = :id', { id: rel.lj });
    expect(row.deleted_at).not.toBeNull();
    const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM relationship_events WHERE relationship_id = :id', { id: rel.lj });
    expect(n).toBe(1);
    const cast = await auth(request(app).get('/api/v1/relationships/cast'));
    expect(cast.body.relationships.map((r) => r.id)).not.toContain(rel.lj);
    expect((await auth(request(app).delete(`/api/v1/relationships/${rel.lj}`))).status).toBe(404);
    expect((await auth(request(app).get(`/api/v1/relationships/${rel.lj}/events`))).status).toBe(404);

    const undo = await auth(request(app).post(`/api/v1/relationships/${rel.lj}/restore`));
    expect(undo.status).toBe(200);
    expect(undo.body.relationship.id).toBe(rel.lj);
    expect((await auth(request(app).post(`/api/v1/relationships/${rel.lj}/restore`))).status).toBe(404);

    // Deleted, then made again by hand: the same row comes back (unique a, b, type).
    await auth(request(app).delete(`/api/v1/relationships/${rel.ld}`));
    const again = await auth(request(app).post('/api/v1/relationships')).send({ character_id_a: c.lala, character_id_b: c.dre, relationship_type: 'collaborator', situation: 'Shoot day' });
    expect(again.status).toBe(201);
    expect(again.body.relationship).toMatchObject({ id: rel.ld, situation: 'Shoot day', confirmed: true });
  });

  test('POST / takes a love interest as romantic', async () => {
    const res = await auth(request(app).post('/api/v1/relationships')).send({ character_id_a: c.dre, character_id_b: c.marcus, relationship_type: 'love_interest', is_romantic: true });
    expect(res.status).toBe(201);
    expect(res.body.relationship).toMatchObject({ relationship_type: 'love_interest', is_romantic: true, character_b_name: `Marcus Hale ${tag}` });
  });

  test('GET /:id/events: the story so far, oldest first, with the stage before, beat, quote and episode', async () => {
    const res = await auth(request(app).get(`/api/v1/relationships/${rel.lm}/events`));
    expect(res.status).toBe(200);
    expect(res.body.events.map((e) => e.relationship_stage)).toEqual(['acquaintances', 'flirting']);
    expect(res.body.events[1]).toMatchObject({
      stage_before: 'acquaintances', beat: 11, quote: 'Same time next week?', description: 'note flirting',
      tension_before: 2, tension_after: 4, episode_id: ids.ep, episode_number: 4, episode_title: 'The Gala',
    });
    expect(res.body.events[0]).toMatchObject({ episode_id: null, beat: null, quote: null });
    expect((await auth(request(app).get(`/api/v1/relationships/${uuid()}/events`))).status).toBe(404);
    expect((await request(app).get(`/api/v1/relationships/${rel.lm}/events`)).status).toBe(401);
  });

  test('POST /generate-family: seeds (unconfirmed), only between cast members', async () => {
    mockCreate.mockResolvedValue(reply({ family_bonds: [
      { character_a_id: c.jade, character_b_id: c.dre, family_role: 'cousin', is_blood_relation: true, relationship_type: 'cousins', conflict_summary: 'Old debt' },
      { character_a_id: c.lala, character_b_id: c.oldie, family_role: 'aunt', relationship_type: 'aunt' },
    ] }));
    const res = await auth(request(app).post('/api/v1/relationships/generate-family')).send({});
    expect(res.status).toBe(201);
    expect(res.body.family_bonds).toHaveLength(1);
    expect(res.body.family_bonds[0]).toMatchObject({ character_id_a: c.jade, character_id_b: c.dre, family_role: 'cousin', confirmed: false });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`Jade ${tag}`);
    expect(prompt).not.toContain(`Oldie ${tag}`);
    const rows = await q('SELECT confirmed FROM character_relationships WHERE character_id_a = :a AND character_id_b = :b AND deleted_at IS NULL', { a: c.lala, b: c.oldie });
    expect(rows.filter((r) => !r.confirmed)).toHaveLength(0);
  });

  test('POST /generate: the cast only, no cross-layer rule in the prompt, seeds land unconfirmed', async () => {
    mockCreate.mockResolvedValue(reply({ candidates: [
      { character_a_id: c.marcus, character_b_id: c.sable, relationship_type: 'rival', tension_state: 'simmering', situation: 'Same client' },
      { character_a_id: c.oldie, character_b_id: c.jade, relationship_type: 'mentor' },
    ] }));
    const res = await auth(request(app).post('/api/v1/relationships/generate')).send({ focus_character_id: c.marcus });
    expect(res.status).toBe(201);
    expect(res.body.candidates.map((x) => [x.character_id_a, x.character_id_b, x.confirmed])).toEqual([[c.marcus, c.sable, false]]);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toMatch(/cross-layer|can ONLY have relationships/i);
    expect(prompt).toContain(`Marcus Hale ${tag}`);
    expect(prompt).not.toContain(`Oldie ${tag}`);
  });
});
