/**
 * The Season page's round 3 AI buttons (services/seasonAiHelpers, routes in
 * routes/arcRoutes; Evoni, 2026-10-26). The AI is mocked. Each button is
 * one call (two only when the first answer cannot be read), a budget
 * refusal is a plain 429 and is never retried, and nothing is saved until
 * Evoni accepts: Accept and Apply go through the services that already
 * write slots' purposes, twists, threads and the reveal plan, and the pitch
 * is stored in shows.metadata.season_pitches without touching other keys.
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
const { setRetryPause } = require('../../src/services/seasonAiContext');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });
const budget = () => Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

(shouldSkip ? describe.skip : describe)('season AI buttons: next step, focus, arc suggestions, carried, pitch', () => {
  const tag = uuid().slice(0, 8);
  const ids = {
    show: uuid(), reg: uuid(), arc1: uuid(), arc2: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), ana: uuid(),
    oldThread: uuid(), dropThread: uuid(), twist1: uuid(), secret: uuid(),
  };
  const slots = {};
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const base = `/api/v1/world/${ids.show}/season`;
  const post = (path, body = {}) => auth(request(app).post(`${base}/${path}`)).send(body);
  const slotRow = async (key) => (await run('SELECT story_purposes, career_focus, story_thread_id FROM season_slots WHERE id = :id', { id: slots[key] }))[0][0];
  const snapshot = async () => {
    const [s] = await run('SELECT id, story_purposes, updated_at FROM season_slots WHERE show_id = :show ORDER BY id', ids);
    const [t] = await run('SELECT id, status, updated_at FROM season_twists WHERE show_id = :show ORDER BY id', ids);
    const [th] = await run('SELECT id, status, updated_at FROM show_story_threads WHERE show_id = :show ORDER BY id', ids);
    const [r] = await run('SELECT id FROM season_reveals WHERE show_id = :show ORDER BY id', ids);
    const [m] = await run('SELECT metadata::text AS m FROM shows WHERE id = :show', ids);
    return JSON.stringify({ s, t, th, r, m });
  };

  beforeAll(async () => {
    setRetryPause(0);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-season-ai', email: 'evoni@season-ai.dev', name: 'Evoni', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{"keep_me": 1}' AS json), NOW(), NOW())`,
      { show: ids.show, name: `Season AI ${tag}`, slug: `season-ai-${tag}` });
    const phases = JSON.stringify([
      { phase: 1, title: 'First', episode_start: 1, episode_end: 1 },
      { phase: 2, title: 'Second', episode_start: 2, episode_end: 2 },
      { phase: 3, title: 'Third', episode_start: 3, episode_end: 3 },
    ]);
    for (const [n, status, arc] of [[1, 'completed', ids.arc1], [2, 'active', ids.arc2]]) {
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, tagline, logline, season_number, episode_start, episode_end,
                   phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, created_at, updated_at)
                 VALUES (:arc, :show, :n, :title, 'Tag', 'Lala goes big.', :n, 1, 3, CAST(:phases AS jsonb), 1, :status, '[]', '[]', 'rising', NOW(), NOW())`,
      { arc, show: ids.show, n, title: `Season ${n} title`, status, phases });
    }
    for (const [ep, n, season] of [[ids.ep1, 1, 1], [ids.ep2, 2, 1], [ids.ep3, 1, 2]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, season_number, created_at, updated_at)
                 VALUES (:ep, :show, :title, :n, 'draft', :season, NOW(), NOW())`, { ep, show: ids.show, title: `S${season} E${n}`, n, season });
    }
    // Season 1: three slots, the first two done. Season 2: E1 done (with ep3), E2 and E3 open.
    for (const [arc, n] of [[ids.arc1, 1], [ids.arc2, 2]]) {
      for (const s of [1, 2, 3]) {
        const id = uuid();
        slots[`${n}-${s}`] = id;
        const ep = n === 1 ? ({ 1: ids.ep1, 2: ids.ep2 }[s] || null) : (s === 1 ? ids.ep3 : null);
        await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, accepted_at, created_at, updated_at)
                   VALUES (:id, :show, :arc, :n, :s, :s, :ep, ${ep ? 'NOW()' : 'NULL'}, NOW(), NOW())`, { id, show: ids.show, arc, n, s, ep });
      }
    }
    // Season 2's E2 already has a purpose Evoni wrote, and a career focus to keep.
    await run(`UPDATE season_slots SET story_purpose = 'Her own purpose', career_focus = 'Keep me', intention_source = 'edited',
                 story_purposes = CAST(:p AS jsonb) WHERE id = :id`,
    { id: slots['2-2'], p: JSON.stringify([{ text: 'Her own purpose', primary: true, story_thread_id: null, source: 'edited' }]) });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, created_at, updated_at)
               VALUES (:oldThread, :show, 'Old thread', 'open', NOW(), NOW()), (:dropThread, :show, 'Thread to drop', 'advanced', NOW(), NOW())`, ids);
    await run('UPDATE season_slots SET story_thread_id = :oldThread WHERE id = :slot', { ...ids, slot: slots['1-1'] });
    await run('UPDATE season_slots SET story_thread_id = :dropThread WHERE id = :slot', { ...ids, slot: slots['1-2'] });
    await run(`INSERT INTO season_twists (id, show_id, arc_id, title, description, plant_slot_id, status, created_at, updated_at)
               VALUES (:twist1, :show, :arc1, 'S1 twist', 'The ring is fake', :p1, 'planted', NOW(), NOW())`, { ...ids, p1: slots['1-1'] });

    // The cast: Ana is in Season 2's E1 (an approved story record); she keeps a secret.
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Season AI', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
               VALUES (:ana, :reg, :key, 'Ana', NOW(), NOW())`, { ...ids, key: `ana-${tag}` });
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, characters, relationships, created_at, updated_at)
               VALUES (:ep3, :show, 'approved', CAST(:chars AS jsonb), '[]', NOW(), NOW())`,
    { ...ids, chars: JSON.stringify([{ character_id: ids.ana, name: 'Ana' }]) });
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, state, status, created_at, updated_at)
               VALUES (:secret, :ana, 'She sold the boutique.', 'hidden', 'confirmed', NOW(), NOW())`, ids);
  });

  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM season_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id = :ana', ids);
    await run('DELETE FROM episode_story_records WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    await run('DELETE FROM season_slots WHERE show_id = :show', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM show_arcs WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const items = [
    { kind: 'release', title: 'S2 E1 releases in 2 days; still needs a thumbnail.', detail: 'The Launch' },
    { kind: 'slots', title: 'Part 2 · Second: 1 slot with no event yet.', detail: 'E2' },
  ];

  describe('What should I do next?', () => {
    it('one Haiku call over the items; two or three sentences; nothing saved', async () => {
      const before = await snapshot();
      mockCreate.mockResolvedValueOnce(say({ sentences: ['Lock E1\'s thumbnail today.', 'E2 needs an event.', 'Then rest.', 'A fourth is cut.'] }));
      const res = await post('ai/next-step', { items });
      expect(res.status).toBe(200);
      expect(res.body.sentences).toEqual(['Lock E1\'s thumbnail today.', 'E2 needs an event.', 'Then rest.']);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe(HAIKU);
      expect(call.messages[0].content).toContain('still needs a thumbnail');
      expect(await snapshot()).toBe(before);
    });

    it('no items: a 400 and no call', async () => {
      const res = await post('ai/next-step', { items: [] });
      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('the budget refuses: a plain 429, asked once only', async () => {
      mockCreate.mockRejectedValue(budget());
      const res = await post('ai/next-step', { items });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
      expect(res.body.error).toMatch(/Today's AI budget is used up, so nothing was asked and nothing changed/);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('an unreadable answer is asked once more, then a plain 502', async () => {
      mockCreate.mockResolvedValue(say('not json'));
      const res = await post('ai/next-step', { items });
      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/could not suggest a next step/);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('needs sign-in', async () => {
      const res = await request(app).post(`${base}/ai/next-step`).send({ items });
      expect(res.status).toBe(401);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('Focus for today', () => {
    it('one Haiku call over every show\'s items; one line', async () => {
      mockCreate.mockResolvedValueOnce(say({ line: 'Lock S2 E1\'s thumbnail before anything else.' }));
      const res = await auth(request(app).post('/api/v1/season-ai/focus')).send({ seasons: [{ show: 'Lala', season_number: 2, title: 'Big', items }] });
      expect(res.status).toBe(200);
      expect(res.body.line).toBe('Lock S2 E1\'s thumbnail before anything else.');
      expect(mockCreate.mock.calls[0][0].model).toBe(HAIKU);
      expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('Lala · Season 2: Big');
    });

    it('the budget refuses: a plain 429', async () => {
      mockCreate.mockRejectedValue(budget());
      const res = await auth(request(app).post('/api/v1/season-ai/focus')).send({ seasons: [{ show: 'Lala', season_number: 2, items }] });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
    });
  });

  describe('Arc suggestions', () => {
    let suggestions;
    it('one call over the cast; a purpose or twist the season cannot take becomes a note; nothing saved', async () => {
      const before = await snapshot();
      mockCreate.mockResolvedValueOnce(say({ suggestions: [
        { kind: 'purpose', slot: 2, text: 'Ana comes back with news.', why: 'She is missing after E1.', thread_id: ids.oldThread },
        { kind: 'purpose', slot: 1, text: 'Too late for E1.', why: 'Done.' },
        { kind: 'twist', slot: 2, payoff_slot: 3, title: 'The boutique', text: 'Ana hints she sold it.', why: 'Pays off the secret.' },
        { kind: 'twist', slot: 3, payoff_slot: 2, title: 'Backwards', text: 'Out of order.', why: 'x' },
        { kind: 'note', text: 'Book Ana as a guest at the next event.', why: 'No host yet.' },
      ] }));
      const res = await post('ai/arc-suggestions');
      expect(res.status).toBe(200);
      expect(mockCreate.mock.calls[0][0].model).toBe(SONNET);
      expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('- Ana: E1');
      suggestions = res.body.suggestions;
      expect(suggestions.map((s) => s.kind)).toEqual(['purpose', 'note', 'twist', 'note', 'note']);
      expect(suggestions[0]).toMatchObject({ slot_id: slots['2-2'], slot_number: 2, thread_id: ids.oldThread });
      expect(suggestions[1].cannot_apply).toMatch(/E1 is done or started/);
      expect(suggestions[2]).toMatchObject({ slot_id: slots['2-2'], payoff_slot_id: slots['2-3'] });
      expect(await snapshot()).toBe(before);
    });

    it('Accept on a purpose adds it beside the slot\'s own, keeping its focus', async () => {
      const res = await post('ai/arc-suggestions/accept', suggestions[0]);
      expect(res.status).toBe(200);
      expect(res.body.applied).toBe('Added a story purpose to E2.');
      const row = await slotRow('2-2');
      expect(row.story_purposes.map((p) => [p.text, p.primary, p.story_thread_id])).toEqual([
        ['Her own purpose', true, null], ['Ana comes back with news.', false, ids.oldThread],
      ]);
      expect(row.career_focus).toBe('Keep me');
    });

    it('Accept on a twist adds it through the twists', async () => {
      const res = await post('ai/arc-suggestions/accept', suggestions[2]);
      expect(res.status).toBe(200);
      const [[t]] = await run("SELECT status, plant_slot_id, payoff_slot_id, note FROM season_twists WHERE show_id = :show AND title = 'The boutique'", ids);
      expect(t).toMatchObject({ status: 'planned', plant_slot_id: slots['2-2'], payoff_slot_id: slots['2-3'], note: 'From Arc suggestions' });
    });

    it('a note is never written', async () => {
      const res = await post('ai/arc-suggestions/accept', suggestions[4]);
      expect(res.status).toBe(400);
    });

    it('a past season with nobody in it: a 400 and no call', async () => {
      const res = await post('ai/arc-suggestions?season=1');
      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("What's carried into Season 2?", () => {
    let carried;
    it('reads Season 1\'s open threads, twists and kept secrets; one call; nothing saved', async () => {
      const before = await snapshot();
      let prompt = '';
      mockCreate.mockImplementationOnce(async ({ messages }) => {
        prompt = messages[0].content;
        const ref = (what) => prompt.match(new RegExp(`- (\\w\\d+) [a-z]+: ${what}`))?.[1];
        return say({ items: [
          { ref: ref('Thread to drop'), decision: 'drop', reason: 'It was answered in E2.' },
          { ref: ref('Old thread'), decision: 'continue', reason: 'Still open.', slot: 3 },
          { ref: ref('S1 twist'), decision: 'drop', reason: 'No longer fits.' },
          { ref: ref('Ana: She sold'), decision: 'resolve', reason: 'Time to tell.', slot: 99 },
        ] });
      });
      const res = await post('ai/carried?season=1');
      expect(res.status).toBe(200);
      expect(prompt).toMatch(/T\d thread: Thread to drop \(advanced\)/);
      expect(prompt).toMatch(/T\d thread: Old thread \(open\)/);
      expect(prompt).toContain('W1 twist: S1 twist (planted)');
      expect(prompt).toContain('S1 secret: Ana: She sold the boutique. (kept)');
      expect(res.body.next_season).toMatchObject({ arc_id: ids.arc2, season_number: 2 });
      carried = res.body.items;
      const byType = Object.fromEntries(carried.map((i) => [i.title, i]));
      expect(byType['Thread to drop']).toMatchObject({ type: 'thread', decision: 'drop', slot_id: null });
      expect(byType['Old thread']).toMatchObject({ type: 'thread', decision: 'continue', slot_number: 3 });
      expect(byType['S1 twist']).toMatchObject({ type: 'twist', decision: 'drop' });
      // An unknown slot falls back to the next season's first open one.
      expect(byType['Ana: She sold the boutique.']).toMatchObject({ type: 'secret', decision: 'resolve', slot_number: 2 });
      expect(await snapshot()).toBe(before);
    });

    it('Apply goes for the ticked rows only, never deleting', async () => {
      const ticked = carried.filter((i) => i.title !== 'S1 twist').map((i) => ({ type: i.type, id: i.id, decision: i.decision, slot_id: i.slot_id }));
      const res = await post('ai/carried/apply?season=1', { decisions: ticked });
      expect(res.status).toBe(200);
      expect(res.body.results.every((r) => r.ok)).toBe(true);
      const [threads] = await run('SELECT id, status, deleted_at FROM show_story_threads WHERE show_id = :show', ids);
      const status = Object.fromEntries(threads.map((t) => [t.id, t.status]));
      expect(status[ids.dropThread]).toBe('closed');
      expect(status[ids.oldThread]).toBe('open');
      expect(threads.every((t) => t.deleted_at === null)).toBe(true);
      const row = await slotRow('2-3');
      expect(row.story_purposes).toEqual([expect.objectContaining({ text: 'Continue: Old thread', story_thread_id: ids.oldThread, primary: true })]);
      const [[reveal]] = await run('SELECT slot_id, intent FROM season_reveals WHERE show_id = :show AND secret_id = :secret AND deleted_at IS NULL', ids);
      expect(reveal).toMatchObject({ slot_id: slots['2-2'], intent: 'reveal' });
      // The twist was not ticked: left as it was.
      const [[twist]] = await run('SELECT status, deleted_at FROM season_twists WHERE id = :twist1', ids);
      expect(twist).toMatchObject({ status: 'planted', deleted_at: null });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('drop on a twist marks it dropped (kept, not deleted); continue carries a new one', async () => {
      let res = await post('ai/carried/apply?season=1', { decisions: [{ type: 'twist', id: ids.twist1, decision: 'continue', slot_id: slots['2-3'] }] });
      expect(res.body.results[0]).toMatchObject({ ok: true });
      const [[carriedTwist]] = await run("SELECT plant_slot_id, status, note FROM season_twists WHERE show_id = :show AND arc_id = :arc2 AND title = 'S1 twist'", ids);
      expect(carriedTwist).toMatchObject({ plant_slot_id: slots['2-3'], status: 'planned', note: 'Carried from Season 1' });
      res = await post('ai/carried/apply?season=1', { decisions: [{ type: 'twist', id: ids.twist1, decision: 'drop' }] });
      expect(res.body.results[0]).toMatchObject({ ok: true });
      const [[twist]] = await run('SELECT status, deleted_at FROM season_twists WHERE id = :twist1', ids);
      expect(twist).toMatchObject({ status: 'dropped', deleted_at: null });
    });

    it('drop on a secret changes nothing', async () => {
      const before = await snapshot();
      const res = await post('ai/carried/apply?season=1', { decisions: [{ type: 'secret', id: ids.secret, decision: 'drop' }] });
      expect(res.body.results[0].text).toMatch(/nothing was changed/);
      expect(await snapshot()).toBe(before);
    });

    it('nothing ticked: a 400', async () => {
      const res = await post('ai/carried/apply?season=1', { decisions: [] });
      expect(res.status).toBe(400);
    });

    it('the budget refuses: a plain 429', async () => {
      mockCreate.mockRejectedValue(budget());
      const res = await post('ai/carried?season=1');
      expect(res.status).toBe(429);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Season pitch', () => {
    it('a draft from the logline and parts; nothing saved', async () => {
      mockCreate.mockResolvedValueOnce(say({ pitch: 'Lala goes big.\nEverything she built is on the line.\nA third line is cut.' }));
      const res = await post('ai/pitch');
      expect(res.status).toBe(200);
      expect(res.body.pitch).toBe('Lala goes big.\nEverything she built is on the line.');
      expect(mockCreate.mock.calls[0][0].model).toBe(SONNET);
      expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('Logline: Lala goes big.');
      const saved = await auth(request(app).get(`${base}/pitch`));
      expect(saved.body.saved).toBeNull();
    });

    it('Save stores it per season and leaves other metadata alone; empty clears it', async () => {
      let res = await auth(request(app).put(`${base}/pitch`)).send({ text: ' Line one.\nLine two. ' });
      expect(res.status).toBe(200);
      res = await auth(request(app).put(`${base}/pitch?season=1`)).send({ text: 'Season one pitch.' });
      expect(res.status).toBe(200);
      const [[row]] = await run('SELECT metadata::jsonb AS m FROM shows WHERE id = :show', ids);
      expect(row.m.keep_me).toBe(1);
      expect(row.m.season_pitches[ids.arc2].text).toBe('Line one.\nLine two.');
      expect(row.m.season_pitches[ids.arc1].text).toBe('Season one pitch.');
      expect((await auth(request(app).get(`${base}/pitch`))).body.saved.text).toBe('Line one.\nLine two.');
      res = await auth(request(app).put(`${base}/pitch`)).send({ text: '' });
      const [[after]] = await run('SELECT metadata::jsonb AS m FROM shows WHERE id = :show', ids);
      expect(after.m.season_pitches[ids.arc2]).toBeUndefined();
      expect(after.m.season_pitches[ids.arc1].text).toBe('Season one pitch.');
      expect(after.m.keep_me).toBe(1);
    });

    it('the budget refuses: a plain 429', async () => {
      mockCreate.mockRejectedValue(budget());
      const res = await post('ai/pitch');
      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/nothing changed/);
    });
  });
});
