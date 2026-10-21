/**
 * The book side check's fixes (Evoni, 2026-10-20: "yes start the fixes with
 * your recommendations"):
 *   - B1: the memoir export says which chapters it leaves out (words not yet
 *     approved in Review), on the meta and on each download;
 *   - P5: the export's title page carries whose memoir it is (character_name);
 *   - B2: the chapter scenes suggestions are a POST (GET kept), rate-limited,
 *     MODELS with two attempts, and an unreachable AI or budget refusal
 *     answers plainly;
 *   - P1: any writing-hub route's raw AI failure reaches the author as a 502
 *     with a plain message (or a 429 for the budget), never "Connection error.".
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models');
const TokenService = require('../../src/services/tokenService');
const { UNREACHABLE } = require('../../src/utils/aiFailure');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });
const connectionError = () => Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' });

(shouldSkip ? describe.skip : describe)('the book side check fixes', () => {
  let token;
  let book;
  const savedKey = process.env.ANTHROPIC_API_KEY;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-admin-bookfix', email: 'evoni@bookfix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    book = await db.StorytellerBook.create({ title: 'Book fix test', character_name: 'JustAWoman', status: 'draft' });
    // Chapter 1: draft prose only (waiting in Review). Chapter 2: one approved
    // line. Chapter 3: one line not yet approved. Chapter 4: nothing yet.
    await db.StorytellerChapter.create({ book_id: book.id, title: 'Drafted only', chapter_number: 1, sort_order: 1, draft_prose: 'She typed the first line of Lala.' });
    const c2 = await db.StorytellerChapter.create({ book_id: book.id, title: 'Approved', chapter_number: 2, sort_order: 2 });
    await db.StorytellerLine.create({ chapter_id: c2.id, text: 'Elias watched.', content: 'Elias watched.', status: 'approved', sort_order: 1, line_order: 1 });
    const c3 = await db.StorytellerChapter.create({ book_id: book.id, title: 'Pending line', chapter_number: 3, sort_order: 3 });
    await db.StorytellerLine.create({ chapter_id: c3.id, text: 'Not yet.', content: 'Not yet.', status: 'pending', sort_order: 1, line_order: 1 });
    await db.StorytellerChapter.create({ book_id: book.id, title: 'Empty', chapter_number: 4, sort_order: 4 });
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedKey;
    if (book) {
      const chapters = await db.StorytellerChapter.findAll({ where: { book_id: book.id }, paranoid: false });
      for (const c of chapters) await db.StorytellerLine.destroy({ where: { chapter_id: c.id }, force: true });
      await db.StorytellerChapter.destroy({ where: { book_id: book.id }, force: true });
      await book.destroy({ force: true });
    }
  });

  beforeEach(() => mockCreate.mockReset());

  test('B1 + P5: the meta names the chapters left out and why, and whose memoir it is', async () => {
    const res = await as(request(app).get(`/api/v1/export/book/${book.id}/meta`));
    expect(res.status).toBe(200);
    expect(res.body.chapter_count).toBe(1);
    expect(res.body.character).toBe('JustAWoman');
    expect(res.body.not_approved_count).toBe(2);
    expect(res.body.skipped_chapters).toEqual([
      { title: 'Drafted only', reason: 'not_approved' },
      { title: 'Pending line', reason: 'not_approved' },
      { title: 'Empty', reason: 'empty' },
    ]);
  });

  test('B1 + P5: the Word file says how many chapters it leaves out and carries the name on its title page', async () => {
    const res = await as(request(app).get(`/api/v1/export/book/${book.id}/docx`))
      .buffer(true).parse((r, cb) => { const d = []; r.on('data', (x) => d.push(x)); r.on('end', () => cb(null, Buffer.concat(d))); });
    expect(res.status).toBe(200);
    expect(res.headers['x-export-not-approved']).toBe('2');
    const zip = await require('jszip').loadAsync(res.body);
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toContain('JUSTAWOMAN');
  });

  test('B2: scene suggestions are a POST; a failed first attempt is tried again', async () => {
    mockCreate
      .mockRejectedValueOnce(connectionError())
      .mockResolvedValueOnce(say([{ title: 'The first post', description: 'd', chapter_index: 2, characters: [], reason: 'r' }]));
    const res = await as(request(app).post(`/api/v1/memories/books/${book.id}/scenes`));
    expect(res.status).toBe(200);
    expect(res.body.scenes.map((s) => s.title)).toEqual(['The first post']);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls.every((c) => c[0].model === 'claude-sonnet-4-6')).toBe(true);
  });

  test('B2: the AI unreachable on both attempts is a plain 502; a budget refusal is a 429 with no second attempt', async () => {
    mockCreate.mockRejectedValue(connectionError());
    const down = await as(request(app).post(`/api/v1/memories/books/${book.id}/scenes`));
    expect(down.status).toBe(502);
    expect(down.body.error).toBe(UNREACHABLE);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    mockCreate.mockReset();
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { code: 'AI_BUDGET_EXCEEDED', status: 429 }));
    const broke = await as(request(app).get(`/api/v1/memories/books/${book.id}/scenes`));   // the GET alias still answers
    expect(broke.status).toBe(429);
    expect(broke.body.error).toContain('AI daily budget exceeded');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('P1: a writing route that passes the raw SDK text along now answers a plain 502', async () => {
    mockCreate.mockRejectedValue(connectionError());
    const res = await as(request(app).post('/api/v1/memories/rewrite-options')).send({ book_id: book.id, content: 'She left.' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, code: 'AI_UNREACHABLE', error: UNREACHABLE });
    expect(JSON.stringify(res.body)).not.toContain('Connection error');
  });
});
