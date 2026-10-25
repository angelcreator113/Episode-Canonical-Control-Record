/**
 * Companies in relationships (Evoni, 2026-10-24: "I'm pretty sure this is a
 * brand in lalaverse how should we handle relationships between brands?";
 * then "I want them all and show me first"). Against the test database,
 * through the routes:
 *   - a registry character is marked as a company and unmarked
 *     (PUT /companies/:slug/registry-character, ADMIN), and its profile names it
 *   - a romance or family with a company is refused (409) at POST, PUT,
 *     PUT /family, Confirm, the type tidy-up, Add a seed and Generate; a
 *     company type is saved, never romantic, and makes no personal Pulse tie
 *   - a season need with a company in it is there by a deal, by a
 *     representative, or by a confirmed company relationship; a need
 *     between two people is unaffected; "the" names nobody
 *   - the family tree and its writes refuse a company; the heritage check
 *     and its gaps leave it out
 *   - the look-alike finder lists characters that look like companies
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('companies in relationships', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), column: uuid(), velour: uuid(), other: uuid(), deal: uuid() };
  const c = {};
  const p = {};
  const name = {};
  const slot = {};
  const co = { column: { slug: `the_column_${tag}`, name: `The Column ${tag}` }, velour: { slug: `velour_x_${tag}`, name: `Velour X ${tag}` }, other: { slug: `other_${tag}`, name: `Other Co ${tag}` } };
  let admin;
  let user;
  let ip = 0;
  const from = (req) => req.set('X-Forwarded-For', `10.89.${ip}.1`);
  const auth = (req, token = admin) => from(req).set('Authorization', `Bearer ${token}`);
  const api = '/api/v1/relationships';

  const person = async (key, display, { profile = true, extra = null } = {}) => {
    c[key] = uuid();
    name[key] = display;
    let profileId = null;
    if (profile) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
      profileId = row.id;
      p[key] = row.id;
    }
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, feed_profile_id, extra_fields, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, 'support', :profile, CAST(:extra AS jsonb), NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name: display, profile: profileId, extra: extra ? JSON.stringify(extra) : null });
  };
  const relate = async (a, b, f = {}) => {
    const id = uuid();
    const v = { type: 'friend', confirmed: true, romantic: false, role: null, kind: null, ...f };
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role, family_kind,
                 is_blood_relation, seed_source, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :romantic, :role, :kind, :blood, CASE WHEN :confirmed THEN NULL ELSE 'generate' END, NOW(), NOW())`,
    { id, a: c[a], b: c[b], ...v, blood: v.kind === 'blood' });
    return id;
  };
  const purpose = (n, text) => run(
    `UPDATE season_slots SET story_purpose = :text, story_purposes = CAST(:purposes AS jsonb), intention_source = 'auto-drafted' WHERE id = :id`,
    { id: slot[n], text, purposes: JSON.stringify([{ text, primary: true, source: 'auto-drafted' }]) });
  const link = (slug, characterId, token = admin) => auth(request(app).put(`/api/v1/companies/${slug}/registry-character`), token).send({ character_id: characterId });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-corel', email: 'evoni@corel.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-corel', email: 'user@corel.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Corel ${tag}`, slug: `corel-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Corel', :show, NOW(), NOW())", ids);
    for (const [key, kind] of [['column', 'outlet'], ['velour', 'brand'], ['other', 'brand']]) {
      await run(`INSERT INTO lalaverse_brands (id, slug, name, kind, type, created_at, updated_at) VALUES (:id, :slug, :name, :kind, 'lalaverse', NOW(), NOW())`,
        { id: ids[key], slug: co[key].slug, name: co[key].name, kind });
    }
    await person('lala', 'Lala');
    await person('col', co.column.name);
    await person('rep', `Reyna ${tag} Voss`, { extra: { brand_id: ids.column } });
    await person('marcus', `Marcus ${tag}`);
    await person('dre', `Dre ${tag}`);
    // Look-alikes, not linked.
    await person('velchar', co.velour.name, { profile: false });
    await person('studio', `Studio Nine ${tag}`, { profile: false });
    await person('weekly', `The Weekly ${tag}`, { profile: false });
    await seedArc(ids.show, models);
    const rows = await q('SELECT id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) slot[r.slot_number] = r.id;
  });

  beforeEach(() => { mockCreate.mockReset(); ip += 1; });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all))', { all });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM family_members WHERE registry_character_id IN (:all)', { all });
    await run('DELETE FROM opportunities WHERE show_id = :show', ids);
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id = :show`, ids).catch((err) => console.error('cleanup:', err.message));
    await run('DELETE FROM registry_characters WHERE id IN (:all) OR registry_id = :reg', { all, reg: ids.reg });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM lalaverse_brands WHERE slug LIKE :like', { like: `%${tag}%` });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const extraOf = async (key) => (await q('SELECT extra_fields FROM registry_characters WHERE id = :id', { id: c[key] }))[0].extra_fields || {};

  it('marks a registry character as a company, and unmarks it (ADMIN only)', async () => {
    expect((await link(co.column.slug, c.col, user)).status).toBe(403);
    expect((await auth(request(app).put(`/api/v1/companies/${co.column.slug}/registry-character`)).send({})).status).toBe(400);
    expect((await link(co.column.slug, 'nope')).status).toBe(400);
    expect((await link('no_such_company', c.col)).status).toBe(404);

    const done = await link(co.column.slug, c.col);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ character: { id: c.col, name: co.column.name }, conflicts: [] });
    expect((await extraOf('col')).company_id).toBe(ids.column);
    // Not brand_id: the representative keeps hers.
    expect((await extraOf('rep')).brand_id).toBe(ids.column);
    const profile = await auth(request(app).get(`/api/v1/companies/${co.column.slug}`), user);
    expect(profile.body.registry_character).toEqual({ id: c.col, name: co.column.name });

    // One character per company, one company per character.
    expect((await link(co.column.slug, c.weekly)).status).toBe(409);
    expect((await link(co.other.slug, c.col)).status).toBe(409);

    expect((await link(co.column.slug, null)).status).toBe(200);
    expect((await extraOf('col')).company_id).toBeUndefined();
    expect((await link(co.column.slug, c.col)).status).toBe(200);
  });

  it('the cast and every pair row say which side is a company', async () => {
    const cast = await auth(request(app).get(`${api}/cast`));
    expect(cast.status).toBe(200);
    expect(cast.body.characters.find((x) => x.id === c.col).company).toMatchObject({ id: ids.column, slug: co.column.slug, name: co.column.name, kind: 'outlet' });
    expect(cast.body.characters.find((x) => x.id === c.lala).company).toBeNull();
  });

  it('POST refuses a romance or a family with a company; a company type is saved, not romantic, with no Pulse tie', async () => {
    const post = (body) => auth(request(app).post(api)).send({ character_id_a: c.lala, character_id_b: c.col, ...body });
    const romance = await post({ relationship_type: 'love_interest', is_romantic: true });
    expect(romance.status).toBe(409);
    expect(romance.body.error).toMatch(/is a company/);
    expect((await post({ relationship_type: 'sister' })).status).toBe(409);
    expect((await post({ relationship_type: 'family' })).status).toBe(409);
    expect((await post({ relationship_type: 'friend', is_romantic: true })).status).toBe(409);

    const ok = await post({ relationship_type: 'sponsor' });
    expect(ok.status).toBe(201);
    expect(ok.body.relationship).toMatchObject({ relationship_type: 'sponsor', is_romantic: false, character_b_company: { slug: co.column.slug } });
    expect(ok.body.pulse.skipped).toMatch(/company/);
    expect(await q('SELECT id FROM social_profile_relationships WHERE character_relationship_id = :id', { id: ok.body.relationship.id })).toHaveLength(0);
    ids.sponsorRel = ok.body.relationship.id;
  });

  it('PUT and PUT /family refuse a romance or family on a company pair', async () => {
    const put = (body) => auth(request(app).put(`${api}/${ids.sponsorRel}`)).send(body);
    expect((await put({ relationship_type: 'love_interest' })).status).toBe(409);
    expect((await put({ is_romantic: true })).status).toBe(409);
    expect((await put({ relationship_type: 'mother' })).status).toBe(409);
    const ok = await put({ relationship_type: 'press', situation: 'It reviews her looks.' });
    expect(ok.status).toBe(200);
    expect(ok.body.relationship).toMatchObject({ relationship_type: 'press', is_romantic: false });
    const fam = await auth(request(app).put(`${api}/${ids.sponsorRel}/family`)).send({ family_role: 'mother' });
    expect(fam.status).toBe(409);
    expect(fam.body.error).toMatch(/no family/);
  });

  it('Confirm refuses a romance seed with a company, and confirms it as a company type', async () => {
    const seed = await relate('marcus', 'col', { type: 'love_interest', confirmed: false, romantic: true });
    const refused = await auth(request(app).post(`${api}/confirm/${seed}`)).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/is a company/);
    const done = await auth(request(app).post(`${api}/confirm/${seed}`)).send({ relationship_type: 'client_partner', is_romantic: false });
    expect(done.status).toBe(200);
    expect(done.body.relationship).toMatchObject({ confirmed: true, relationship_type: 'client_partner', is_romantic: false });
    ids.marcusCol = seed;
  });

  it('the type tidy-up offers company types for a company pair and refuses a romance or family', async () => {
    const rel = await relate('dre', 'col', { type: 'collaborator' });
    const list = await auth(request(app).get(`${api}/type-tidy`));
    const item = list.body.items.find((x) => x.id === rel);
    expect(item).toMatchObject({ company: true, brand_pair: false, proposed_type: 'client_partner', proposed_is_romantic: false });
    const tidy = (changes) => auth(request(app).post(`${api}/type-tidy`)).send({ changes });
    const refused = await tidy([{ id: rel, relationship_type: 'love_interest', is_romantic: true }]);
    expect(refused.body.refused[0].error).toMatch(/romance/);
    expect((await tidy([{ id: rel, relationship_type: 'sister' }])).body.refused[0].error).toMatch(/no family/);
    expect((await tidy([{ id: rel, relationship_type: 'rival' }])).body.refused[0].error).toMatch(/not a type for a company/);
    const done = await tidy([{ id: rel, relationship_type: 'client_partner' }]);
    expect(done.body.updated).toEqual([rel]);
    const [row] = await q('SELECT relationship_type, is_romantic FROM character_relationships WHERE id = :id', { id: rel });
    expect(row).toEqual({ relationship_type: 'client_partner', is_romantic: false });
    await run('DELETE FROM character_relationships WHERE id = :id', { id: rel });
  });

  it('Add a seed skips a romance with a company and adds a company type', async () => {
    const add = (seed) => auth(request(app).post(`${api}/seeds`)).send({ source: 'manual', seeds: [{ character_id_a: c.dre, character_id_b: c.col, ...seed }] });
    const romance = await add({ relationship_type: 'love_interest', is_romantic: true });
    expect(romance.status).toBe(201);
    expect(romance.body.skipped[0].code).toBe('company_type');
    const ok = await add({ relationship_type: 'fan' });
    expect(ok.body.candidates[0]).toMatchObject({ relationship_type: 'fan', is_romantic: false, confirmed: false });
    await run('DELETE FROM character_relationships WHERE id = :id', { id: ok.body.candidates[0].id });
  });

  it('Generate marks a company in the prompt, skips its romance, and leaves it out of family', async () => {
    mockCreate.mockResolvedValueOnce(reply({ seeds: [
      { a: c.dre, b: c.col, relationship_type: 'love_interest', is_romantic: true, situation: 'x' },
      { a: c.col, b: c.dre, relationship_type: 'rival', situation: 'It panned her collection.' },
    ] }));
    const res = await auth(request(app).post(`${api}/generate`)).send({ kind: 'any' });
    expect(res.status).toBe(201);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`${co.column.name} (company: a business, not a person)`);
    expect(prompt).toMatch(/Anyone marked \(company\) is a company: never a romance and never family/);
    expect(res.body.skipped.map((s) => s.code)).toContain('company_type');
    const made = res.body.candidates.find((r) => [r.character_id_a, r.character_id_b].includes(c.col));
    expect(made).toMatchObject({ relationship_type: 'rival_brand', is_romantic: false });
    await run('DELETE FROM character_relationships WHERE id IN (:ids)', { ids: res.body.candidates.map((r) => r.id) });

    mockCreate.mockResolvedValueOnce(reply({ family_bonds: [] }));
    const fam = await auth(request(app).post(`${api}/generate-family`)).send({});
    expect(fam.status).toBe(201);
    expect(mockCreate.mock.calls[1][0].messages[0].content).not.toContain(co.column.name);
    const focus = await auth(request(app).post(`${api}/generate`)).send({ kind: 'family', focus_character_id: c.col });
    expect(focus.status).toBe(400);
    expect(focus.body.error).toMatch(/is a company/);
  });

  it('a season need with a company is there by a deal, a representative or a company relationship; "the" names nobody', async () => {
    for (let n = 1; n <= 12; n += 1) await purpose(n, `Lala walks into the party ${n} and the room goes quiet`);
    await purpose(2, `Lala pitches ${co.column.name} at the launch`);
    await purpose(4, `${co.column.name} sends ${name.rep} to the show`);
    await purpose(6, `${name.marcus} and ${co.column.name} plan the cover`);
    await purpose(8, `Lala and ${name.rep} have lunch`);

    const needsOf = async () => (await auth(request(app).get(`/api/v1/world/${ids.show}/season/needs`))).body;
    const pairOf = (n) => [n.a.id, n.b.id].sort().join('|');
    const pair = (a, b) => [c[a], c[b]].sort().join('|');
    const find = (needs, slotNumber) => needs.find((n) => n.slot?.slot_number === slotNumber && n.kind === 'purpose');

    let body = await needsOf();
    expect(body.show_id).toBe(ids.show);
    // Every "the": no need names The Column but the four that do.
    expect(body.needs.filter((n) => [n.a.id, n.b.id].includes(c.col)).map((n) => n.slot.slot_number).sort()).toEqual([2, 4, 6]);
    // The sponsor-then-press row (Lala and The Column) is there by its confirmed relationship.
    expect(find(body.needs, 2)).toMatchObject({ state: 'there', there_by: 'relationship', company: { slug: co.column.slug, both: false } });
    // The representative: there.
    expect(find(body.needs, 4)).toMatchObject({ state: 'there', there_by: 'representative', company: { name: co.column.name } });
    // Marcus and The Column, confirmed as client or partner.
    expect(find(body.needs, 6)).toMatchObject({ state: 'there', there_by: 'relationship' });
    // Two people, one a representative: unaffected.
    const two = find(body.needs, 8);
    expect(pairOf(two)).toBe(pair('lala', 'rep'));
    expect(two.state).toBe('missing');
    expect(two.company).toBeUndefined();

    // A deal with the company: there without any relationship.
    await run('DELETE FROM character_relationships WHERE id = :id', { id: ids.sponsorRel });
    body = await needsOf();
    expect(find(body.needs, 2)).toMatchObject({ state: 'missing', there_by: null, company: { slug: co.column.slug } });
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, company_id, brand_or_company, created_at, updated_at)
               VALUES (:deal, :show, 'Cover story', 'editorial', 'offered', :column, :name, NOW(), NOW())`, { ...ids, name: co.column.name });
    body = await needsOf();
    expect(find(body.needs, 2)).toMatchObject({ state: 'there', there_by: 'deal', deal: { id: ids.deal, name: 'Cover story' } });
  });

  it('the family tree and its writes refuse a company; the picker leaves it out', async () => {
    const tie = await auth(request(app).post('/api/v1/families/ties')).send({ character_id: c.lala, other_character_id: c.col, role: 'sister' });
    expect(tie.status).toBe(409);
    expect(tie.body.error).toMatch(/is a company/);
    expect((await auth(request(app).post('/api/v1/families/ties')).send({ character_id: c.col, ghost_name: 'Aunt Rosa', role: 'aunt' })).status).toBe(409);
    const before = await q('SELECT COUNT(*)::int AS n FROM registry_characters WHERE registry_id = :reg', ids);
    expect((await auth(request(app).post('/api/v1/families/make-character')).send({ character_id: c.col, name: `Kin ${tag}`, role: 'sister' })).status).toBe(409);
    expect((await q('SELECT COUNT(*)::int AS n FROM registry_characters WHERE registry_id = :reg', ids))[0].n).toBe(before[0].n);
    // As a relationship's family type too.
    expect((await auth(request(app).post(api)).send({ character_id_a: c.col, character_id_b: c.dre, relationship_type: 'aunt' })).status).toBe(409);

    const people = await auth(request(app).get(`/api/v1/families/people?character_id=${c.lala}`));
    expect(people.body.characters.some((x) => x.id === c.col)).toBe(false);
    expect(people.body.characters.some((x) => x.id === c.dre)).toBe(true);
    const readout = await auth(request(app).get(`/api/v1/families/character/${c.col}`));
    expect(readout.body.company).toMatchObject({ slug: co.column.slug });
    const suggestion = await auth(request(app).get(`/api/v1/families/make-character/suggestion?character_id=${c.col}&role=sister`));
    expect(suggestion.body.suggestion).toBeNull();
  });

  it('the heritage check and its gaps leave a company out', async () => {
    // A blood tie made before it was marked a company.
    await relate('lala', 'col', { type: 'family', role: 'sister', kind: 'blood' });
    await run(`UPDATE registry_characters SET heritage_tags = CAST('["Jamaican"]' AS jsonb) WHERE id = :id`, { id: c.lala });
    const res = await auth(request(app).get(`/api/v1/families/heritage?character_id=${c.lala}`));
    expect(res.status).toBe(200);
    expect(res.body.people.some((x) => String(x.id) === c.col)).toBe(false);
    expect(res.body.gaps.some((x) => String(x.id) === c.col)).toBe(false);
    expect(res.body.flags.some((f) => f.people.includes(c.col))).toBe(false);
  });

  it('the look-alike finder lists characters that look like companies, with the company of that name', async () => {
    expect((await request(app).get('/api/v1/companies/look-alikes')).status).toBe(401);
    const res = await auth(request(app).get('/api/v1/companies/look-alikes'), user);
    expect(res.status).toBe(200);
    const of = (key) => res.body.characters.find((x) => x.character_id === c[key]);
    expect(of('velchar')).toMatchObject({ reason: 'same_name', company: { slug: co.velour.slug }, guessed_kind: 'brand', taken_by: null });
    expect(of('studio')).toMatchObject({ reason: 'looks_like', company: null, guessed_kind: 'brand' });
    expect(of('weekly')).toMatchObject({ reason: 'looks_like', company: null, guessed_kind: 'outlet' });
    // Already a company, and people, are not listed.
    expect(of('col')).toBeUndefined();
    expect(of('marcus')).toBeUndefined();
    // Nothing was linked by listing them.
    expect((await extraOf('velchar')).company_id).toBeUndefined();
  });
});
