/**
 * Planner PR 3 (Evoni, 2026-10-24: "relationships the season needs, and
 * the planner reads more"), against the test database:
 * - the season's needs: each twist's, thread's and slot purpose's pairs,
 *   needed by a slot, marked there / seed only / missing; a done slot needs
 *   nothing;
 * - "Add a seed" from a need: seed_why and the needed-by slot are kept;
 * - Generate aimed at a slot or a part (the AI mocked): the prompt carries
 *   the purpose, pressure and the event's guests; an unknown slot is a 404;
 * - a Later seed comes back to pending when its slot is next (or started);
 * - the planners (the slot draft, Draft the season, the proposals) read
 *   confirmed relationships only; the slot draft reads its event, twists,
 *   reveals and the purposes planned after it;
 * - "Pencil an event" is ranked by fit for the slot;
 * - the slot panel's notes and "What the season knows".
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

(shouldSkip ? describe.skip : describe)('the relationships the season needs, and what the planners read', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep1: uuid(), thread: uuid(), ring: uuid(), list: uuid(), solo: uuid(), secret: uuid(), evGala: uuid(), evFight: uuid() };
  const c = {};
  const p = {};
  const name = {};
  const slot = {};
  let arcId;
  let admin;
  let ip = 0;
  const from = (req) => req.set('X-Forwarded-For', `10.88.${ip}.1`);
  const auth = (req) => from(req).set('Authorization', `Bearer ${admin}`);
  const season = `/api/v1/world/${ids.show}/season`;
  const promptOf = (n = 0) => mockCreate.mock.calls[n][0].messages[0].content;

  const person = async (key, display) => {
    c[key] = uuid();
    name[key] = display;
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
    p[key] = row.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, 'support', :profile, NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name: display, profile: row.id });
  };
  const relate = async (a, b, f = {}) => {
    const id = uuid();
    const v = { type: 'friend', confirmed: true, tension: null, state: null, aim: null, why: null, ...f };
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, tension_state, seed_state,
                 seed_aim, seed_why, seed_source, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :tension, :state, CAST(:aim AS jsonb), :why,
                 CASE WHEN :confirmed THEN NULL ELSE 'generate' END, NOW(), NOW())`,
    { id, a: c[a], b: c[b], ...v, aim: v.aim ? JSON.stringify(v.aim) : null });
    return id;
  };
  const purpose = (n, text, extra = {}) => run(
    `UPDATE season_slots SET story_purpose = :text, story_purposes = CAST(:purposes AS jsonb), intention_source = 'auto-drafted',
            desired_pressure = :pressure WHERE id = :id`,
    { id: slot[n], text, pressure: extra.pressure || null,
      purposes: JSON.stringify([{ text, primary: true, story_thread_id: extra.thread || null, source: 'auto-drafted' }]) });

  const rel = {};

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-needs', email: 'evoni@needs.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Needs ${tag}`, slug: `needs-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Needs', :show, NOW(), NOW())", ids);
    await seedArc(ids.show, models);
    const rows = await q('SELECT id, arc_id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) { slot[r.slot_number] = r.id; arcId = r.arc_id; }

    await person('lala', 'Lala');
    await person('marcus', `Marcus ${tag}`);
    await person('jade', `Jade ${tag}`);
    await person('dre', `Dre ${tag}`);
    await person('sable', `Sable ${tag}`);

    // E1 is done: its purpose names Marcus and Jade, and needs nothing any more.
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep1, :show, 'The Brunch', 1, 'draft', 'accepted', NOW(), NOW())`, ids);
    await run('UPDATE season_slots SET episode_id = :ep1, locked_at = NOW(), accepted_at = NOW() WHERE id = :id', { ep1: ids.ep1, id: slot[1] });
    await purpose(1, `${name.marcus} and ${name.dre} make up over brunch`);

    await run(`INSERT INTO show_story_threads (id, show_id, title, description, status, source, created_at, updated_at)
               VALUES (:thread, :show, :title, 'What she hides', 'open', 'evoni', NOW(), NOW())`, { ...ids, title: `Lala and ${name.dre}'s secret` });
    await purpose(3, `${name.marcus} and ${name.jade} fall out at the launch`);
    await purpose(5, `${name.dre} confronts ${name.sable} in front of everyone`, { pressure: 'High' });
    await purpose(7, 'The secret comes closer', { thread: ids.thread });
    await purpose(8, 'Lala takes stock');

    await run(`INSERT INTO season_twists (id, show_id, arc_id, title, description, plant_slot_id, payoff_slot_id, status, character_ids) VALUES
               (:ring, :show, :arc, 'The ring', 'Jade is not wearing it', :s4, :s9, 'planned', CAST(:ringChars AS jsonb)),
               (:list, :show, :arc, 'The list', 'Sable sold it', :s2, :s12, 'planted', CAST(:listChars AS jsonb)),
               (:solo, :show, :arc, 'Alone', null, :s6, null, 'planned', CAST(:soloChars AS jsonb))`,
    { ...ids, arc: arcId, s2: slot[2], s4: slot[4], s6: slot[6], s9: slot[9], s12: slot[12],
      ringChars: JSON.stringify([c.jade, c.dre]), listChars: JSON.stringify([c.marcus, c.sable]), soloChars: JSON.stringify([c.lala]) });

    rel.mj = await relate('marcus', 'jade', { type: 'rival', tension: 'simmering' });
    await run(`INSERT INTO relationship_events (id, relationship_id, event_type, title, relationship_stage, created_at, updated_at)
               VALUES (:id, :rel, 'stage_change', 'They fell out', 'enemies', NOW(), NOW())`, { id: uuid(), rel: rel.mj });
    rel.jd = await relate('jade', 'dre', { type: 'sister', confirmed: false });
    rel.ms = await relate('marcus', 'sable', { type: 'rival', confirmed: false, state: 'later', aim: { needed_by_slot_id: slot[12] } });

    // E4: the twist's plant slot gets an event and a planned hint.
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, status) VALUES (:secret, :jade, 'She pawned the ring', 'confirmed')`, { ...ids, jade: c.jade });
    await run(`INSERT INTO season_reveals (show_id, slot_id, secret_id, intent, note, created_at, updated_at)
               VALUES (:show, :s4, :secret, 'hint', 'a pale band on her finger', NOW(), NOW())`, { ...ids, s4: slot[4] });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, canon_consequences, created_at, updated_at) VALUES
               (:evGala, :show, 'The Ring Gala', 'invite', 'draft', 6, 5, CAST('{}' AS jsonb), NOW(), NOW()),
               (:evFight, :show, 'The Launch Party', 'invite', 'draft', 6, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.dre }, { profile_id: p.sable }] } }) });
    await run('UPDATE season_slots SET event_id = :ev WHERE id = :id', { ev: ids.evGala, id: slot[4] });
    await run('UPDATE season_slots SET event_id = :ev WHERE id = :id', { ev: ids.evFight, id: slot[5] });
  });

  beforeEach(() => { mockCreate.mockReset(); ip += 1; });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all))', { all });
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM season_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM character_secrets WHERE id = :secret', ids);
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    await run('DELETE FROM season_arc_proposals WHERE show_id = :show', ids);
    await run('DELETE FROM show_follow_ups WHERE show_id = :show', ids);
    await run('DELETE FROM episode_story_records WHERE show_id = :show', ids);
    await run('UPDATE season_slots SET event_id = NULL, episode_id = NULL WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id = :show`, ids).catch((err) => console.error('cleanup:', err.message));
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const pairOf = (n) => [n.a.id, n.b.id].sort().join('|');
  const pair = (a, b) => [c[a], c[b]].sort().join('|');

  it('finds each need, the slot it is needed by, and marks it there, seed only or missing', async () => {
    const res = await auth(request(app).get(`${season}/needs`));
    expect(res.status).toBe(200);
    const { needs, counts } = res.body;
    const find = (kind, a, b) => needs.find((n) => n.kind === kind && pairOf(n) === pair(a, b));

    // A purpose naming two people: confirmed, with its stage and tension.
    expect(find('purpose', 'marcus', 'jade')).toMatchObject({
      state: 'there', slot: { slot_number: 3 },
      relationship: { id: rel.mj, type: 'rival', stage: 'enemies', tension_state: 'simmering' },
      seed_why: `Needed by E3: ${name.marcus} and ${name.jade} fall out at the launch`,
    });
    // A purpose with no relationship between them.
    expect(find('purpose', 'dre', 'sable')).toMatchObject({ state: 'missing', slot: { slot_number: 5 }, relationship: null });
    // A planned twist is needed by its plant slot; an unconfirmed seed is "seed only".
    expect(find('twist', 'jade', 'dre')).toMatchObject({
      state: 'seed', title: 'The ring', slot: { slot_number: 4, id: slot[4] }, relationship: { id: rel.jd, seed_state: null },
      seed_why: 'Needed by E4: The ring',
    });
    // A planted twist is needed by its payoff; a Later seed is still a seed.
    expect(find('twist', 'marcus', 'sable')).toMatchObject({ state: 'seed', slot: { slot_number: 12 }, relationship: { seed_state: 'later' } });
    // A thread naming two people, needed by the first slot whose purpose follows it.
    expect(find('thread', 'lala', 'dre')).toMatchObject({ state: 'missing', slot: { slot_number: 7 }, title: `Lala and ${name.dre}'s secret` });
    // A done slot needs nothing; a twist with one person gives no pair.
    expect(needs.some((n) => n.slot?.slot_number === 1)).toBe(false);
    expect(needs.some((n) => n.source_id === ids.solo)).toBe(false);
    expect(counts).toEqual({
      there: needs.filter((n) => n.state === 'there').length,
      seed: needs.filter((n) => n.state === 'seed').length,
      missing: needs.filter((n) => n.state === 'missing').length,
    });
    expect(counts.missing).toBeGreaterThanOrEqual(2);
    // Sorted by the slot each is needed by.
    const numbers = needs.map((n) => n.slot?.slot_number ?? Infinity);
    expect(numbers).toEqual([...numbers].sort((x, y) => x - y));

    expect((await request(app).get(`${season}/needs`)).status).toBe(401);
    expect((await auth(request(app).get('/api/v1/world/not-a-show/season/needs'))).status).toBe(400);
  });

  it('"Add a seed" from a need keeps its why and the slot it is needed by', async () => {
    let res = await auth(request(app).get(`${season}/needs`));
    const need = res.body.needs.find((n) => n.kind === 'purpose' && pairOf(n) === pair('dre', 'sable'));
    res = await auth(request(app).post('/api/v1/relationships/seeds')).send({
      source: 'manual',
      seeds: [{ character_id_a: need.a.id, character_id_b: need.b.id, relationship_type: 'rival', seed_why: need.seed_why, needed_by_slot_id: need.slot.id }],
    });
    expect(res.status).toBe(201);
    expect(res.body.candidates).toHaveLength(1);
    const [made] = res.body.candidates;
    expect(made).toMatchObject({ seed_source: 'manual', seed_why: `Needed by E5: ${name.dre} confronts ${name.sable} in front of everyone`, needed_by: { slot_id: slot[5], slot_number: 5, label: 'E5' } });
    const [row] = await q('SELECT seed_aim, confirmed FROM character_relationships WHERE id = :id', { id: made.id });
    expect(row).toEqual({ seed_aim: { needed_by_slot_id: slot[5] }, confirmed: false });

    res = await auth(request(app).get(`${season}/needs`));
    expect(res.body.needs.find((n) => n.kind === 'purpose' && pairOf(n) === pair('dre', 'sable'))).toMatchObject({ state: 'seed', relationship: { id: made.id } });
    // A slot that is not there is not kept.
    res = await auth(request(app).post('/api/v1/relationships/seeds')).send({
      source: 'manual', seeds: [{ character_id_a: c.lala, character_id_b: c.sable, relationship_type: 'friend', needed_by_slot_id: uuid() }],
    });
    expect(res.status).toBe(201);
    const [other] = await q('SELECT seed_aim FROM character_relationships WHERE id = :id', { id: res.body.candidates[0].id });
    expect(other.seed_aim).toBeNull();
    await run('DELETE FROM character_relationships WHERE id = :id', { id: res.body.candidates[0].id });
  });

  it('Generate aimed at a slot reads its purpose, pressure and event guests; the seeds are needed by it', async () => {
    mockCreate.mockResolvedValue(reply({ seeds: [
      { a: c.lala, b: c.jade, relationship_type: 'friend', situation: 'Jade holds Lala back', seed_why: 'Jade watches the fight' },
    ] }));
    let res = await auth(request(app).post('/api/v1/relationships/generate')).send({ slot_id: slot[5], count: 3 });
    expect(res.status).toBe(201);
    const prompt = promptOf();
    expect(prompt).toContain('Needed by season slot E5 (Part 1: Foundation');
    expect(prompt).toContain(`What E5 is for: ${name.dre} confronts ${name.sable} in front of everyone.`);
    expect(prompt).toContain('Planned pressure on Lala: High.');
    expect(prompt).toContain(`Its event: The Launch Party; its guests in the cast: ${name.dre} [${c.dre}], ${name.sable} [${c.sable}]`);
    expect(prompt).toContain('Begin every seed_why with "Needed by E5: "');
    expect(res.body.candidates).toEqual([expect.objectContaining({ seed_why: 'Needed by E5: Jade watches the fight', needed_by: expect.objectContaining({ slot_number: 5 }) })]);
    const [row] = await q('SELECT seed_aim FROM character_relationships WHERE id = :id', { id: res.body.candidates[0].id });
    expect(row.seed_aim).toMatchObject({ slot_id: slot[5], needed_by_slot_id: slot[5], kind: 'any' });
    await run('DELETE FROM character_relationships WHERE id = :id', { id: res.body.candidates[0].id });

    mockCreate.mockClear();
    res = await auth(request(app).post('/api/v1/relationships/generate')).send({ slot_id: uuid() });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('That season slot was not found.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('Generate aimed at a part reads its name, tagline and slots; an unknown part is a 404', async () => {
    mockCreate.mockResolvedValue(reply({ seeds: [] }));
    let res = await auth(request(app).post('/api/v1/relationships/generate')).send({ phase: 1, show_id: ids.show });
    expect(res.status).toBe(201);
    const prompt = promptOf();
    expect(prompt).toContain('Built for Part 1: Foundation of the season');
    expect(prompt).toContain(`- E5: ${name.dre} confronts ${name.sable} in front of everyone (pressure High); event: The Launch Party`);
    expect(prompt).toContain(`Guests of its events in the cast: ${name.dre} [${c.dre}], ${name.sable} [${c.sable}]`);
    expect(prompt).not.toContain('Begin every seed_why with');

    res = await auth(request(app).post('/api/v1/relationships/generate')).send({ phase: 7, show_id: ids.show });
    expect(res.status).toBe(404);
    res = await auth(request(app).post('/api/v1/relationships/generate')).send({ phase: 2 });
    expect(res.status).toBe(400);
  });

  it('a Later seed comes back to pending when its slot is next, or has started', async () => {
    const next = await relate('jade', 'sable', { type: 'rival', confirmed: false, state: 'later', aim: { needed_by_slot_id: slot[2] } });
    const started = await relate('lala', 'marcus', { type: 'friend', confirmed: false, state: 'later', aim: { needed_by_slot_id: slot[1] } });
    const res = await auth(request(app).get('/api/v1/relationships/cast'));
    expect(res.status).toBe(200);
    const byId = new Map(res.body.candidates.map((r) => [r.id, r]));
    expect(byId.get(next)).toMatchObject({ seed_state: null, back_from: 'later', back_note: 'Back: E2 is next', needed_by: { label: 'E2' } });
    expect(byId.get(started)).toMatchObject({ seed_state: null, back_note: 'Back: E1 has started' });
    // E12 is far off: still Later, and says when it is needed.
    expect(byId.get(rel.ms)).toMatchObject({ seed_state: 'later', needed_by: { slot_number: 12, label: 'E12' } });
    expect(byId.get(rel.ms).back_note).toBeUndefined();
    // Nothing was written: the row is still Later until Evoni acts on it.
    const [row] = await q('SELECT seed_state FROM character_relationships WHERE id = :id', { id: next });
    expect(row.seed_state).toBe('later');
    await run('DELETE FROM character_relationships WHERE id IN (:a, :b)', { a: next, b: started });
  });

  it('the slot draft reads its event, twists, reveals, the purposes after it, and confirmed relationships only', async () => {
    mockCreate.mockResolvedValue(reply({ story_purpose: 'Jade arrives without the ring', career_focus: 'reputation', desired_pressure: 'Medium', outcome_range: { min: 'safe', max: 'pass' } }));
    const res = await auth(request(app).post(`${season}/slots/${slot[4]}/intention/draft`)).send({});
    expect(res.status).toBe(200);
    const prompt = promptOf();
    expect(prompt).toContain('The event pencilled into this slot: The Ring Gala (invite)');
    expect(prompt).toContain(`- PLANT: The ring — Jade is not wearing it (with ${name.jade}, ${name.dre})`);
    expect(prompt).toContain(`- Hint at ${name.jade}'s secret: She pawned the ring (a pale band on her finger)`);
    expect(prompt).toContain(`- E5: ${name.dre} confronts ${name.sable} in front of everyone`);
    expect(prompt).toContain('- E7: The secret comes closer');
    expect(prompt).toContain("RELATIONSHIPS BETWEEN THE SEASON'S PEOPLE (confirmed");
    expect(prompt).toContain(`- ${name.marcus} and ${name.jade}: rival, now enemies, simmering`);
    // Seeds, kept ideas and Later are not facts.
    expect(prompt).not.toContain(`${name.jade} and ${name.dre}:`);
    expect(prompt).not.toContain(`${name.marcus} and ${name.sable}:`);
  });

  it('Draft the season and the proposals read confirmed relationships only', async () => {
    mockCreate.mockResolvedValue(reply({ slots: [{ slot_number: 6, story_purpose: 'A quiet one', desired_pressure: 'Low' }] }));
    let res = await auth(request(app).post(`${season}/draft`)).send({ phase: 1 });
    expect(res.status).toBe(200);
    let prompt = promptOf();
    expect(prompt).toContain(`- ${name.marcus} and ${name.jade}: rival, now enemies, simmering`);
    expect(prompt).not.toContain(`${name.jade} and ${name.dre}:`);

    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply({ summary: 'Nothing to change', changes: [] }));
    res = await auth(request(app).post(`${season}/proposals`)).send({});
    expect(res.status).toBe(200);
    prompt = promptOf();
    expect(prompt).toContain(`- ${name.marcus} and ${name.jade}: rival, now enemies, simmering`);
    expect(prompt).not.toContain(`${name.marcus} and ${name.sable}:`);
  });

  it('ranks "Pencil an event" by fit for the slot, best first, each with a reason', async () => {
    const ev = { coffee: uuid(), brunch: uuid(), ball: uuid() };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, canon_consequences, created_at, updated_at) VALUES
               (:ball, :show, 'A Ball', 'invite', 'draft', 9, 8, CAST('{}' AS jsonb), NOW(), NOW()),
               (:brunch, :show, 'Brunch Club', 'invite', 'ready', 2, 1, CAST('{}' AS jsonb), NOW(), NOW()),
               (:coffee, :show, 'Coffee Date', 'invite', 'draft', 1, 1, CAST('{}' AS jsonb), NOW(), NOW())`, { ...ev, show: ids.show });
    await run("UPDATE season_slots SET desired_pressure = 'Low' WHERE id = :id", { id: slot[6] });
    const res = await auth(request(app).get(`${season}/slots/${slot[6]}/event-fit`));
    expect(res.status).toBe(200);
    expect(res.body.events.map((e) => e.name)).toEqual(['Coffee Date', 'Brunch Club', 'A Ball']);
    expect(res.body.events[0]).toMatchObject({ id: ev.coffee, reason: 'Fits the planned pressure (Low)', reason_kind: 'boost' });
    expect(res.body.events[1].reason).toBe('Close to the planned pressure (Medium, planned Low)');
    expect(res.body.events[2]).toMatchObject({ reason: 'Pressure High, planned Low', reason_kind: 'warn' });
    // The events already in a slot are not offered.
    expect(res.body.events.some((e) => e.id === ids.evGala)).toBe(false);
    expect((await auth(request(app).get(`${season}/slots/${uuid()}/event-fit`))).status).toBe(404);
    await run('DELETE FROM world_events WHERE id IN (:coffee, :brunch, :ball)', ev);
  });

  it("the slot panel's notes: the twists it plants or pays off, and its reveals", async () => {
    let res = await auth(request(app).get(`${season}/slots/${slot[4]}/notes`));
    expect(res.status).toBe(200);
    expect(res.body.twists.plant).toEqual([expect.objectContaining({ id: ids.ring, title: 'The ring', characters: [name.jade, name.dre] })]);
    expect(res.body.twists.payoff).toEqual([]);
    expect(res.body.reveals).toEqual([expect.objectContaining({ intent: 'hint', text: 'She pawned the ring', character_name: name.jade })]);
    res = await auth(request(app).get(`${season}/slots/${slot[12]}/notes`));
    expect(res.body.twists.payoff).toEqual([expect.objectContaining({ id: ids.list, planted_in: expect.objectContaining({ episode_number: 2 }) })]);
    expect((await auth(request(app).get(`${season}/slots/${uuid()}/notes`))).status).toBe(404);
  });

  it('"What the season knows": the latest approved record and the open follow-ups', async () => {
    let res = await auth(request(app).get(`${season}/knows`));
    expect(res.body).toMatchObject({ record: null, follow_ups: [] });
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, relationships, threads, approved_at)
               VALUES (:ep1, :show, 'approved', 'Lala wins brunch.', CAST(:rels AS jsonb), CAST(:threads AS jsonb), NOW())`, {
      ...ids, rels: JSON.stringify([{ a_name: 'Lala', b_name: name.marcus, type: 'friend', stage_after: 'friends', keep: true }]),
      threads: JSON.stringify([{ title: 'Who sent the flowers', keep: true }, { title: 'Closed one', action: 'close', keep: true }]),
    });
    await run("INSERT INTO show_follow_ups (show_id, from_episode_id, text, due_hint, status) VALUES (:show, :ep1, 'Thank Jade for the dress', 'soon', 'open')", ids);
    res = await auth(request(app).get(`${season}/knows`));
    expect(res.status).toBe(200);
    expect(res.body.record).toMatchObject({
      episode_number: 1, title: 'The Brunch', what_happened: 'Lala wins brunch.',
      relationships: [{ a_name: 'Lala', b_name: name.marcus, type: 'friend', stage_after: 'friends', is_romantic: false }],
      threads: [{ title: 'Who sent the flowers', note: null }],
    });
    expect(res.body.follow_ups).toEqual([expect.objectContaining({ text: 'Thank Jade for the dress', due_hint: 'soon', episode_number: 1 })]);
  });
});
