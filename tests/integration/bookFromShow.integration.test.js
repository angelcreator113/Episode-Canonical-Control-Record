/**
 * The book follows the show (routes/bookFromShowRoutes.js; Evoni,
 * 2026-10-15; docs/CANON.md): the ledger of what each episode owes, a
 * chapter's episode, writing a chapter from its episode, checking it
 * against the short story, and the short story's beat 11 piece.
 *
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });
jest.mock('../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { sequelize } = require('../../src/models');
const router = require('../../src/routes/bookFromShowRoutes');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const answer = (text) => ({ content: [{ type: 'text', text }] });

(shouldSkip ? describe.skip : describe)('the book follows the show', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), ep1: crypto.randomUUID(), ep2: crypto.randomUUID(), story: crypto.randomUUID(),
    book: crypto.randomUUID(), ch1: crypto.randomUUID(), ch2: crypto.randomUUID(), post: crypto.randomUUID(), draftPost: crypto.randomUUID(),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/book-from-show', router);
  const api = '/api/v1/book-from-show';

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Book ${TAG}`, slug: `book-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
               (:ep1, :show, 'The Gala', 1, 'draft', NOW(), NOW()), (:ep2, :show, 'The Brunch', 2, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO stories (id, show_id, episode_id, title, content, word_count, format, source_type, status, created_at, updated_at)
               VALUES (:story, :show, :ep1, 'The Gala', 'Lala arrived late. The lights went out at nine. Nobody saw who took the necklace.', 16, 'short_story', 'episode', 'draft', NOW(), NOW())`, ids);
    // What the LalaVerse said about episode 1: one live post, one draft (not read).
    await run(`INSERT INTO feed_posts (id, show_id, episode_id, poster_handle, content_text, status, created_at, updated_at) VALUES
               (:post, :show, :ep1, 'velvet', 'Who turned the lights off?? #VelvetHour', 'live', NOW(), NOW()),
               (:draftPost, :show, :ep1, 'velvet', 'DRAFT: not out yet', 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO storyteller_books (id, title, show_id, status, created_at, updated_at) VALUES (:book, :title, :show, 'draft', NOW(), NOW())`,
      { ...ids, title: `Before Lala ${TAG}` });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, sort_order, title, draft_prose, created_at, updated_at) VALUES
               (:ch1, :book, 1, 1, 'One', 'I built the gala in my head before Zion woke up.', NOW(), NOW()),
               (:ch2, :book, 2, 2, 'Two', NULL, NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE id IN (:post, :draftPost)', ids);
    await run('DELETE FROM storyteller_chapters WHERE book_id = :book', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
    await run('DELETE FROM stories WHERE id = :story', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  beforeEach(() => mockCreate.mockReset());

  it('links a chapter to its episode, one chapter per episode in a book', async () => {
    expect((await request(app).put(`${api}/chapters/${ids.ch1}/episode`).send({ episode_id: ids.ep1 })).status).toBe(200);
    const taken = await request(app).put(`${api}/chapters/${ids.ch2}/episode`).send({ episode_id: ids.ep1 });
    expect(taken.status).toBe(409);
    expect(taken.body.chapter_id).toBe(ids.ch1);
    expect((await request(app).put(`${api}/chapters/${ids.ch2}/episode`).send({ episode_id: 'nope' })).status).toBe(400);

    const got = await request(app).get(`${api}/chapters/${ids.ch1}/episode`);
    expect(got.body.episode).toMatchObject({ id: ids.ep1, episode_number: 1, title: 'The Gala' });
    expect(got.body.short_story).toMatchObject({ id: ids.story, word_count: 16 });
  });

  it('the ledger shows what each episode still owes', async () => {
    const res = await request(app).get(`${api}/books/${ids.book}/ledger`);
    expect(res.status).toBe(200);
    expect(res.body.episodes.map((e) => [e.episode_number, Boolean(e.short_story), e.chapter && e.chapter.written])).toEqual([
      [1, true, true],
      [2, false, null],
    ]);
    expect(res.body.owed).toEqual({ short_stories: 1, beat11: 1, chapters: 1 });
  });

  it('writes a chapter draft from the episode and its short story, saving nothing', async () => {
    await request(app).put(`${api}/chapters/${ids.ch2}/episode`).send({ episode_id: ids.ep2 });
    await request(app).put(`${api}/chapters/${ids.ch1}/episode`).send({ episode_id: null });
    await request(app).put(`${api}/chapters/${ids.ch2}/episode`).send({ episode_id: ids.ep1 });
    mockCreate.mockResolvedValue(answer('The night of the gala I put the boys to bed early.'));
    const res = await request(app).post(`${api}/chapters/${ids.ch2}/write-from-episode`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ prose: 'The night of the gala I put the boys to bed early.', used_short_story: true, saved: false });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Nobody saw who took the necklace.');
    expect(prompt).toContain('I built the gala in my head before Zion woke up.');   // the chapter before
    expect(prompt).toContain("JustAWoman's first person");
    expect(prompt).toContain('- @velvet: Who turned the lights off?? #VelvetHour');   // the Pulse, live posts only
    expect(prompt).not.toContain('DRAFT: not out yet');
    expect(prompt).toContain('the consciousness transfer is not placed yet. Write no bleed.');
    expect(res.body).toMatchObject({ used_pulse_posts: 1, bleed: 'unset' });
    const [[ch]] = await run('SELECT draft_prose FROM storyteller_chapters WHERE id = :ch2', ids);
    expect(ch.draft_prose).toBeNull();
  });

  it('checks a draft against the short story', async () => {
    mockCreate.mockResolvedValue(answer('{"issues":[{"chapter_says":"the lights stayed on","story_says":"the lights went out at nine","why":"The story has a blackout."}]}'));
    const res = await request(app).post(`${api}/chapters/${ids.ch2}/check-against-story`).send({ prose: 'The lights stayed on all night.' });
    expect(res.status).toBe(200);
    expect(res.body.issues).toEqual([{ chapter_says: 'the lights stayed on', story_says: 'the lights went out at nine', why: 'The story has a blackout.' }]);
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
  });

  it('cuts and saves the beat 11 piece, and keeps an edit', async () => {
    mockCreate.mockResolvedValue(answer('{"text":"The lights went out at nine.","why":"Who took the necklace?"}'));
    const cut = await request(app).post(`${api}/stories/${ids.story}/beat11-excerpt`);
    expect(cut.status).toBe(200);
    expect(cut.body.excerpt).toMatchObject({ text: 'The lights went out at nine.', why: 'Who took the necklace?', for_animation: true, generated: true });
    const edit = await request(app).put(`${api}/stories/${ids.story}/beat11-excerpt`).send({ text: 'At nine, the lights went out.' });
    expect(edit.body.excerpt).toMatchObject({ text: 'At nine, the lights went out.', why: 'Who took the necklace?', generated: false });
    const got = await request(app).get(`${api}/stories/${ids.story}/beat11-excerpt`);
    expect(got.body).toMatchObject({ is_short_story: true, excerpt: { text: 'At nine, the lights went out.' } });
    const [[row]] = await run('SELECT metadata FROM stories WHERE id = :story', ids);
    expect(row.metadata.beat11_excerpt.text).toBe('At nine, the lights went out.');
    const ledger = await request(app).get(`${api}/books/${ids.book}/ledger`);
    expect(ledger.body.owed.beat11).toBe(0);
  });

  it('the transfer episode places the Lala bleed in the first chapter after it', async () => {
    expect((await request(app).get(`${api}/shows/${ids.show}/transfer`)).body.transfer).toBeNull();
    const set = await request(app).put(`${api}/shows/${ids.show}/transfer`).send({ episode_id: ids.ep1 });
    expect(set.status).toBe(200);
    expect(set.body.transfer).toMatchObject({ episode_id: ids.ep1, episode_number: 1 });
    expect((await request(app).get(`${api}/books/${ids.book}/ledger`)).body.transfer).toMatchObject({ episode_id: ids.ep1 });

    // ch2 is episode 1's chapter: the transfer episode itself, no bleed yet.
    mockCreate.mockResolvedValue(answer('prose'));
    expect((await request(app).post(`${api}/chapters/${ids.ch2}/write-from-episode`)).body.bleed).toBe('before');
    // ch1 is episode 2's chapter: the first after the transfer.
    await request(app).put(`${api}/chapters/${ids.ch1}/episode`).send({ episode_id: ids.ep2 });
    const first = await request(app).post(`${api}/chapters/${ids.ch1}/write-from-episode`);
    expect(first.body.bleed).toBe('bleed');
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('this is the first chapter after the consciousness transfer. Include the bleed: ONE intrusive thought, once');

    // An episode of another show is refused; null clears it.
    expect((await request(app).put(`${api}/shows/${ids.show}/transfer`).send({ episode_id: crypto.randomUUID() })).status).toBe(404);
    const cleared = await request(app).put(`${api}/shows/${ids.show}/transfer`).send({ episode_id: null });
    expect(cleared.body.transfer).toBeNull();
    expect((await request(app).post(`${api}/chapters/${ids.ch1}/write-from-episode`)).body.bleed).toBe('unset');
    await request(app).put(`${api}/chapters/${ids.ch1}/episode`).send({ episode_id: null });
  });

  it('the Scene Planner reads the episode\'s beat 11 piece', async () => {
    const res = await request(app).get(`${api}/episodes/${ids.ep1}/beat11`);
    expect(res.body).toMatchObject({ story_id: ids.story, excerpt: { text: 'At nine, the lights went out.' } });
    expect((await request(app).get(`${api}/episodes/${ids.ep2}/beat11`)).body).toMatchObject({ story_id: null, excerpt: null });
  });

  it('refuses what it cannot do', async () => {
    expect((await request(app).post(`${api}/chapters/${ids.ch1}/write-from-episode`)).status).toBe(409);   // no episode now
    expect((await request(app).post(`${api}/chapters/${crypto.randomUUID()}/write-from-episode`)).status).toBe(404);
    expect((await request(app).put(`${api}/stories/${ids.story}/beat11-excerpt`).send({ text: '' })).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
