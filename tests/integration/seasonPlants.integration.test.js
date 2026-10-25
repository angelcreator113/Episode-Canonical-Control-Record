/**
 * Plant tracker (services/seasonTwists, routes in routes/arcRoutes;
 * migration 20261025230000, 2026-10-25): a plant recorded from a finished
 * script (kind, beat), "Mark paid off in episode N" with a note and its
 * Undo, the warnings for a plant open too long or past its planned payoff,
 * "Suggest plants from this script" (Haiku, mocked here; nothing saved),
 * and the open plants a later episode's writer is offered.
 *
 * The database is the local migrated test DB; nothing calls the AI.
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
const { openPlantsBlock, twistsForEpisode } = require('../../src/services/seasonTwists');
const { setRetryPause } = require('../../src/services/seasonAiContext');
const { storyContextBlocks } = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

const SCRIPT = [
  '## BEAT: 1 Opening', 'LALA: Another morning, another closet crisis.',
  '## BEAT: 2 The scroll', 'LALA: Who is @thriftveil? Every post is my archive.',
  '## BEAT: 3 The reveal', 'DECLAN FERRIS: (logging in as @thriftveil) She cannot know.',
  '## BEAT: 4 The DM', 'NOTIFICATION: Studio by Sable — we would love you to MODEL our line.',
].join('\n');

(shouldSkip ? describe.skip : describe)('plant tracker', () => {
  const ids = { show: crypto.randomUUID(), ep1: crypto.randomUUID(), ep2: crypto.randomUUID(), ep6: crypto.randomUUID(), ep8: crypto.randomUUID() };
  const slot = {};
  let token;
  const base = `/api/v1/world/${ids.show}/season/twists`;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const put = (body, path = base) => auth(request(app).put(path)).send(body);
  const post = (path, body = {}) => auth(request(app).post(path)).send(body);
  const plantNamed = (res, title) => res.body.twists.find((t) => t.title === title);

  beforeAll(async () => {
    setRetryPause(0);
    token = TokenService.generateTokenPair({ id: 'test-plants', email: 'evoni@plants.dev', name: 'Evoni', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show: ids.show, name: `Plants ${ids.show.slice(0, 8)}`, slug: `plants-${ids.show.slice(0, 8)}` });
    await seedArc(ids.show, models);
    const [rows] = await run('SELECT id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) slot[r.slot_number] = r.id;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at) VALUES
               (:ep1, :show, 'The Archive', 1, 'draft', :script, NOW(), NOW()),
               (:ep2, :show, 'The Fitting', 2, 'draft', NULL, NOW(), NOW()),
               (:ep6, :show, 'The Runway', 6, 'draft', NULL, NOW(), NOW()),
               (:ep8, :show, 'The Gala', 8, 'draft', NULL, NOW(), NOW())`, { ...ids, script: SCRIPT });
    for (const [n, ep] of [[1, ids.ep1], [2, ids.ep2], [6, ids.ep6], [8, ids.ep8]]) {
      await run('UPDATE season_slots SET episode_id = :ep WHERE id = :id', { ep, id: slot[n] });
    }
    // Episode 1 is done: a plant read from its finished script is still recorded.
    await run('UPDATE season_slots SET accepted_at = NOW() WHERE id = :id', { id: slot[1] });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id = :show`, ids).catch((err) => console.error(err.message));
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('suggests plants from a script with Haiku, and saves nothing', async () => {
    mockCreate.mockResolvedValue(say({ plants: [
      { text: 'Declan Ferris is @thriftveil', kind: 'twist', beat: 3, why: 'He has been copying her archive.', quote: 'logging in as @thriftveil', payoff_episode: 6 },
      { text: 'Studio by Sable wants Lala to model, not design', kind: 'opportunity', beat: 4, payoff_episode: 1 },
      { text: 'Declan Ferris is @thriftveil', kind: 'twist' },
      { text: 'A beat that is not there', kind: 'shouted', beat: 40 },
      { text: '' },
    ] }));
    const res = await post(`/api/v1/episodes/${ids.ep1}/season-plants/suggest`);
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Studio by Sable');
    expect(prompt).toContain('EPISODE 1: "The Archive"');
    expect(res.body).toMatchObject({ show_id: ids.show, episode: { id: ids.ep1, slot_number: 1 }, plant_slot_id: slot[1] });
    expect(res.body.drafts).toEqual([
      { title: 'Declan Ferris is @thriftveil', kind: 'twist', description: 'He has been copying her archive.', quote: 'logging in as @thriftveil',
        plant_beat: 3, plant_slot_id: slot[1], payoff_slot_id: slot[6] },
      // A payoff before or at the plant is dropped; so is a duplicate; a bad kind and beat fall back.
      { title: 'Studio by Sable wants Lala to model, not design', kind: 'opportunity', description: null, quote: null,
        plant_beat: 4, plant_slot_id: slot[1], payoff_slot_id: null },
      { title: 'A beat that is not there', kind: 'twist', description: null, quote: null, plant_beat: null, plant_slot_id: slot[1], payoff_slot_id: null },
    ]);
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM season_twists WHERE show_id = :show', ids);
    expect(n).toBe(0);
  });

  it('refuses a script-less episode, says so over budget, and needs sign-in', async () => {
    let res = await post(`/api/v1/episodes/${ids.ep2}/season-plants/suggest`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no script yet/);
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded.'), { code: 'AI_BUDGET_EXCEEDED' }));
    res = await post(`/api/v1/episodes/${ids.ep1}/season-plants/suggest`);
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/No plants were suggested/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    res = await post(`/api/v1/episodes/${ids.ep1}/season-plants/suggest`);
    expect(res.status).toBe(502);
    expect(mockCreate).toHaveBeenCalledTimes(2); // the two-attempt loop asks again once
    expect((await request(app).post(`/api/v1/episodes/${ids.ep1}/season-plants/suggest`)).status).toBe(401);
  });

  it('records approved plants in a done episode, with kind and beat', async () => {
    let res = await put({ title: 'Declan Ferris is @thriftveil', kind: 'twist', plant_beat: 3, plant_slot_id: slot[1], payoff_slot_id: slot[6], status: 'planted' });
    expect(res.status).toBe(200);
    expect(plantNamed(res, 'Declan Ferris is @thriftveil')).toMatchObject({
      kind: 'twist', plant_beat: 3, status: 'planted', planted_episode_id: ids.ep1, plant: { slot_number: 1 }, payoff: { slot_number: 6 }, paid_off: null,
    });
    res = await put({ title: 'Studio by Sable wants Lala to model, not design', kind: 'opportunity', plant_beat: 4, plant_slot_id: slot[1], status: 'planted' });
    expect(res.status).toBe(200);
    expect(plantNamed(res, 'Studio by Sable wants Lala to model, not design')).toMatchObject({ kind: 'opportunity', payoff_slot_id: null });
    // Still a plan in a done episode: refused, as before.
    expect((await put({ title: 'Too late', plant_slot_id: slot[1] })).status).toBe(409);
    expect((await put({ title: 'Bad kind', kind: 'rumour', plant_slot_id: slot[2] })).status).toBe(400);
    expect((await put({ title: 'Bad beat', plant_beat: 'nine', plant_slot_id: slot[2] })).status).toBe(400);
    // An edit that leaves the kind and beat out keeps them.
    const declan = plantNamed(res, 'Declan Ferris is @thriftveil');
    res = await put({ title: declan.title, description: 'The burner account', plant_slot_id: slot[1], payoff_slot_id: slot[6], status: 'planted' }, `${base}/${declan.id}`);
    expect(plantNamed(res, declan.title)).toMatchObject({ kind: 'twist', plant_beat: 3, description: 'The burner account' });
  });

  it('warns about a plant open too long, and one past its planned payoff', async () => {
    let res = await auth(request(app).get(base));
    expect(res.body.current_episode).toBe(1);
    expect(res.body.warnings.filter((w) => w.type)).toEqual([]);
    // The season reaches Episode 8 (its script is in).
    await run('UPDATE episodes SET script_content = :s WHERE id = :id', { s: '## BEAT: 1 Gala\nLALA: Here we go.', id: ids.ep8 });
    res = await auth(request(app).get(base));
    expect(res.body.current_episode).toBe(8);
    const declan = plantNamed(res, 'Declan Ferris is @thriftveil');
    const sable = plantNamed(res, 'Studio by Sable wants Lala to model, not design');
    expect(res.body.warnings).toEqual(expect.arrayContaining([
      { twist_id: declan.id, type: 'past_payoff', text: expect.stringMatching(/meant to pay off in Episode 6, and the season is at Episode 8/) },
      { twist_id: sable.id, type: 'open_long', text: expect.stringMatching(/planted in Episode 1 and is still open 7 episodes later/) },
    ]));
  });

  it('offers a later episode\'s writer the open plants, and leaves them out with none', async () => {
    const block = await openPlantsBlock(sequelize, ids.ep8);
    expect(block).toContain('OPEN PLANTS');
    expect(block).toContain('[twist] Declan Ferris is @thriftveil');
    expect(block).toContain('planted in episode 1, beat 3; it was meant to pay off in episode 6');
    expect(block).toContain('[opportunity] Studio by Sable');
    expect(storyContextBlocks({ openPlantsBlock: block })).toContain('OPEN PLANTS');
    expect(storyContextBlocks({ openPlantsBlock: null })).not.toContain('OPEN PLANTS');
    // Episode 1 planted them: nothing earlier is open there.
    expect(await openPlantsBlock(sequelize, ids.ep1)).toBeNull();
    // Episode 2 comes before Declan's planned payoff: only the plant with none planned.
    const two = await openPlantsBlock(sequelize, ids.ep2);
    expect(two).toContain('Studio by Sable');
    expect(two).not.toContain('thriftveil');
  });

  it('marks a plant paid off in episode N with a note, keeps the plan, and undoes it', async () => {
    let res = await auth(request(app).get(base));
    const declan = plantNamed(res, 'Declan Ferris is @thriftveil');
    expect((await post(`${base}/${declan.id}/paid-off`, { slot_id: slot[1] })).status).toBe(400);
    expect((await post(`${base}/${declan.id}/paid-off`, { slot_id: crypto.randomUUID() })).status).toBe(404);
    expect((await request(app).post(`${base}/${declan.id}/paid-off`).send({ slot_id: slot[8] })).status).toBe(401);

    res = await post(`${base}/${declan.id}/paid-off`, { slot_id: slot[8], note: 'Lala finds his login on the gala laptop.' });
    expect(res.status).toBe(200);
    expect(plantNamed(res, declan.title)).toMatchObject({
      status: 'paid_off', payoff_slot_id: slot[6], paid_off_slot_id: slot[8], paid_off: { slot_number: 8 },
      paid_off_episode_id: ids.ep8, payoff_note: 'Lala finds his login on the gala laptop.',
    });
    expect(res.body.warnings.filter((w) => w.twist_id === declan.id)).toEqual([]);
    // It pays off where it paid off: Episode 8's list, not Episode 6's.
    expect((await twistsForEpisode(sequelize, ids.ep8)).payoff.map((t) => t.title)).toEqual([declan.title]);
    expect((await twistsForEpisode(sequelize, ids.ep6)).payoff).toEqual([]);
    expect(await openPlantsBlock(sequelize, ids.ep8)).not.toContain('thriftveil');

    res = await post(`${base}/${declan.id}/reopen`);
    expect(res.status).toBe(200);
    expect(plantNamed(res, declan.title)).toMatchObject({ status: 'planted', paid_off_slot_id: null, payoff_note: null, payoff_slot_id: slot[6] });
    expect((await post(`${base}/${declan.id}/reopen`)).status).toBe(404);
  });
});
