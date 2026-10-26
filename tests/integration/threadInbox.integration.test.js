/**
 * The one threads list, and threads that open by themselves (Evoni,
 * 2026-10-26: "Let's let them open themselves on new threads and build the
 * threads list"; services/threadInbox, routes in routes/arcRoutes).
 *   - an event's seeds open once they pass the check; the same storyline is
 *     a note on its thread; one against a kept secret is left out; reading
 *     again opens nothing twice
 *   - a self-opened thread is marked new with Undo until Evoni looks at it;
 *     Undo is a soft delete; a left-out or undone thread can be kept after all
 *   - the plan: the slots to carry it on and pay it off, which she changes
 *   - the budget refuses: the plain check (a near title is the same thread)
 *   - a finished script's new threads open at the read; re-reading never duplicates
 *   - a short story's and the feed's threads wait: Keep / Merge into… / Drop;
 *     the feed proposal's own accept skips one decided here
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'u1', email: 'evoni@threads.dev' }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  authorize: () => (_req, _res, next) => next(),
}));
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const models = require('../../src/models');
const arcRouter = require('../../src/routes/arcRoutes');
const recordRouter = require('../../src/routes/bookFromShowRoutes');
const { seedArc } = require('../../src/services/arcProgressionService');
const { setRetryPause } = require('../../src/services/seasonAiContext');
const inbox = require('../../src/services/threadInbox');
const proposals = require('../../src/services/seasonArcProposals');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const answer = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('the threads list (threads open by themselves)', () => {
  const ids = {
    show: uuid(), ep: uuid(), ev: uuid(), brief: uuid(), reg: uuid(), maren: uuid(), ring: uuid(),
    thread: uuid(), story: uuid(), canon: uuid(), feed: uuid(),
  };
  const TAG = ids.show.slice(0, 8);
  let arcId;
  let profile;
  const app = express();
  app.use(express.json());
  app.use('/api/v1', arcRouter);
  app.use('/api/v1/book-from-show', recordRouter);
  const base = `/api/v1/world/${ids.show}/season/threads`;
  const list = async () => (await request(app).get(`${base}/inbox`)).body;
  const slotOf = async (n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;

  beforeAll(async () => {
    setRetryPause(0);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
    { show: ids.show, name: `Inbox ${TAG}`, slug: `inbox-${TAG}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show: ids.show });
    ({ arc_id: arcId } = await seedArc(ids.show, models));
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 3, 'draft', :script, NOW(), NOW())`,
    { ...ids, script: '## BEAT: 1 · Opening\nMAREN tucks her hand away before the photographer turns.\n\n## BEAT: 11 · The Moment\nLALA: Who sent the invitation with no name on it?' });
    await run('UPDATE season_slots SET episode_id = :ep WHERE arc_id = :arcId AND slot_number = 3', { ep: ids.ep, arcId });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Inbox ${TAG}` });
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, created_at, updated_at)
                             VALUES (:h, 'instagram', 'test', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `maren${TAG}` });
    profile = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, feed_profile_id, created_at, updated_at)
               VALUES (:maren, :reg, :k, 'Maren', 'Maren', 'support', 'accepted', :profile, NOW(), NOW())`, { ...ids, k: `inbox-${TAG}`, profile });
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, known_by, state, permissions, created_at, updated_at)
               VALUES (:ring, :maren, 'She sold the ring', '[]'::jsonb, 'hidden', '{"episode":"hidden","short_story":"hint","chapter":"reveal"}'::jsonb, NOW(), NOW())`, ids);
    const cc = { automation: { guest_profiles: [], host: null } };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, source_profile_id, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, 'Velour Gala', 'gala', 7, 'used', :ep, :profile, CAST(:cc AS jsonb), NOW(), NOW())`, { ...ids, profile, cc: JSON.stringify(cc) });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, narrative_chain, created_at, updated_at)
               VALUES (:brief, :ep, :show, :ev, 'draft', CAST(:chain AS jsonb), NOW(), NOW())`,
    { ...ids, chain: JSON.stringify({ seeds_future_events: [
      'Maison Belle wants Lala back for the spring show',
      { reason: 'Someone at the gala knows who sent the invitation' },
      'Maren is revealed to have sold the ring',
    ] }) });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, created_at, updated_at)
               VALUES (:thread, :show, 'Who sent the anonymous invitation?', 'open', NOW() - INTERVAL '1 day', NOW())`, ids);
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, approved_at, created_at, updated_at)
               VALUES (:ep, :show, 'approved', 'Maren hid her hand at the Velour Gala.', NOW(), NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 100));
    await run('DELETE FROM story_canon_proposals WHERE show_id = :show', ids);
    await run('DELETE FROM stories WHERE id = :story', ids);
    await run('DELETE FROM season_arc_proposals WHERE show_id = :show', ids);
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    await run('DELETE FROM episode_story_records WHERE episode_id = :ep', ids);
    await run('DELETE FROM episode_briefs WHERE id = :brief', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM season_slots WHERE show_id = :show', ids);
    await run('DELETE FROM show_arcs WHERE show_id = :show', ids);
    await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :ev', ids);
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id = :maren', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :profile', { profile });
    for (const t of ['character_state', 'career_goals', 'franchise_knowledge']) await run(`DELETE FROM ${t} WHERE show_id = :show`, ids).catch(() => {});
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('reads the event seeds: one opens, one is a note on its thread, one is left out; reading again does nothing', async () => {
    const before = await list();
    expect(before.needs_migration).toBe(false);
    expect(before.unchecked_seeds).toBe(3);
    mockCreate.mockResolvedValueOnce(answer({ items: [
      { n: 1, verdict: 'new', title: 'Will Maison Belle book Lala again?', why: 'Her first repeat client: the career climb.', part: 1, carry_slot: 5, payoff_slot: 7 },
      { n: 2, verdict: 'same', thread_id: ids.thread },
      { n: 3, verdict: 'contradicts', reason: 'Maren\'s ring secret is hidden in episodes; this reveals it.' },
    ] }));
    const res = await request(app).post(`${base}/inbox/seeds`);
    expect(res.status).toBe(200);
    expect(res.body.read).toEqual({ opened: 1, noted: 1, left_out: 1 });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
    expect(prompt).toContain(`[${ids.thread}] Who sent the anonymous invitation?`);
    expect(prompt).toContain('Maren: She sold the ring (the audience: hidden; an episode may: hidden)');
    expect(prompt).toContain('Maren hid her hand at the Velour Gala.');
    expect(prompt).toContain('came from the Velour Gala\'s seeds');
    expect(prompt).toContain('- E4: part 1');
    expect(prompt).not.toContain('- E3:');

    const again = await request(app).post(`${base}/inbox/seeds`);
    expect(again.body.read).toEqual({ opened: 0, noted: 0, left_out: 0 });
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const l = await list();
    expect(l.unchecked_seeds).toBe(0);
    const opened = l.threads.find((t) => t.title === 'Will Maison Belle book Lala again?');
    expect(opened).toMatchObject({
      status: 'open', opened_by_itself: true, seen: false, can_undo: true,
      origin: { kind: 'seed', label: 'From the Velour Gala\'s seeds' },
      why: 'Her first repeat client: the career climb.', part: { phase: 1 },
      plan: { carry: { slot_number: 5 }, payoff: { slot_number: 7 }, by: 'ai' },
    });
    const noted = l.threads.find((t) => t.id === ids.thread);
    expect(noted).toMatchObject({ status: 'open', opened_by_itself: false, can_undo: false, notes_count: 1 });
    expect(noted.notes[0]).toMatchObject({ text: 'Someone at the gala knows who sent the invitation', label: 'From the Velour Gala\'s seeds', can_undo: true });
    expect(l.left_out).toEqual([expect.objectContaining({ kind: 'thread', title: 'Maren is revealed to have sold the ring', reason: 'Maren\'s ring secret is hidden in episodes; this reveals it.', undone: false })]);
    // The old drafts route no longer offers a seed that was read.
    const drafts = (await request(app).get(base)).body.drafts;
    expect(drafts.map((d) => d.seed_text)).not.toContain('Maison Belle wants Lala back for the spring show');
  });

  it('Undo is a soft delete until she looks; a left-out or undone one can be kept after all', async () => {
    let l = await list();
    const opened = l.threads.find((t) => t.opened_by_itself);
    expect((await request(app).post(`${base}/${opened.id}/undo`)).status).toBe(200);
    l = await list();
    expect(l.threads.find((t) => t.id === opened.id)).toBeUndefined();
    expect(l.left_out.find((x) => x.id === opened.id)).toMatchObject({ reason: 'You undid it.', undone: true });
    const [[row]] = await run('SELECT deleted_at, story_meta FROM show_story_threads WHERE id = :id', { id: opened.id });
    expect(row.deleted_at).not.toBeNull();
    expect(row.story_meta.undone_at).toBeTruthy();
    // Kept after all: it opens as hers, seen.
    expect((await request(app).post(`${base}/${opened.id}/restore`)).status).toBe(200);
    l = await list();
    expect(l.threads.find((t) => t.id === opened.id)).toMatchObject({ opened_by_itself: false, seen: true, can_undo: false });
    expect((await request(app).post(`${base}/${opened.id}/undo`)).status).toBe(409);
    // The note on the older thread: Undo takes it away.
    const noted = l.threads.find((t) => t.id === ids.thread);
    expect((await request(app).post(`${base}/${ids.thread}/notes/${noted.notes[0].key}/undo`)).status).toBe(200);
    expect((await list()).threads.find((t) => t.id === ids.thread).notes_count).toBe(0);
    expect((await request(app).post(`${base}/not-a-uuid/undo`)).status).toBe(400);
  });

  it('the plan: she changes the slots; the payoff comes after the one that carries it on', async () => {
    const [s4, s9] = [await slotOf(4), await slotOf(9)];
    expect((await request(app).put(`${base}/${ids.thread}/plan`).send({ carry_slot_id: s9, payoff_slot_id: s4 })).status).toBe(400);
    expect((await request(app).put(`${base}/${ids.thread}/plan`).send({ carry_slot_id: s4, payoff_slot_id: s9 })).status).toBe(200);
    const t = (await list()).threads.find((x) => x.id === ids.thread);
    expect(t.plan).toMatchObject({ carry: { slot_number: 4 }, payoff: { slot_number: 9 }, by: 'evoni' });
    // "Make it a season twist": the existing twists route, prefilled from the plan.
    const twist = await request(app).put(`/api/v1/world/${ids.show}/season/twists`).send({ title: t.title, plant_slot_id: s4, payoff_slot_id: s9, thread_ids: [ids.thread] });
    expect(twist.status).toBe(200);
    expect((await list()).threads.find((x) => x.id === ids.thread).twists).toEqual([expect.objectContaining({ title: t.title, status: 'planned' })]);
  });

  it('the budget refuses: the plain check, a near title is the same thread and anything else opens', async () => {
    const refusal = Object.assign(new Error('Daily AI budget reached'), { code: 'AI_BUDGET_EXCEEDED' });
    mockCreate.mockRejectedValue(refusal);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const season = await inbox.seasonFor(sequelize, ids.show);
    const out = await inbox.checkCandidates(sequelize, ids.show, [
      { title: 'Who sent the invitation? The anonymous one' },
      { title: 'Does Mo forgive Lala?' },
    ], { season, episodeId: ids.ep });
    expect(mockCreate).toHaveBeenCalledTimes(1); // never a second try after a budget refusal
    expect(out[0]).toMatchObject({ verdict: 'same', thread_id: ids.thread, by: 'plain' });
    expect(out[1]).toMatchObject({ verdict: 'new', by: 'plain', plan: { carry_slot_id: await slotOf(4) } });
  });

  it('a finished script: its new thread opens at the read, with Undo on the card; reading again never duplicates', async () => {
    const draft = {
      what_happened: 'Lala asked about the invitation.',
      threads: [{ thread_id: null, action: 'new', title: 'Is the photographer working for someone?', note: 'He turned away on cue', quote: 'MAREN tucks her hand away before the photographer turns.' }],
    };
    mockCreate.mockResolvedValueOnce(answer(draft)).mockResolvedValueOnce(answer({ items: [
      { n: 1, verdict: 'new', why: 'A watcher at every event raises the stakes.', part: 1, carry_slot: 4, payoff_slot: 8 },
    ] }));
    const res = await request(app).post(`/api/v1/book-from-show/episodes/${ids.ep}/record/draft`);
    expect(res.status).toBe(200);
    const key = res.body.record.threads[0].key;
    expect(res.body.thread_states[key]).toMatchObject({ state: 'opened', can_undo: true, why: 'A watcher at every event raises the stakes.' });
    const t = (await list()).threads.find((x) => x.title === 'Is the photographer working for someone?');
    expect(t).toMatchObject({ origin: { kind: 'script', label: 'From E3\'s script, beat 1' }, opened_by_itself: true, plan: { carry: { slot_number: 4 }, payoff: { slot_number: 8 } } });

    // Read again: the same title keeps its key, so nothing new is asked or opened.
    mockCreate.mockResolvedValueOnce(answer(draft));
    const again = await request(app).post(`/api/v1/book-from-show/episodes/${ids.ep}/record/draft`);
    expect(again.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(again.body.record.threads[0].key).toBe(key);
    const [[n]] = await run("SELECT COUNT(*)::int AS n FROM show_story_threads WHERE show_id = :show AND title = 'Is the photographer working for someone?'", ids);
    expect(n.n).toBe(1);
    // Undo from the card; Save does not write it again.
    expect((await request(app).post(`${base}/${t.id}/undo`)).status).toBe(200);
    const after = await request(app).get(`/api/v1/book-from-show/episodes/${ids.ep}/record`);
    expect(after.body.thread_states[key]).toMatchObject({ state: 'undone', can_undo: false });
    const saved = await request(app).post(`/api/v1/book-from-show/episodes/${ids.ep}/record/approve`);
    expect(saved.status).toBe(200);
    expect(saved.body.result.written.filter((w) => w.kind === 'thread')).toEqual([]);
  });

  it('a short story\'s and the feed\'s threads wait: Merge into… and Keep; the feed\'s own accept skips one decided here', async () => {
    await run(`INSERT INTO stories (id, show_id, episode_id, title, content, word_count, format, source_type, status, created_at, updated_at)
               VALUES (:story, :show, :ep, 'After the Gala', 'Maren walked home.', 3, 'short_story', 'episode', 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO story_canon_proposals (id, story_id, episode_id, show_id, kind, payload, status, created_at, updated_at)
               VALUES (:canon, :story, :ep, :show, 'thread', CAST(:payload AS jsonb), 'pending', NOW(), NOW())`,
    { ...ids, payload: JSON.stringify({ thread_id: null, title: 'Who sent that anonymous invitation?', note: 'Maren saw the envelope' }) });
    await run(`INSERT INTO season_arc_proposals (id, show_id, arc_id, status, trigger, signals, signals_hash, summary, changes, created_at, updated_at)
               VALUES (:feed, :show, :arcId, 'proposed', 'manual', '{}'::jsonb, 'h', 'The feed moved.', CAST(:changes AS jsonb), NOW(), NOW())`,
    { ...ids, arcId, changes: JSON.stringify([
      { kind: 'thread_open', title: 'Does @velour go public about Lala?', description: 'Their followers doubled', why: '@velour +200' },
      { kind: 'phase_theme', phase: 1, tagline: 'Rising', why: 'growth' },
    ]) });
    // The check reads them, and keeps its verdict with each.
    mockCreate.mockResolvedValueOnce(answer({ items: [
      { n: 1, verdict: 'same', thread_id: ids.thread },
      { n: 2, verdict: 'new', why: 'A public rival on the feed.', part: 1 },
    ] }));
    expect(await inbox.checkWaiting(sequelize, ids.show)).toBe(2);
    let l = await list();
    expect(l.waiting).toEqual([
      expect.objectContaining({ source: 'short_story', id: ids.canon, label: 'From a short story: After the Gala (E3)', suggest_into: ids.thread }),
      expect.objectContaining({ source: 'feed', id: ids.feed, index: 0, label: 'From the feed', why: 'A public rival on the feed.', suggest_into: null }),
    ]);
    const merge = await request(app).post(`${base}/suggestions/decide`).send({ source: 'short_story', id: ids.canon, action: 'merge', into: ids.thread });
    expect(merge.status).toBe(200);
    const [[canon]] = await run('SELECT status, decided_by FROM story_canon_proposals WHERE id = :canon', ids);
    expect(canon).toEqual({ status: 'accepted', decided_by: 'evoni@threads.dev' });
    const keep = await request(app).post(`${base}/suggestions/decide`).send({ source: 'feed', id: ids.feed, index: 0, action: 'keep' });
    expect(keep.status).toBe(200);
    expect((await request(app).post(`${base}/suggestions/decide`).send({ source: 'feed', id: ids.feed, index: 0, action: 'drop' })).status).toBe(409);
    l = await list();
    expect(l.waiting).toEqual([]);
    expect(l.threads.find((t) => t.id === keep.body.thread_id)).toMatchObject({ origin: { kind: 'feed', label: 'From the feed' }, why: 'A public rival on the feed.' });
    const t = l.threads.find((x) => x.id === ids.thread);
    expect(t).toMatchObject({ status: 'advanced' });
    expect(t.notes[0]).toMatchObject({ text: 'Maren saw the envelope', label: 'From a short story: After the Gala', can_undo: false });
    // The feed's own accept: the change decided here is skipped, the rest applies.
    const accepted = await proposals.accept(models, ids.show, ids.feed, {});
    expect(accepted.applied[0]).toMatchObject({ index: 0, skipped: true, taken: 'kept' });
    expect(accepted.applied[1]).toMatchObject({ index: 1, ok: true });
    const [[c]] = await run("SELECT COUNT(*)::int AS n FROM show_story_threads WHERE show_id = :show AND title = 'Does @velour go public about Lala?'", ids);
    expect(c.n).toBe(1);
  });

  it('seen: "New" and its Undo end', async () => {
    const [[row]] = await run(`INSERT INTO show_story_threads (id, show_id, title, status, story_meta, created_at, updated_at)
                               VALUES (gen_random_uuid(), :show, 'A fresh one', 'open', '{"opened_by":"itself","notes":[]}'::jsonb, NOW(), NOW()) RETURNING id`, ids);
    expect((await list()).threads.find((t) => t.id === row.id)).toMatchObject({ seen: false, can_undo: true });
    expect((await request(app).post(`${base}/seen`).send({ thread_ids: [row.id] })).body.seen).toBe(1);
    expect((await list()).threads.find((t) => t.id === row.id)).toMatchObject({ seen: true, can_undo: false });
    expect((await request(app).post(`${base}/${row.id}/undo`)).status).toBe(409);
  });
});
