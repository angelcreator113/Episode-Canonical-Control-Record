/**
 * Season twists, 2nd round (services/seasonTwists, routes in
 * routes/arcRoutes; 2026-10-23): the Script tab reads the twists due in
 * its episode and marks them planted or paid off there; a written episode
 * that has not done its twist is a warning; "Suggest twists" drafts some
 * with the AI (mocked here) and saves none.
 *
 * The database is the local migrated test DB.
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

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('season twists: the Script tab, written episodes, suggestions', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), reg: crypto.randomUUID(), maren: crypto.randomUUID(), mo: crypto.randomUUID(),
    thread: crypto.randomUUID(), closed: crypto.randomUUID(), ep1: crypto.randomUUID(), ep4: crypto.randomUUID(), ep6: crypto.randomUUID(),
  };
  const slot = {};
  let token;
  let ring;
  const base = `/api/v1/world/${ids.show}/season/twists`;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const due = (ep) => `/api/v1/episodes/${ep}/season-twists`;
  const mark = (ep, twistId, as) => auth(request(app).post(`${due(ep)}/${twistId}/mark`)).send({ as });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-twists-plus', email: 'evoni@twists.dev', name: 'Evoni', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show: ids.show, name: `Twists+ ${TAG}`, slug: `twists-plus-${TAG}` });
    await seedArc(ids.show, models);
    const [rows] = await run('SELECT id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) slot[r.slot_number] = r.id;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
               (:ep1, :show, 'The Brunch', 1, 'draft', NOW(), NOW()), (:ep4, :show, 'The Gala', 4, 'draft', NOW(), NOW()),
               (:ep6, :show, 'The Rent', 6, 'draft', NOW(), NOW())`, ids);
    for (const [n, ep] of [[1, ids.ep1], [4, ids.ep4], [6, ids.ep6]]) await run('UPDATE season_slots SET episode_id = :ep WHERE id = :id', { ep, id: slot[n] });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Twists+ ${TAG}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, created_at, updated_at)
               VALUES (:maren, :reg, :k1, 'Maren', 'Maren', 'support', 'accepted', NOW(), NOW()),
                      (:mo, :reg, :k2, 'Mo', 'Mo', 'support', 'accepted', NOW(), NOW())`, { ...ids, k1: `twp-${TAG}-1`, k2: `twp-${TAG}-2` });
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, situation, confirmed)
               VALUES (:id, :maren, :mo, 'sisters', 'Maren owes Mo the rent', true)`, { ...ids, id: crypto.randomUUID() });
    // A seed (unconfirmed, kept as an idea) is not a fact: Suggest twists never reads it (Evoni's review item 7).
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, situation, confirmed, seed_state)
               VALUES (:id, :maren, :mo, 'rival', 'SEED-ONLY they fight over the flat', false, 'kept')`, { ...ids, id: crypto.randomUUID() });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, source, created_at, updated_at)
               VALUES (:thread, :show, 'The money', 'open', 'evoni', NOW(), NOW()), (:closed, :show, 'The old flat', 'closed', 'evoni', NOW(), NOW())`, ids);
    const res = await auth(request(app).put(base)).send({ title: 'The ring', description: 'Maren is not wearing it', plant_slot_id: slot[1], payoff_slot_id: slot[4] });
    [ring] = res.body.twists;
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM character_relationships WHERE character_id_a = :maren', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id = :show`, ids).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('the Script tab reads what its episode plants and pays off', async () => {
    let res = await auth(request(app).get(due(ids.ep1)));
    expect(res.status).toBe(200);
    expect(res.body.plant).toEqual([expect.objectContaining({ id: ring.id, title: 'The ring', description: 'Maren is not wearing it', status: 'planned' })]);
    expect(res.body.payoff).toEqual([]);
    res = await auth(request(app).get(due(ids.ep4)));
    expect(res.body.payoff).toEqual([expect.objectContaining({ id: ring.id, planted_in: { episode_number: 1, title: 'The Brunch' } })]);
    res = await auth(request(app).get(due(ids.ep6)));
    expect(res.body).toMatchObject({ plant: [], payoff: [] });
    expect((await request(app).get(due(ids.ep1))).status).toBe(401);
  });

  it('marks it planted, then paid off, only in its own episodes', async () => {
    expect((await request(app).post(`${due(ids.ep1)}/${ring.id}/mark`).send({ as: 'planted' })).status).toBe(401);
    expect((await mark(ids.ep1, ring.id, 'paid_off')).status).toBe(409);
    expect((await mark(ids.ep6, ring.id, 'planted')).status).toBe(404);
    expect((await mark(ids.ep1, ring.id, 'shouted')).status).toBe(400);

    let res = await mark(ids.ep1, ring.id, 'planted');
    expect(res.status).toBe(200);
    expect(res.body.plant[0]).toMatchObject({ id: ring.id, status: 'planted' });
    let [[row]] = await run('SELECT status, planted_episode_id, paid_off_episode_id FROM season_twists WHERE id = :id', { id: ring.id });
    expect(row).toEqual({ status: 'planted', planted_episode_id: ids.ep1, paid_off_episode_id: null });

    res = await mark(ids.ep4, ring.id, 'paid_off');
    expect(res.status).toBe(200);
    expect(res.body.payoff[0]).toMatchObject({ status: 'paid_off' });
    // Planted again after it was paid off: nothing goes back.
    expect((await mark(ids.ep1, ring.id, 'planted')).status).toBe(200);
    [[row]] = await run('SELECT status, planted_episode_id, paid_off_episode_id FROM season_twists WHERE id = :id', { id: ring.id });
    expect(row).toEqual({ status: 'paid_off', planted_episode_id: ids.ep1, paid_off_episode_id: ids.ep4 });
  });

  it('warns when an episode is written and has not planted or paid off its twist', async () => {
    let res = await auth(request(app).put(base)).send({ title: 'The rent', plant_slot_id: slot[4], payoff_slot_id: slot[6] });
    const rent = res.body.twists.find((t) => t.title === 'The rent');
    const script = '## BEAT: 1 · Opening\nLALA: Hi.\n\n## BEAT: 2 · Login\nLALA: In.';
    await run(`UPDATE episodes SET script_content = :script, script_locked_beats = CAST('[1]' AS jsonb) WHERE id = :ep4`, { ...ids, script });
    res = await auth(request(app).get(base));
    expect(res.body.slots.find((s) => s.slot_number === 4).written).toBe(false);
    expect(res.body.warnings).toEqual([]);

    await run(`UPDATE episodes SET script_locked_beats = CAST('[1,2]' AS jsonb) WHERE id = :ep4`, ids);
    await run(`UPDATE episodes SET script_content = :script, script_locked_beats = CAST('[1,2]' AS jsonb) WHERE id = :ep6`, { ...ids, script });
    res = await auth(request(app).get(base));
    expect(res.body.slots.find((s) => s.slot_number === 4).written).toBe(true);
    expect(res.body.warnings.map((w) => w.text)).toEqual([
      'Episode 4 is already written and doesn\'t plant "The rent" yet.',
      'Episode 6 is already written and doesn\'t pay off "The rent" yet.',
    ]);
    // The ring is paid off; once the rent is planted, E6 still owes its payoff.
    await mark(ids.ep4, rent.id, 'planted');
    res = await auth(request(app).get(base));
    expect(res.body.warnings.map((w) => w.text)).toEqual(['Episode 6 is already written and doesn\'t pay off "The rent" yet.']);
  });

  it('suggests twists from the season, threads and relationships; ids are checked; nothing is saved', async () => {
    const [[{ n: before }]] = await run('SELECT COUNT(*)::int AS n FROM season_twists WHERE show_id = :show AND deleted_at IS NULL', ids);
    mockCreate.mockResolvedValue(say({ twists: [
      { title: 'The key', description: 'A key on Maren\'s chain opens Mo\'s flat', plant_episode: 2, payoff_episode: 9, thread_ids: [ids.thread, crypto.randomUUID()], character_ids: [ids.maren, ids.mo, 'nobody'] },
      { title: 'The letter', description: 'Mo keeps a letter', plant_episode: 7, payoff_episode: 3, thread_ids: [ids.closed], character_ids: [] },
      { title: 'The ring', plant_episode: 2 },
    ] }));
    const res = await auth(request(app).post(`${base}/suggest`));
    expect(res.status).toBe(200);
    expect(res.body.drafts).toEqual([
      { title: 'The key', description: 'A key on Maren\'s chain opens Mo\'s flat', plant_slot_id: slot[2], payoff_slot_id: slot[9], thread_ids: [ids.thread], character_ids: [ids.maren, ids.mo] },
      { title: 'The letter', description: 'Mo keeps a letter', plant_slot_id: slot[7], payoff_slot_id: null, thread_ids: [], character_ids: [] },
    ]);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`[${ids.thread}] The money`);
    expect(prompt).not.toContain('The old flat');
    expect(prompt).toContain('- Maren and Mo: sisters — Maren owes Mo the rent');
    expect(prompt).not.toContain('SEED-ONLY');
    expect(prompt).toContain('- The ring (planted E1, paid off E4)');
    const [[{ n: after }]] = await run('SELECT COUNT(*)::int AS n FROM season_twists WHERE show_id = :show AND deleted_at IS NULL', ids);
    expect(after).toBe(before);
    expect((await request(app).post(`${base}/suggest`)).status).toBe(401);
  });

  it('says why when the AI fails or the budget is spent', async () => {
    // The house retry (planner PR 4): a failure is asked twice, a budget refusal once.
    const ai = require('../../src/services/seasonAiContext');
    ai.setRetryPause(0);
    mockCreate.mockReset();
    mockCreate.mockRejectedValue(Object.assign(new Error('Overloaded'), { status: 529 }));
    let res;
    try {
      res = await auth(request(app).post(`${base}/suggest`));
    } finally {
      ai.setRetryPause(ai.RETRY_PAUSE_MS);
    }
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('The AI could not suggest twists right now. Try again.');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    mockCreate.mockReset();
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    res = await auth(request(app).post(`${base}/suggest`));
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/budget exceeded\. No twists were suggested/);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    res = await auth(request(app).post(`${base}/suggest`));
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not be read/);
  });
});
