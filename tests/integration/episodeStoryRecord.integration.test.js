/**
 * The Episode Story Record (stage C; services/episodeStoryRecord, routes in
 * routes/bookFromShowRoutes): drafted from the episode and kept to its cast,
 * their secrets and the open threads; edited; approved, which moves the
 * secrets on with the audience; and read by the chapter writer once approved.
 *
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });
jest.mock('../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1', email: 'evoni@record.dev' }; next(); } }));
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { sequelize } = require('../../src/models');
const router = require('../../src/routes/bookFromShowRoutes');
const { recordBlock } = require('../../src/services/episodeStoryRecord');

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
  };
  let profile;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/book-from-show', router);
  const base = `/api/v1/book-from-show/episodes/${ids.ep}/record`;

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Record ${TAG}`, slug: `record-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at) VALUES
               (:ep, :show, 'The Gala', 4, 'draft', 'MAREN tucks her hand away before the photographer turns.', NOW(), NOW()),
               (:bare, :show, 'Nothing yet', 5, 'draft', NULL, NOW(), NOW())`, ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, created_at, updated_at)
                             VALUES (:h, 'instagram', 'test', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `maren${TAG}` });
    profile = p.id;
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Record ${TAG}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, feed_profile_id, created_at, updated_at) VALUES
               (:maren, :reg, :k1, 'Maren', 'Maren', 'support', 'accepted', :profile, NOW(), NOW()),
               (:mo, :reg, :k2, 'Mo', 'Mo', 'support', 'accepted', NULL, NOW(), NOW())`,
    { ...ids, profile, k1: `rec-${TAG}-1`, k2: `rec-${TAG}-2` });
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, known_by, state, created_at, updated_at) VALUES
               (:ring, :maren, 'She sold the ring', '[]'::jsonb, 'hidden', NOW(), NOW()),
               (:rent, :maren, 'She owes rent', '[]'::jsonb, 'hinted', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, source_profile_id, created_at, updated_at)
               VALUES (:ev, :show, 'Velvet Gala', 'gala', 7, 'used', :ep, :profile, NOW(), NOW())`, { ...ids, profile });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status) VALUES (:thread, :show, 'Who saw the ring?', 'advanced')`, ids);
    await run(`INSERT INTO storyteller_books (id, title, show_id, status, created_at, updated_at) VALUES (:book, :title, :show, 'draft', NOW(), NOW())`, { ...ids, title: `Book ${TAG}` });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, sort_order, title, created_at, updated_at) VALUES (:ch, :book, 1, 1, 'One', NOW(), NOW())`, ids);
    await run('UPDATE storyteller_chapters SET episode_id = :ep WHERE id = :ch', ids);
  });

  afterAll(async () => {
    await run('DELETE FROM episode_story_records WHERE episode_id IN (:ep, :bare)', ids);
    await run('DELETE FROM storyteller_chapters WHERE book_id = :book', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id IN (:maren, :mo)', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :profile', { profile });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  beforeEach(() => mockCreate.mockReset());

  it('none yet: the cast with their secrets, and the open threads', async () => {
    const res = await request(app).get(base);
    expect(res.status).toBe(200);
    expect(res.body.record).toBeNull();
    expect(res.body.cast).toEqual([{ id: ids.maren, name: 'Maren', secrets: [
      { id: ids.ring, text: 'She sold the ring', state: 'hidden', known_by: [] },
      { id: ids.rent, text: 'She owes rent', state: 'hinted', known_by: [] },
    ] }]);
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
    }));
    const res = await request(app).post(`${base}/draft`);
    expect(res.status).toBe(200);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('MAREN tucks her hand away');
    expect(prompt).toContain(`[${ids.ring}] She sold the ring (the audience: hidden`);
    expect(prompt).toContain(`[${ids.thread}] Who saw the ring?`);
    expect(res.body.record).toMatchObject({
      status: 'draft', what_happened: 'Maren hid her hand at the Velvet Gala.',
      characters: [{ character_id: ids.maren, name: 'Maren', knew: 'The ring was gone', learned: '', changed: 'Guarded' }],
      secrets: [{ secret_id: ids.ring, character_id: ids.maren, text: 'She sold the ring', what: 'hinted', how: 'She tucks her hand away' }],
      threads: [{ thread_id: ids.thread, title: 'Who saw the ring?', note: 'The photographer did' }, { thread_id: null, title: 'A new one', note: '' }],
    });
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

    const ok = await request(app).post(`${base}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.record).toMatchObject({ status: 'approved', approved_by: 'evoni@record.dev' });
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
