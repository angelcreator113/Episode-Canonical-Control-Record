/**
 * The Episode Story Record (stage C; services/episodeStoryRecord, routes in
 * routes/bookFromShowRoutes): drafted from the episode and kept to its cast,
 * their secrets and the open threads; edited; approved, which moves the
 * secrets on with the audience; and read by the chapter writer once approved.
 * The "What changed" card (Evoni, 2026-10-23): Lala and unlinked guests are
 * in the cast; the draft proposes goals, relationships, follow-ups and
 * thread actions; Save writes each kept one once, and skips a person who is
 * not in the registry.
 *
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });
jest.mock('../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1', email: 'evoni@record.dev' }; next(); } }));
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
// The Pulse suggestions a Save starts (services/storyRipples) are their own test's; here they only count.
jest.mock('../../src/services/storyRipples', () => ({ proposeLater: jest.fn((_s, { changes }) => (changes.length ? 3 : 0)) }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { sequelize } = require('../../src/models');
const router = require('../../src/routes/bookFromShowRoutes');
const { recordBlock } = require('../../src/services/episodeStoryRecord');
const relationshipTruth = require('../../src/services/relationshipTruth');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const answer = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('the Episode Story Record', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), ep: crypto.randomUUID(), bare: crypto.randomUUID(), ev: crypto.randomUUID(), reg: crypto.randomUUID(),
    maren: crypto.randomUUID(), mo: crypto.randomUUID(), ring: crypto.randomUUID(), rent: crypto.randomUUID(), thread: crypto.randomUUID(),
    book: crypto.randomUUID(), ch: crypto.randomUUID(),
    lala: crypto.randomUUID(), marcus: crypto.randomUUID(), todo: crypto.randomUUID(),
  };
  let profile;
  let truth;
  let studio;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/book-from-show', router);
  const base = `/api/v1/book-from-show/episodes/${ids.ep}/record`;

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Record ${TAG}`, slug: `record-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at) VALUES
               (:ep, :show, 'The Gala', 4, 'draft', :script, NOW(), NOW()),
               (:bare, :show, 'Nothing yet', 5, 'draft', NULL, NOW(), NOW())`,
    { ...ids, script: '## BEAT: 1 · Opening\nMAREN tucks her hand away before the photographer turns.\n\n## BEAT: 11 · The Moment\nMARCUS HALE: So you are the Lala everyone follows.\nLALA: And you are the one I came here to get to know.' });
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, created_at, updated_at)
                             VALUES (:h, 'instagram', 'test', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `maren${TAG}` });
    profile = p.id;
    const [[t]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, creator_name, created_at, updated_at)
                             VALUES (:h, 'instagram', 'test', 'lalaverse', 'Truthville', 'Marcus Hale', NOW(), NOW()) RETURNING id`, { h: `truth${TAG}` });
    truth = t.id;
    const [[st]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, created_at, updated_at)
                              VALUES (:h, 'instagram', 'test', 'lalaverse', 'Studio Bystable', NOW(), NOW()) RETURNING id`, { h: `studio${TAG}` });
    studio = st.id;
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Record ${TAG}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, feed_profile_id, created_at, updated_at) VALUES
               (:maren, :reg, :k1, 'Maren', 'Maren', 'support', 'accepted', :profile, NOW(), NOW()),
               (:mo, :reg, :k2, 'Mo', 'Mo', 'support', 'accepted', NULL, NOW(), NOW()),
               (:marcus, :reg, :k3, 'Marcus Hale', 'Marcus Hale', 'support', 'accepted', :truth, NOW(), NOW()),
               (:lala, :reg, 'lala', 'Lala', 'Lala', 'protagonist', 'accepted', NULL, NOW(), NOW())`,
    { ...ids, profile, truth, k1: `rec-${TAG}-1`, k2: `rec-${TAG}-2`, k3: `rec-${TAG}-3` });
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, known_by, state, created_at, updated_at) VALUES
               (:ring, :maren, 'She sold the ring', '[]'::jsonb, 'hidden', NOW(), NOW()),
               (:rent, :maren, 'She owes rent', '[]'::jsonb, 'hinted', NOW(), NOW())`, ids);
    const automation = {
      guest_profiles: [{ profile_id: truth, display_name: 'Truthville' }, { profile_id: studio, display_name: 'Studio Bystable' }],
      relationship_goals: [{ slot: 'relationship_guest', label: 'Get to know Truthville', profile_id: truth }],
    };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, source_profile_id, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, 'Velvet Gala', 'gala', 7, 'used', :ep, :profile, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, profile, cc: JSON.stringify({ automation }) });
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, created_at, updated_at)
               VALUES (:todo, :ep, :show, :ev, '[]'::jsonb, CAST(:tasks AS jsonb), NOW(), NOW())`,
    { ...ids, tasks: JSON.stringify([{ slot: 'relationship_guest', label: 'Get to know Truthville', task_source: 'goal', completed: false }]) });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status) VALUES (:thread, :show, 'Who saw the ring?', 'advanced')`, ids);
    await run(`INSERT INTO storyteller_books (id, title, show_id, status, created_at, updated_at) VALUES (:book, :title, :show, 'draft', NOW(), NOW())`, { ...ids, title: `Book ${TAG}` });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, sort_order, title, created_at, updated_at) VALUES (:ch, :book, 1, 1, 'One', NOW(), NOW())`, ids);
    await run('UPDATE storyteller_chapters SET episode_id = :ep WHERE id = :ch', ids);
  });

  afterAll(async () => {
    await run('DELETE FROM episode_story_records WHERE episode_id IN (:ep, :bare)', ids);
    await run('DELETE FROM show_follow_ups WHERE show_id = :show', ids);
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a IN (:lala, :marcus) OR character_id_b IN (:lala, :marcus))', ids);
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:lala, :marcus) OR character_id_b IN (:lala, :marcus)', ids);
    await run('DELETE FROM episode_todo_lists WHERE id = :todo', ids);
    await run('DELETE FROM storyteller_chapters WHERE book_id = :book', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id IN (:maren, :mo)', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:profile, :truth, :studio)', { profile, truth, studio });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  beforeEach(() => mockCreate.mockReset());

  it('none yet: the cast with their secrets, and the open threads', async () => {
    const res = await request(app).get(base);
    expect(res.status).toBe(200);
    expect(res.body.record).toBeNull();
    expect(res.body.cast).toEqual([
      { id: ids.lala, name: 'Lala', profile_id: null, linked: true, is_lala: true, secrets: [] },
      { id: ids.maren, name: 'Maren', profile_id: profile, linked: true, secrets: [
        { id: ids.ring, text: 'She sold the ring', state: 'hidden', known_by: [] },
        { id: ids.rent, text: 'She owes rent', state: 'hinted', known_by: [] },
      ] },
      { id: ids.marcus, name: 'Marcus Hale', profile_id: truth, linked: true, secrets: [] },
      // Not in the registry: kept, by the Feed profile.
      { id: `profile:${studio}`, name: 'Studio Bystable', profile_id: studio, linked: false, secrets: [] },
    ]);
    // The goal is covered in beat 11: Truthville is there by her real name.
    expect(res.body.goals).toEqual([{ slot: 'relationship_guest', label: 'Get to know Truthville', completed: false, beat: 11 }]);
    expect(res.body.threads.map((t) => t.title)).toEqual(['Who saw the ring?']);
    expect((await request(app).get('/api/v1/book-from-show/episodes/nope/record')).status).toBe(400);
    expect((await request(app).post(`/api/v1/book-from-show/episodes/${ids.bare}/record/draft`)).status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('drafts from the episode, keeping only its people, their secrets and the threads', async () => {
    mockCreate.mockResolvedValueOnce(answer({
      what_happened: 'Maren hid her hand at the Velvet Gala.',
      characters: [{ character_id: ids.maren, knew: 'The ring was gone', learned: '', changed: 'Guarded' }, { character_id: ids.mo, knew: 'nothing' }],
      secrets: [{ secret_id: ids.ring, what: 'hinted', how: 'She tucks her hand away' }, { secret_id: crypto.randomUUID(), what: 'revealed' }, { secret_id: ids.rent, what: 'shouted' }],
      threads: [{ thread_id: ids.thread, title: 'Who saw the ring?', note: 'The photographer did' }, { thread_id: 'made-up', title: 'A new one' }, { title: '' }],
      relationships: [
        { a: ids.lala, b: ids.marcus, type: 'love_interest', is_romantic: true, stage_before: 'strangers', stage_after: 'acquaintances', evidence_beat: 11, note: 'Flirting at the gala' },
        { a: ids.lala, b: `profile:${studio}`, type: 'collaborator', stage_before: 'strangers', stage_after: 'acquaintances', evidence_beat: 9 },
        { a: ids.lala, b: crypto.randomUUID(), type: 'rival' },
        { a: ids.marcus, b: ids.lala, type: 'duplicate pair' },
        { a: ids.maren, b: ids.mo, type: 'friend' },
        { a: ids.maren, b: ids.lala, stage_before: 'besties', stage_after: 'lovers', evidence_beat: 99 },
      ],
      follow_ups: [{ person: `profile:${studio}`, text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode' }, { person: 'nobody', text: 'Call back' }, { text: '' }],
      goals: [{ slot: 'relationship_guest', covered: true, beat: 11, note: 'They talk in beat 11' }, { slot: 'made_up', covered: true }],
    }));
    const res = await request(app).post(`${base}/draft`);
    expect(res.status).toBe(200);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('MAREN tucks her hand away');
    expect(prompt).toContain(`[${ids.ring}] She sold the ring (the audience: hidden`);
    expect(prompt).toContain(`[${ids.thread}] Who saw the ring?`);
    expect(prompt).toContain('MARCUS HALE: So you are the Lala');
    expect(prompt).toContain('- [relationship_guest] Get to know Truthville (the script check finds it in beat 11)');
    expect(prompt).toContain(`[profile:${studio}] Studio Bystable (not in the character registry yet)`);
    expect(prompt).toContain('THEIR RELATIONSHIPS SO FAR:\n(none recorded between these people)');
    expect(prompt).toContain('WHAT LALA STILL OWES PEOPLE (OPEN FOLLOW-UPS):\n(none)');
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(4000);
    expect(res.body.record).toMatchObject({
      status: 'draft', what_happened: 'Maren hid her hand at the Velvet Gala.',
      characters: [{ character_id: ids.maren, name: 'Maren', knew: 'The ring was gone', learned: '', changed: 'Guarded' }],
      secrets: [{ secret_id: ids.ring, character_id: ids.maren, text: 'She sold the ring', what: 'hinted', how: 'She tucks her hand away' }],
      threads: [{ thread_id: ids.thread, title: 'Who saw the ring?', note: 'The photographer did', action: 'advance', keep: true }, { thread_id: null, title: 'A new one', note: '', action: 'new', keep: true }],
      relationships: [
        { a: ids.lala, b: ids.marcus, type: 'love_interest', is_romantic: true, stage_before: 'strangers', stage_after: 'acquaintances', evidence_beat: 11, note: 'Flirting at the gala', keep: true },
        { a: ids.lala, b: `profile:${studio}`, type: 'collaborator', is_romantic: false, evidence_beat: 9, keep: true },
        // A stage that is not one of relationship_events' and a beat past 14 are dropped.
        { a: ids.maren, b: ids.lala, stage_before: null, stage_after: 'lovers', evidence_beat: null },
      ],
      follow_ups: [
        { person: `profile:${studio}`, name: 'Studio Bystable', text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode', keep: true },
        { person: null, name: '', text: 'Call back' },
      ],
      goals: [{ slot: 'relationship_guest', label: 'Get to know Truthville', covered: true, beat: 11, note: 'They talk in beat 11', keep: true }],
      twists: [],
    });
    // Mo is not in this episode: the Maren and Mo pair is dropped.
    expect(res.body.record.relationships).toHaveLength(3);
    expect(res.body.record.threads.every((t) => t.key)).toBe(true);
    // Threads open by themselves (Evoni, 2026-10-26): the check found no AI
    // answer (the mock has none), so the plain check ran: "A new one" opened,
    // and the advance became a note that moved "Who saw the ring?" on.
    expect(mockCreate).toHaveBeenCalledTimes(3);
    const [newKey, advanceKey] = [res.body.record.threads[1].key, res.body.record.threads[0].key];
    expect(res.body.record.applied.threads[newKey]).toMatchObject({ action: 'new', auto: true });
    expect(res.body.record.applied.threads[advanceKey]).toMatchObject({ action: 'advance', auto: true, thread_id: ids.thread });
    expect(res.body.thread_states[newKey]).toMatchObject({ state: 'opened', thread_title: 'A new one', can_undo: true });
    expect(res.body.thread_states[advanceKey]).toMatchObject({ state: 'noted', thread_title: 'Who saw the ring?', can_undo: true });
    expect(res.body.show_id).toBe(ids.show);
    // A draft is not read by the writers.
    expect(await recordBlock(sequelize, ids.ep)).toBe('');
  });

  it('edits, then approval moves the secrets on and the writers read it', async () => {
    const edited = await request(app).put(base).send({
      secrets: [{ secret_id: ids.ring, what: 'revealed', how: 'Mo says it out loud' }, { secret_id: ids.rent, what: 'hinted', how: 'A late notice' }],
    });
    expect(edited.status).toBe(200);
    expect(edited.body.record.secrets.map((s) => [s.text, s.what])).toEqual([['She sold the ring', 'revealed'], ['She owes rent', 'hinted']]);
    expect(edited.body.record.characters).toHaveLength(1);

    // Untick the Maren and Lala pair and drop the bare follow-up: neither is written.
    const draft = (await request(app).get(base)).body.record;
    const unticked = await request(app).put(base).send({
      relationships: draft.relationships.map((r) => (r.a === ids.maren ? { ...r, keep: false } : r)),
      follow_ups: draft.follow_ups.filter((f) => f.person),
    });
    expect(unticked.status).toBe(200);

    const sync = jest.spyOn(relationshipTruth, 'afterStorySave');
    const ok = await request(app).post(`${base}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.record).toMatchObject({ status: 'approved', approved_by: 'evoni@record.dev' });
    expect(ok.body.result.skipped).toEqual([{ kind: 'relationship', reason: 'not_linked', name: 'Studio Bystable', profile_id: studio }]);
    // The threads opened by themselves at the read: Save does not write them again.
    expect(ok.body.result.written.map((w) => w.kind).sort()).toEqual(['follow_up', 'goal', 'relationship', 'secret']);
    expect(ok.body.result.pulse_suggestions).toBe(3);

    const [threads] = await run('SELECT title, status, source, opened_episode_id, last_advanced_episode_id FROM show_story_threads WHERE show_id = :show ORDER BY title', ids);
    expect(threads).toEqual([
      { title: 'A new one', status: 'open', source: 'record', opened_episode_id: ids.ep, last_advanced_episode_id: null },
      { title: 'Who saw the ring?', status: 'advanced', source: 'evoni', opened_episode_id: null, last_advanced_episode_id: ids.ep },
    ]);
    const [rels] = await run(`SELECT id, character_id_a, character_id_b, relationship_type, is_romantic, confirmed, lala_connection, situation
                                FROM character_relationships WHERE (character_id_a IN (:lala, :marcus, :maren) OR character_id_b IN (:lala, :marcus, :maren)) AND deleted_at IS NULL`, ids);
    expect(rels).toEqual([expect.objectContaining({
      character_id_a: ids.lala, character_id_b: ids.marcus, relationship_type: 'love_interest', is_romantic: true, confirmed: true,
      lala_connection: 'knows_lala', situation: 'Flirting at the gala',
    })]);
    // Each relationship the Save wrote is kept in step with The Pulse, after
    // the commit (it reads the saved pair; Lala has no Pulse profile here).
    expect(sync.mock.calls.map(([, id]) => id)).toEqual([rels[0].id]);
    await expect(sync.mock.results[0].value).resolves.toEqual({ skipped: 'one of them has no Pulse profile' });
    sync.mockRestore();
    const [events] = await run('SELECT relationship_stage, event_type, metadata FROM relationship_events WHERE relationship_id = :id', { id: rels[0].id });
    expect(events).toEqual([{ relationship_stage: 'acquaintances', event_type: 'first_meeting', metadata: { episode_id: ids.ep, beat: 11, stage_before: 'strangers', source: 'record' } }]);
    const [follows] = await run('SELECT text, due_hint, status, profile_id, registry_character_id, created_by FROM show_follow_ups WHERE show_id = :show', ids);
    expect(follows).toEqual([{ text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode', status: 'open', profile_id: studio, registry_character_id: null, created_by: 'evoni@record.dev' }]);
    const [[todo]] = await run('SELECT social_tasks FROM episode_todo_lists WHERE id = :todo', ids);
    expect(todo.social_tasks[0]).toMatchObject({ slot: 'relationship_guest', completed: true, completed_source: 'record', completed_beat: 11 });

    // A second Save writes nothing new.
    const again = await request(app).post(`${base}/approve`);
    expect(again.status).toBe(200);
    expect(again.body.result.written).toEqual([]);
    expect(again.body.result.pulse_suggestions).toBe(0);
    const count = async (sql) => (await run(sql, ids))[0][0].n;
    expect(await count('SELECT COUNT(*)::int AS n FROM show_story_threads WHERE show_id = :show')).toBe(2);
    expect(await count('SELECT COUNT(*)::int AS n FROM character_relationships WHERE character_id_a IN (:lala, :marcus) OR character_id_b IN (:lala, :marcus)')).toBe(1);
    expect(await count('SELECT COUNT(*)::int AS n FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a = :lala)')).toBe(1);
    expect(await count('SELECT COUNT(*)::int AS n FROM show_follow_ups WHERE show_id = :show')).toBe(1);
    const [rows] = await run('SELECT id, state, state_where FROM character_secrets WHERE id IN (:ring, :rent) ORDER BY text DESC', ids);
    expect(rows.map((r) => [r.id, r.state, r.state_where?.note])).toEqual([
      [ids.ring, 'revealed', 'Episode 4: The Gala'],
      // Already hinted: left where it was.
      [ids.rent, 'hinted', undefined],
    ]);

    const block = await recordBlock(sequelize, ids.ep);
    expect(block).toContain('What happened: Maren hid her hand at the Velvet Gala.');
    expect(block).toContain('- Maren: knew The ring was gone; changed: Guarded');
    expect(block).toContain('- Revealed: She sold the ring (Mo says it out loud)');
    expect(block).toContain('- Who saw the ring?: The photographer did');

    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Chapter prose.' }] });
    const chapter = await request(app).post(`/api/v1/book-from-show/chapters/${ids.ch}/write-from-episode`);
    expect(chapter.status).toBe(200);
    expect(chapter.body.used_story_record).toBe(true);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('THE EPISODE STORY RECORD (approved');
  });

  it('an edit puts an approved record back to draft; approval needs what happened', async () => {
    const back = await request(app).put(base).send({ what_happened: '' });
    expect(back.body.record.status).toBe('draft');
    expect(await recordBlock(sequelize, ids.ep)).toBe('');
    expect((await request(app).post(`${base}/approve`)).status).toBe(400);
    expect((await request(app).put(base).send({ characters: 'nope' })).status).toBe(400);
  });
});
