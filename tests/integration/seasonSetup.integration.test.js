/**
 * Setting up a season (Evoni, 2026-10-24, the Season Plan's PR 1): the
 * "Set up the season" form and Edit season, Season 2 after a completed
 * season, "Use your events and episodes" (preview, then Save in one
 * transaction), and "Draft the season" in one AI call with Accept.
 * On the test database, through the routes; the SDK is mocked.
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
const { normaliseSetup } = require('../../src/services/seasonSetupService');
const { placeEpisode, pencilEvent } = require('../../src/services/seasonSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

const FORM = {
  title: 'Velvet Season',
  tagline: 'Lala builds her own room',
  phases: [
    { title: 'Doors', tagline: 'Get in' },
    { title: 'Rooms', tagline: 'Hold the room' },
    { title: 'Keys', tagline: 'Own the house' },
  ],
  split: [6, 10, 8],
};

(shouldSkip ? describe.skip : describe)('Setting up a season (Season Plan PR 1)', () => {
  const shows = [];
  let admin;
  let editor;
  const as = (token) => (r) => r.set('Authorization', `Bearer ${token}`);
  const auth = (r) => as(admin)(r);

  async function newShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Setup ${show.slice(0, 8)}`, slug: `setup-${show.slice(0, 8)}` });
    return show;
  }
  const seed = (show, body = FORM) => auth(request(app).post(`/api/v1/world/${show}/arc/seed`)).send(body);
  // Set-up steps a test is not about go straight to the services, so the
  // suite stays under the app's 60-writes-a-minute limit.
  const seedDirect = (show, body = FORM) => seedArc(show, models, { setup: normaliseSetup(body) });
  const placeDirect = async (show, n, episodeId) => placeEpisode(sequelize, show, await slotId(show, n), episodeId);
  const pencilDirect = async (show, n, eventId) => pencilEvent(sequelize, show, await slotId(show, n), eventId);
  const editDirect = (slot, purpose) => run(
    `UPDATE season_slots SET story_purpose = :purpose, intention_source = 'edited' WHERE id = :slot`, { slot, purpose });
  const edit = (show, body) => auth(request(app).put(`/api/v1/world/${show}/arc/setup`)).send(body);
  const getArc = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/arc`))).body;
  const roadmap = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
  const slotRows = (show) => rows(
    `SELECT s.id, s.slot_number, s.phase, s.season_number, s.event_id, s.episode_id, s.locked_at, s.story_purpose, s.intention_source,
            s.desired_pressure, s.story_thread_id
       FROM season_slots s JOIN show_arcs a ON a.id = s.arc_id AND a.status = 'active'
      WHERE s.show_id = :show AND s.deleted_at IS NULL ORDER BY s.slot_number`, { show });
  const slotId = async (show, n) => (await slotRows(show)).find((s) => s.slot_number === n).id;
  async function addEvent(show, name, { status = 'draft', date = null, usedIn = null, host = null, prestige = 5 } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, event_date, used_in_episode_id, host, prestige, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, :date, :usedIn, :host, :prestige, NOW(), NOW())`,
    { id, show, name, status, date, usedIn, host, prestige });
    return id;
  }
  async function addEpisode(show, title, number) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, :number, 'draft', NOW(), NOW())`, { id, show, title, number });
    return id;
  }
  async function addThread(show, title, status = 'open') {
    const id = uuid();
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, source, created_at, updated_at)
               VALUES (:id, :show, :title, :status, 'manual', NOW(), NOW())`, { id, show, title, status });
    return id;
  }

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-season-setup', email: 'evoni@season-setup.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-season-setup-ed', email: 'ed@season-setup.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM show_story_threads WHERE show_id = :show', { show });
      await run(`DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  // ── The form ──────────────────────────────────────────────────────────

  test('seeding takes the form: title, tagline, part names and taglines, and the split', async () => {
    const show = await newShow();
    const res = await seed(show);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ season_number: 1, phases: 3, slots: 24 }));

    const { arc, next_season_number: next } = await getArc(show);
    expect([arc.title, arc.tagline, arc.season_number, arc.arc_number, next]).toEqual(['Velvet Season', 'Lala builds her own room', 1, 1, 2]);
    expect(arc.phases.map((p) => [p.title, p.tagline, p.episode_start, p.episode_end, p.status]))
      .toEqual([['Doors', 'Get in', 1, 6, 'active'], ['Rooms', 'Hold the room', 7, 16, 'upcoming'], ['Keys', 'Own the house', 17, 24, 'upcoming']]);
    const slots = await slotRows(show);
    expect(slots).toHaveLength(24);
    expect([6, 7, 16, 17].map((n) => slots[n - 1].phase)).toEqual([1, 2, 2, 3]);
    const map = await roadmap(show);
    expect(map.phases.map((p) => p.slots.length)).toEqual([6, 10, 8]);
  });

  test('an empty body still seeds the defaults (8 / 8 / 8, Season 1 wording)', async () => {
    const show = await newShow();
    const res = await auth(request(app).post(`/api/v1/world/${show}/arc/seed`)).send({});
    expect(res.status).toBe(201);
    const { arc } = await getArc(show);
    expect(arc.title).toBe('Soft Luxury Ascension');
    expect(arc.phases.map((p) => [p.episode_start, p.episode_end])).toEqual([[1, 8], [9, 16], [17, 24]]);
  });

  test.each([
    [{ ...FORM, split: [8, 8, 7] }, 'add up to 24 episodes; these add up to 23'],
    [{ ...FORM, split: [0, 12, 12] }, 'at least one episode'],
    [{ ...FORM, split: [8, 8] }, 'needs 3 numbers'],
    [{ ...FORM, split: [8.5, 7.5, 8] }, 'whole number'],
    [{ ...FORM, title: '  ' }, 'needs a title'],
    [{ ...FORM, phases: [FORM.phases[0], { title: '' }, FORM.phases[2]] }, 'Part 2 needs a name'],
  ])('the form is refused with a clear reason (%#)', async (body, reason) => {
    const show = await newShow();
    const res = await seed(show, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(reason);
    expect(await rows('SELECT id FROM show_arcs WHERE show_id = :show', { show })).toEqual([]);
  });

  test('seeding again while a season is in progress is refused', async () => {
    const show = await newShow();
    await seed(show);
    const res = await seed(show, { ...FORM, title: 'Second' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Season 1 is still in progress/);
    expect(await rows('SELECT id FROM show_arcs WHERE show_id = :show', { show })).toHaveLength(1);
  });

  test('the setup writes need an admin; reading the preview does not', async () => {
    const show = await newShow();
    const asEditor = as(editor);
    expect((await asEditor(request(app).post(`/api/v1/world/${show}/arc/seed`)).send(FORM)).status).toBe(403);
    await seed(show);
    expect((await asEditor(request(app).put(`/api/v1/world/${show}/arc/setup`)).send(FORM)).status).toBe(403);
    expect((await asEditor(request(app).post(`/api/v1/world/${show}/season/placement`)).send({ items: [] })).status).toBe(403);
    expect((await asEditor(request(app).post(`/api/v1/world/${show}/season/draft`)).send({})).status).toBe(403);
    expect((await asEditor(request(app).post(`/api/v1/world/${show}/season/draft/accept`)).send({ drafts: [] })).status).toBe(403);
    expect((await asEditor(request(app).get(`/api/v1/world/${show}/season/placement`))).status).toBe(200);
  });

  // ── Edit season ───────────────────────────────────────────────────────

  test('Edit season renames and re-phases the slots that have not started', async () => {
    const show = await newShow();
    await seedDirect(show);
    const res = await edit(show, { ...FORM, title: 'Velvet, Renamed', phases: [{ title: 'Doors' }, { title: 'Halls', tagline: 'Walk them' }, { title: 'Keys' }], split: [9, 7, 8] });
    expect(res.status).toBe(200);
    expect(res.body.moved).toBe(3); // E7, E8, E9 move from Part 2 to Part 1
    const { arc } = await getArc(show);
    expect([arc.title, arc.phases[1].title, arc.phases[1].tagline, arc.phases[0].tagline]).toEqual(['Velvet, Renamed', 'Halls', 'Walk them', null]);
    expect(arc.phases.map((p) => [p.episode_start, p.episode_end])).toEqual([[1, 9], [10, 16], [17, 24]]);
    const slots = await slotRows(show);
    expect([7, 9, 10].map((n) => slots[n - 1].phase)).toEqual([1, 1, 2]);
  });

  test('a split that would move a started episode out of its part is refused, and nothing changes', async () => {
    const show = await newShow();
    await seedDirect(show); // 6 / 10 / 8: E7 is in Part 2
    const ep = await addEpisode(show, 'The Gallery', 1);
    await placeDirect(show, 7, ep);

    const refused = await edit(show, { ...FORM, title: 'Changed', split: [8, 8, 8] });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('SEASON_SPLIT_MOVES_STARTED');
    expect(refused.body.error).toContain('E7 ("The Gallery") has started in Part 2 (Rooms)');
    expect(refused.body.error).toContain('keeps its part');
    const { arc } = await getArc(show);
    expect([arc.title, arc.phases[0].episode_end]).toEqual(['Velvet Season', 6]);
    expect((await slotRows(show))[7].phase).toBe(2);

    // A split that keeps E7 in Part 2 is fine, and the episode's snapshot takes the new name.
    const ok = await edit(show, { ...FORM, phases: [FORM.phases[0], { title: 'Rooms Renamed' }, FORM.phases[2]], split: [5, 11, 8] });
    expect(ok.status).toBe(200);
    const [{ season_context: ctx }] = await rows('SELECT season_context FROM episodes WHERE id = :ep', { ep });
    expect(ctx.phase.title).toBe('Rooms Renamed');
  });

  test('a finished part keeps its episodes', async () => {
    const show = await newShow();
    await seedDirect(show);
    const [{ id, phases }] = await rows('SELECT id, phases FROM show_arcs WHERE show_id = :show', { show });
    phases[0].status = 'completed';
    await run('UPDATE show_arcs SET phases = CAST(:p AS jsonb), current_phase = 2 WHERE id = :id', { p: JSON.stringify(phases), id });
    const res = await edit(show, { ...FORM, split: [7, 9, 8] });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Part 1 (Doors) is finished, so it keeps E1–E6');
  });

  // ── Season 2 ──────────────────────────────────────────────────────────

  test('after a season is complete, the next is Season 2 with its own slots and labels', async () => {
    const show = await newShow();
    await seedDirect(show);
    await run(`UPDATE show_arcs SET status = 'completed' WHERE show_id = :show`, { show });
    const done = await getArc(show);
    expect([done.arc.status, done.arc.season_number, done.next_season_number]).toEqual(['completed', 1, 2]);

    const res = await seed(show, { ...FORM, title: 'Season Two Title', split: [8, 8, 8] });
    expect(res.status).toBe(201);
    expect(res.body.season_number).toBe(2);
    const { arc } = await getArc(show);
    expect([arc.title, arc.season_number, arc.arc_number, arc.status]).toEqual(['Season Two Title', 2, 2, 'active']);
    const map = await roadmap(show);
    expect([map.season_number, map.phases[0].slots[0].label, map.slot_count]).toEqual([2, 'S2 · E1', 24]);
    expect((await slotRows(show)).every((s) => s.season_number === 2)).toBe(true);
  });

  test('a deleted season does not block seeding again, and its number is used again', async () => {
    const show = await newShow();
    await seedDirect(show);
    await run('UPDATE show_arcs SET deleted_at = NOW() WHERE show_id = :show', { show });
    const res = await seed(show);
    expect(res.status).toBe(201);
    expect(res.body.season_number).toBe(1);
    const live = await rows('SELECT arc_number, season_number FROM show_arcs WHERE show_id = :show AND deleted_at IS NULL', { show });
    expect(live).toEqual([{ arc_number: 2, season_number: 1 }]);
  });

  // ── Use your events and episodes ──────────────────────────────────────

  async function placementShow() {
    const show = await newShow();
    await seedDirect(show, { ...FORM, split: [8, 8, 8] });
    const second = await addEpisode(show, 'Second Made', 2);
    const first = await addEpisode(show, 'First Made', 1);
    const firstEvent = await addEvent(show, 'First Made Event', { status: 'used', usedIn: first, date: '2026-01-01' });
    const late = await addEvent(show, 'Late Dated', { date: '2026-12-20' });
    const early = await addEvent(show, 'Early Dated', { date: '2026-11-02', status: 'ready' });
    const mid = await addEvent(show, 'Mid Dated', { date: '2026-11-15' });
    const freeText = await addEvent(show, 'Free Text Date', { date: 'Saturday night' });
    const undated = await addEvent(show, 'Undated Gala', { prestige: 3 });
    const archived = await addEvent(show, 'Archived One', { status: 'archived', date: '2026-10-30' });
    return { show, first, second, firstEvent, late, early, mid, freeText, undated, archived };
  }

  test('the preview: episodes in episode order with their events, then dated events by date, then undated by fit; nothing written', async () => {
    const t = await placementShow();
    const res = await auth(request(app).get(`/api/v1/world/${t.show}/season/placement`));
    expect(res.status).toBe(200);
    const items = res.body.items.map((i) => [i.label, i.kind, i.episode?.title || null, i.event?.name || null]);
    expect(items).toEqual([
      ['S1 · E1', 'episode', 'First Made', 'First Made Event'],
      ['S1 · E2', 'episode', 'Second Made', null],
      ['S1 · E3', 'event', null, 'Early Dated'],
      ['S1 · E4', 'event', null, 'Mid Dated'],
      ['S1 · E5', 'event', null, 'Late Dated'],
      ['S1 · E6', 'event', null, expect.any(String)],
      ['S1 · E7', 'event', null, expect.any(String)],
    ]);
    expect(new Set(res.body.items.slice(5).map((i) => i.event.name))).toEqual(new Set(['Free Text Date', 'Undated Gala']));
    expect(res.body.items[2].why).toContain('Dated 2026-11-02');
    expect(res.body.items[5].why).toMatch(/^Undated/);
    expect(res.body.open_slots).toHaveLength(24);
    expect(res.body.left_over).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('Archived One');
    // Nothing applied yet.
    expect((await slotRows(t.show)).every((s) => !s.event_id && !s.episode_id)).toBe(true);
  });

  test('a slot with an event already pencilled is not offered, and what does not fit is left over', async () => {
    const show = await newShow();
    await seedDirect(show);
    const ids = [];
    for (let i = 1; i <= 25; i += 1) ids.push(await addEvent(show, `Ev ${String(i).padStart(2, '0')}`, { date: `2026-11-${String(i).padStart(2, '0')}` }));
    await pencilDirect(show, 1, ids[24]);
    const res = await auth(request(app).get(`/api/v1/world/${show}/season/placement`));
    expect(res.body.items[0].label).toBe('S1 · E2');
    expect(res.body.items).toHaveLength(23);
    expect(res.body.left_over.map((l) => l.event.name)).toEqual(['Ev 24']);
  });

  test('Save applies the list (moved and removed items too) in one transaction through the slot rules', async () => {
    const t = await placementShow();
    const preview = (await auth(request(app).get(`/api/v1/world/${t.show}/season/placement`))).body;
    const s20 = await slotId(t.show, 20);
    const items = preview.items
      .filter((i) => i.event?.name !== 'Mid Dated') // removed
      .map((i) => ({ slot_id: i.event?.name === 'Late Dated' ? s20 : i.slot_id, episode_id: i.kind === 'episode' ? i.episode.id : undefined, event_id: i.kind === 'event' ? i.event.id : undefined }));
    const res = await auth(request(app).post(`/api/v1/world/${t.show}/season/placement`)).send({ items });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ placed: 6, episodes: 2, events: 4 }));
    const slots = await slotRows(t.show);
    expect([slots[0].episode_id, slots[0].event_id, Boolean(slots[0].locked_at)]).toEqual([t.first, t.firstEvent, true]);
    expect(slots[1].episode_id).toBe(t.second);
    expect(slots[2].event_id).toBe(t.early);
    expect(slots[3].event_id).toBeNull();
    expect(slots[19].event_id).toBe(t.late);
    const [{ season_context: ctx }] = await rows('SELECT season_context FROM episodes WHERE id = :id', { id: t.first });
    expect(ctx.label).toBe('S1 · E1');
  });

  test('one refusal undoes the whole Save', async () => {
    const t = await placementShow();
    const items = [
      { slot_id: await slotId(t.show, 1), episode_id: t.first },
      { slot_id: await slotId(t.show, 2), event_id: t.early },
      { slot_id: await slotId(t.show, 3), event_id: t.archived },
    ];
    const res = await auth(request(app).post(`/api/v1/world/${t.show}/season/placement`)).send({ items });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Archived One');
    expect((await slotRows(t.show)).every((s) => !s.event_id && !s.episode_id)).toBe(true);

    const twice = await auth(request(app).post(`/api/v1/world/${t.show}/season/placement`))
      .send({ items: [{ slot_id: items[0].slot_id, event_id: t.early }, { slot_id: items[0].slot_id, event_id: t.mid }] });
    expect(twice.status).toBe(400);
    expect(twice.body.error).toContain('same slot');
  });

  // ── Draft the season ──────────────────────────────────────────────────

  async function draftShow() {
    const show = await newShow();
    await seedDirect(show, { ...FORM, split: [8, 8, 8] });
    const thread = await addThread(show, 'Who sent the invitation?');
    const closed = await addThread(show, 'The old rent', 'closed');
    const ep = await addEpisode(show, 'The Brunch', 1);
    await placeDirect(show, 1, ep);
    const gala = await addEvent(show, 'Velour Gala', { date: '2026-11-20' });
    await pencilDirect(show, 4, gala);
    await editDirect(await slotId(show, 3), 'Mine, hand-written');
    return { show, thread, closed };
  }
  const all = (overrides = {}) => Array.from({ length: 24 }, (_, i) => ({
    slot_number: i + 1, story_purpose: `Purpose ${i + 1}`, desired_pressure: 'medium', story_thread_id: null, ...(overrides[i + 1] || {}),
  }));

  test('one call drafts the open slots; edited and started slots are never offered; invented threads are dropped; nothing is saved', async () => {
    const t = await draftShow();
    mockCreate.mockResolvedValue(say({ slots: all({ 2: { story_thread_id: t.thread }, 5: { story_thread_id: 'made-up-thread' }, 6: { story_thread_id: t.closed }, 7: { desired_pressure: 'Extreme' } }) }));
    const res = await auth(request(app).post(`/api/v1/world/${t.show}/season/draft`)).send({});
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe(require('../../src/services/seasonSetupService').MODELS[0]);
    const prompt = call.messages[0].content;
    expect(prompt).toContain('"Velvet Season" — Lala builds her own room');
    expect(prompt).toContain('Part 2: Rooms ("Hold the room"), E9–E16');
    expect(prompt).toContain('event "Velour Gala" (invite) on 2026-11-20');
    expect(prompt).toContain('episode "The Brunch"');
    expect(prompt).toContain(`id ${t.thread}: Who sent the invitation?`);
    expect(prompt).not.toContain('The old rent');
    expect(prompt).toMatch(/E2 \(Part 1\): open \[DRAFT THIS\]/);
    expect(prompt).not.toMatch(/E1 \(Part 1\).*\[DRAFT THIS\]/);

    const numbers = res.body.drafts.map((d) => d.slot_number);
    expect(numbers).not.toContain(1); // started
    expect(numbers).not.toContain(3); // edited
    expect(numbers).toHaveLength(22);
    expect(res.body.skipped).toEqual([
      expect.objectContaining({ slot_number: 1, reason: 'started' }),
      expect.objectContaining({ slot_number: 3, reason: 'edited' }),
    ]);
    const by = Object.fromEntries(res.body.drafts.map((d) => [d.slot_number, d]));
    expect([by[2].story_thread_id, by[2].story_thread_title]).toEqual([t.thread, 'Who sent the invitation?']);
    expect([by[5].story_thread_id, by[6].story_thread_id, res.body.dropped_threads]).toEqual([null, null, 2]);
    expect([by[2].desired_pressure, by[7].desired_pressure]).toEqual(['Medium', null]);
    // Nothing saved.
    const slots = await slotRows(t.show);
    expect(slots.filter((s) => s.story_purpose).map((s) => s.slot_number)).toEqual([3]);
  });

  test('"Draft this part" offers only that part', async () => {
    const t = await draftShow();
    mockCreate.mockResolvedValue(say({ slots: all() }));
    const res = await auth(request(app).post(`/api/v1/world/${t.show}/season/draft`)).send({ phase: 2 });
    expect(res.status).toBe(200);
    expect(res.body.drafts.map((d) => d.slot_number)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('Draft the open slots of Part 2');
    expect((await auth(request(app).post(`/api/v1/world/${t.show}/season/draft`)).send({ phase: 4 })).status).toBe(400);
  });

  test('a budget refusal is not retried; another failure is tried twice', async () => {
    const t = await draftShow();
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const refused = await auth(request(app).post(`/api/v1/world/${t.show}/season/draft`)).send({});
    expect(refused.status).toBe(429);
    expect(refused.body.error).toContain('Nothing was drafted');
    expect(mockCreate).toHaveBeenCalledTimes(1);

    mockCreate.mockReset();
    mockCreate.mockRejectedValue(new Error('overloaded'));
    const failed = await auth(request(app).post(`/api/v1/world/${t.show}/season/draft`)).send({});
    expect(failed.status).toBe(502);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('when every slot is edited or started there is nothing to draft, and no call is made', async () => {
    const show = await newShow();
    await seedDirect(show);
    const slots = await slotRows(show);
    for (const s of slots.filter((x) => x.phase === 3)) await editDirect(s.id, `Mine ${s.slot_number}`);
    const res = await auth(request(app).post(`/api/v1/world/${show}/season/draft`)).send({ phase: 3 });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('nothing to draft');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('accepted drafts are saved as Auto-drafted through the intention path; a slot edited since is skipped', async () => {
    const t = await draftShow();
    const s2 = await slotId(t.show, 2);
    const s5 = await slotId(t.show, 5);
    const s3 = await slotId(t.show, 3);
    await run(`UPDATE season_slots SET career_focus = 'reputation' WHERE id = :id`, { id: s5 });
    const res = await auth(request(app).post(`/api/v1/world/${t.show}/season/draft/accept`)).send({ drafts: [
      { slot_id: s2, story_purpose: 'Lala finds the invitation', desired_pressure: 'High', story_thread_id: t.thread },
      { slot_id: s5, story_purpose: 'The gala aftermath', desired_pressure: 'Low' },
      { slot_id: s3, story_purpose: 'Would overwrite hers', desired_pressure: 'Peak' },
    ] });
    expect(res.status).toBe(200);
    expect(res.body.saved).toEqual([2, 5]);
    expect(res.body.skipped).toEqual([expect.objectContaining({ slot_number: 3, reason: 'edited' })]);
    const slots = await slotRows(t.show);
    expect([slots[1].story_purpose, slots[1].desired_pressure, slots[1].story_thread_id, slots[1].intention_source])
      .toEqual(['Lala finds the invitation', 'High', t.thread, 'auto-drafted']);
    expect(slots[2].story_purpose).toBe('Mine, hand-written');
    const [{ career_focus: focus }] = await rows('SELECT career_focus FROM season_slots WHERE id = :id', { id: s5 });
    expect(focus).toBe('reputation');

    const closedThread = await auth(request(app).post(`/api/v1/world/${t.show}/season/draft/accept`))
      .send({ drafts: [{ slot_id: s2, story_purpose: 'x', story_thread_id: t.closed }] });
    expect(closedThread.status).toBe(409);
  });
});
