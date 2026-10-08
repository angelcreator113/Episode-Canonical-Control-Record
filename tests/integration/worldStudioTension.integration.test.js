/**
 * Relationships live in one place: character_relationships, the table the
 * Relationships page edits (Evoni's ruling, 2026-10-08; wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md §4, fix-list item 23).
 *
 * The tension scanner (the State tab's Tensions and the hub Overview's idea)
 * read World Studio's relationship_graph, which only World Studio's own form
 * wrote, always as Stable; the Relationships page's table was read by the
 * temperature and /world/tension-check, never by the scanner. Now:
 *   - the scanner and the context summary read the table's confirmed rows;
 *     simmering, volatile and fractured are high;
 *   - World Studio's form writes a confirmed row between the two characters'
 *     registry twins, and its list, edit and remove work on the table;
 *   - a character's old graph entries are listed as legacy and can be
 *     removed, not edited; the character editor no longer writes the graph.
 *
 * Database: the local migrated test DB. Earlier versions of this file (fix-
 * list item 10) pinned the graph scanner, which this ruling retires.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const uuid = () => crypto.randomUUID();

(shouldSkip ? describe.skip : describe)('relationships: character_relationships is the one store', () => {
  let token;
  const registry = uuid();
  // World Studio characters and their registry twins; "loner" has no twin.
  const w = { sable: uuid(), nia: uuid(), rex: uuid(), mira: uuid(), loner: uuid() };
  const r = { sable: uuid(), nia: uuid(), rex: uuid(), mira: uuid() };
  const legacyRel = uuid();
  const rel = { volatile: uuid(), calm: uuid(), candidate: uuid() };

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const scan = () => auth(request(app).get('/api/v1/world/tension-scanner'));
  const ourPairs = (body) => body.pairs.filter((p) => Object.values(r).includes(p.char_a.id));

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-rel-store', email: 'test@rel-store.dev', name: 'Relationship Store Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registry, 'Relationship store test', NOW(), NOW())`, { registry });
    const people = [
      ['sable', 'Rel Test Sable', 'Sable Vale'], ['nia', 'Rel Test Nia', null],
      ['rex', 'Rel Test Rex', null], ['mira', 'Rel Test Mira', null],
    ];
    for (const [k, name, selected] of people) {
      await run(`INSERT INTO world_characters (id, name, character_type, status, world_tag, relationship_graph, created_at, updated_at)
                 VALUES (:id, :name, 'pressure', 'active', 'lalaverse', '[]'::jsonb, NOW(), NOW())`, { id: w[k], name });
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, world_character_id, created_at, updated_at)
                 VALUES (:id, :registry, :key, :name, :selected, :world, NOW(), NOW())`,
      { id: r[k], registry, key: `rel_test_${k}_${r[k].slice(0, 8)}`, name, selected, world: w[k] });
      await run(`UPDATE world_characters SET registry_character_id = :rc WHERE id = :id`, { rc: r[k], id: w[k] });
    }
    await run(`INSERT INTO world_characters (id, name, character_type, status, relationship_graph, created_at, updated_at)
               VALUES (:id, 'Rel Test Loner', 'pressure', 'active', '[]'::jsonb, NOW(), NOW())`, { id: w.loner });
    // An old World Studio graph entry, with a tension the scanner used to read.
    await run(`UPDATE world_characters SET relationship_graph = :g::jsonb WHERE id = :id`, {
      id: w.mira,
      g: JSON.stringify([{ rel_id: legacyRel, character_id: w.rex, character_name: 'Rel Test Rex', related_character_name: 'Rel Test Rex', relationship_type: 'rival', tension_state: 'Explosive' }]),
    });
    const insertRel = (id, a, b, type, tension, confirmed, extra = '') => run(
      `INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, connection_mode, lala_connection, status, tension_state, confirmed, conflict_summary, created_at, updated_at)
       VALUES (:id, :a, :b, :type, 'IRL', 'none', 'Active', :tension, :confirmed, :extra, NOW(), NOW())`,
      { id, a, b, type, tension, confirmed, extra: extra || null });
    await insertRel(rel.volatile, r.sable, r.nia, 'Rival', 'volatile', true, 'Both want the Avenue window.');
    await insertRel(rel.calm, r.sable, r.rex, 'Friend', 'calm', true);
    await insertRel(rel.candidate, r.nia, r.rex, 'Ex', 'simmering', false);
  });

  afterAll(async () => {
    const rcs = Object.values(r);
    await run(`DELETE FROM character_relationships WHERE character_id_a IN (:rcs) OR character_id_b IN (:rcs)`, { rcs });
    await run(`DELETE FROM registry_characters WHERE id IN (:rcs)`, { rcs });
    await run(`DELETE FROM character_registries WHERE id = :registry`, { registry });
    await run(`DELETE FROM world_characters WHERE id IN (:ws)`, { ws: Object.values(w) });
  });

  it('the scanner reads confirmed table rows: volatile is high, calm and candidates are not, and the old graph is not read', async () => {
    const res = await scan();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    const pairs = ourPairs(res.body);
    expect(pairs).toEqual([{
      relationship_id: rel.volatile,
      char_a: { id: r.sable, name: 'Sable Vale', world_tag: 'lalaverse' },
      char_b: { id: r.nia, name: 'Rel Test Nia' },
      tension_state: 'volatile', relationship_type: 'Rival', conflict_summary: 'Both want the Avenue window.', romantic: false,
    }]);
    // Mira's old Explosive graph entry is not a tension any more.
    expect(JSON.stringify(res.body.pairs)).not.toContain('Rel Test Mira');
    // Sable, Nia and Rex are in confirmed relationships (the candidate does not count).
    expect(res.body.characters_scanned).toBeGreaterThanOrEqual(3);
  });

  it('the context summary counts the same pairs', async () => {
    const [scanRes, summary] = await Promise.all([scan(), auth(request(app).get('/api/v1/world/context-summary'))]);
    expect(summary.status).toBe(200);
    expect(summary.body.tensionCount).toBe(scanRes.body.count);
  });

  it("World Studio's form writes one confirmed row between the registry twins, and nothing to the graph", async () => {
    const add = await auth(request(app).post(`/api/v1/world/characters/${w.rex}/relationships`)).send({
      related_character_id: w.mira, relationship_type: 'rivalry', tension_state: 'fractured',
      current_status: 'complicated', history_summary: 'They split the studio.', conflict_summary: 'Who keeps the name.',
      is_romantic: true, family_role: '',
    });
    expect(add.status).toBe(201);
    expect(add.body.relationship).toMatchObject({
      registry_character_id: r.mira, related_character_id: w.mira, character_name: 'Rel Test Mira',
      relationship_type: 'rivalry', tension_state: 'fractured', current_status: 'Complicated',
      history_summary: 'They split the studio.', conflict_summary: 'Who keeps the name.', is_romantic: true, confirmed: true,
    });
    const [row] = await q(`SELECT * FROM character_relationships WHERE id = :id`, { id: add.body.relationship.rel_id });
    expect(row).toMatchObject({ character_id_a: r.rex, character_id_b: r.mira, confirmed: true, status: 'Complicated', situation: 'They split the studio.', family_role: null });
    const [{ relationship_graph: graph }] = await q(`SELECT relationship_graph FROM world_characters WHERE id = :id`, { id: w.rex });
    expect(graph).toEqual([]);
    // It is a tension now: fractured is high.
    const pair = ourPairs((await scan()).body).find((p) => p.relationship_id === add.body.relationship.rel_id);
    expect(pair).toMatchObject({ char_a: { id: r.rex }, char_b: { id: r.mira, name: 'Rel Test Mira' }, tension_state: 'fractured', romantic: true });
  });

  it('the form refuses what the table cannot hold', async () => {
    const post = (from, body) => auth(request(app).post(`/api/v1/world/characters/${from}/relationships`)).send(body);
    expect((await post(w.sable, { relationship_type: 'friendship' })).status).toBe(400);
    expect((await post(w.sable, { related_character_id: w.sable, relationship_type: 'friendship' })).status).toBe(400);
    const loner = await post(w.sable, { related_character_id: w.loner, relationship_type: 'friendship' });
    expect(loner.status).toBe(409);
    expect(loner.body.error).toContain('Rel Test Loner is not in the Character Registry');
    // The Relationships page's rule: one relationship of a type per pair.
    const again = await post(w.nia, { related_character_id: w.sable, relationship_type: 'Rival' });
    expect(again.status).toBe(409);
    expect(again.body.relationship_id).toBe(rel.volatile);
  });

  it("a character's relationships: the table's, candidates marked, then the old graph's, marked legacy", async () => {
    const nia = await auth(request(app).get(`/api/v1/world/characters/${w.nia}/relationships`));
    expect(nia.status).toBe(200);
    expect(nia.body.in_registry).toBe(true);
    expect(nia.body.relationships.map((x) => [x.character_name, x.confirmed])).toEqual([['Sable Vale', true], ['Rel Test Rex', false]]);
    expect(nia.body.legacy).toEqual([]);
    const mira = await auth(request(app).get(`/api/v1/world/characters/${w.mira}/relationships`));
    expect(mira.body.legacy).toEqual([expect.objectContaining({ rel_id: legacyRel, character_name: 'Rel Test Rex', legacy: true })]);
    const loner = await auth(request(app).get(`/api/v1/world/characters/${w.loner}/relationships`));
    expect(loner.body).toEqual({ relationships: [], legacy: [], in_registry: false });
  });

  it('the character list carries each character its table relationships', async () => {
    const res = await auth(request(app).get('/api/v1/world/characters?world_tag=lalaverse'));
    expect(res.status).toBe(200);
    const sable = res.body.characters.find((c) => c.id === w.sable);
    expect(sable.relationships).toEqual([
      { character_name: 'Rel Test Nia', relationship_type: 'Rival', confirmed: true },
      { character_name: 'Rel Test Rex', relationship_type: 'Friend', confirmed: true },
    ]);
  });

  it('edit changes the table row; an old graph entry cannot be edited', async () => {
    const put = await auth(request(app).put(`/api/v1/world/characters/${w.sable}/relationships/${rel.calm}`)).send({ tension_state: 'simmering', conflict_summary: 'The launch date.' });
    expect(put.status).toBe(200);
    expect(put.body.relationship).toMatchObject({ rel_id: rel.calm, tension_state: 'simmering', conflict_summary: 'The launch date.' });
    expect(ourPairs((await scan()).body).map((p) => p.relationship_id)).toContain(rel.calm);
    const legacy = await auth(request(app).put(`/api/v1/world/characters/${w.mira}/relationships/${legacyRel}`)).send({ tension_state: 'calm' });
    expect(legacy.status).toBe(409);
    expect((await auth(request(app).put(`/api/v1/world/characters/${w.sable}/relationships/${rel.candidate}`)).send({ notes: 'x' })).status).toBe(404);
  });

  it('remove deletes the table row, or the old graph entry', async () => {
    const del = await auth(request(app).delete(`/api/v1/world/characters/${w.sable}/relationships/${rel.calm}`));
    expect(del.body).toEqual({ deleted: true });
    expect(await q(`SELECT id FROM character_relationships WHERE id = :id`, { id: rel.calm })).toEqual([]);
    const old = await auth(request(app).delete(`/api/v1/world/characters/${w.mira}/relationships/${legacyRel}`));
    expect(old.body).toEqual({ deleted: true, legacy: true });
    const [{ relationship_graph: graph }] = await q(`SELECT relationship_graph FROM world_characters WHERE id = :id`, { id: w.mira });
    expect(graph).toEqual([]);
  });

  it('saving a character no longer writes its graph', async () => {
    await run(`UPDATE world_characters SET relationship_graph = :g::jsonb WHERE id = :id`, { id: w.nia, g: JSON.stringify([{ rel_id: 'keep', character_name: 'X' }]) });
    const res = await auth(request(app).put(`/api/v1/world/characters/${w.nia}`)).send({ occupation: 'Stylist', relationship_graph: [] });
    expect(res.status).toBe(200);
    const [{ relationship_graph: graph, occupation }] = await q(`SELECT relationship_graph, occupation FROM world_characters WHERE id = :id`, { id: w.nia });
    expect(occupation).toBe('Stylist');
    expect(graph).toEqual([{ rel_id: 'keep', character_name: 'X' }]);
  });

  it("create-story-task names the character's confirmed relationships", async () => {
    const res = await auth(request(app).post('/api/v1/world/create-story-task')).send({ character_id: w.sable });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toContain('Rel Test Sable');
    expect(res.body.task.key_relationships).toBe('Rel Test Nia (Rival)');
  });
});
