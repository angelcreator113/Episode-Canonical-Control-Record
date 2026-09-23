// ============================================================================
// POST /api/v1/novel/manuscript/cascade — AI response whitelist (#1733)
// ============================================================================
// The model's JSON is filtered to CASCADE_AI_WRITABLE_FIELDS before either
// write; the route's own fields are applied after the filter, so no model key
// can overwrite them. Mocked, no database, no network.

const express = require('express');
const request = require('supertest');

let mockModelJson;
let mockExisting;
const mockCreate = jest.fn(async (row) => row);

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: jest.fn(async () => ({ content: [{ text: JSON.stringify(mockModelJson) }] })) },
})));
jest.mock('../../../src/models', () => ({
  StorytellerStory: { findAll: jest.fn(async () => [{ id: 's1', title: 'One' }, { id: 's2', title: 'Two' }]) },
  StorytellerLine: { findAll: jest.fn(async () => [{ story_id: 's1', content: 'A line.' }]) },
  VoiceRule: { findAll: jest.fn(async () => []) },
  ManuscriptMetadata: {
    findOne: jest.fn(async () => mockExisting),
    create: (...a) => mockCreate(...a),
  },
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: [] }; next(); },
}));

const router = require('../../../src/routes/novelIntelligenceRoutes');
const { CASCADE_AI_WRITABLE_FIELDS, CASCADE_AI_NEVER_WRITABLE } = router;

const app = express();
app.use(express.json());
app.use('/api/v1/novel', router);

const WANTED = {
  book_title: 'The Right Room', tagline: 'Tag', one_line_logline: 'Log', amazon_description: 'Desc',
  section_establishment: 'A', section_pressure: 'B', section_crisis: 'C', section_integration: 'D',
  table_of_contents: [{ chapter_number: 1, title: 'T' }], dominant_themes: ['t'], recurring_motifs: ['m'],
  pain_point_summary: [{ category: 'visibility' }], lala_seed_moments: [{ story_number: 1 }, { story_number: 2 }],
};
const INJECTED = {
  author_approved: true, approved_at: '2026-01-01T00:00:00Z', book_id: 'other-book', series_id: 'other-series',
  id: 'injected-id', author_overrides: { x: 1 }, stories_included: 999, generation_model: 'injected',
  generated_at: '2000-01-01T00:00:00Z', lala_seed_count: 99, created_at: '2000-01-01T00:00:00Z', not_a_column: 'x',
};

const cascade = () => request(app).post('/api/v1/novel/manuscript/cascade').send({ book_id: 'book-1', series_id: 'series-1' });

beforeEach(() => {
  mockModelJson = { ...WANTED, ...INJECTED };
  mockCreate.mockClear();
  mockExisting = null;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('create branch (no existing record)', () => {
  test('whitelisted fields are written; the route sets identity and bookkeeping', async () => {
    const res = await cascade();
    expect(res.status).toBe(200);
    const row = mockCreate.mock.calls[0][0];
    expect(row).toMatchObject(WANTED);
    expect(row).toMatchObject({
      book_id: 'book-1', series_id: 'series-1', stories_included: 2,
      generation_model: 'claude-sonnet-4-6', lala_seed_count: 2,
    });
  });

  test('approval, override, id, timestamp and unknown keys from the model are not written', async () => {
    await cascade();
    const row = mockCreate.mock.calls[0][0];
    for (const key of ['author_approved', 'approved_at', 'id', 'author_overrides', 'generated_at', 'created_at', 'not_a_column']) {
      expect(row).not.toHaveProperty(key);
    }
  });

  test('each dropped key is logged', async () => {
    await cascade();
    const line = console.warn.mock.calls.map((c) => c[0]).find((w) => w.includes('dropped'));
    expect(line).toBeDefined();
    for (const key of Object.keys(INJECTED)) expect(line).toContain(key);
  });
});

describe('update branch (existing record)', () => {
  beforeEach(() => {
    mockExisting = { update: jest.fn(async function update(v) { return { ...v }; }) };
  });

  test('whitelisted fields are written; the route resets approval and sets bookkeeping', async () => {
    const res = await cascade();
    expect(res.status).toBe(200);
    const row = mockExisting.update.mock.calls[0][0];
    expect(row).toMatchObject(WANTED);
    expect(row).toMatchObject({
      author_approved: false, stories_included: 2, generation_model: 'claude-sonnet-4-6', lala_seed_count: 2,
    });
    expect(row.generated_at).toBeInstanceOf(Date);
  });

  test('approved_at, book_id, series_id, id and overrides from the model are not written', async () => {
    await cascade();
    const row = mockExisting.update.mock.calls[0][0];
    for (const key of ['approved_at', 'book_id', 'series_id', 'id', 'author_overrides', 'created_at', 'not_a_column']) {
      expect(row).not.toHaveProperty(key);
    }
  });
});

test('a non-object model reply merges nothing and is logged', async () => {
  mockModelJson = ['not', 'an', 'object'];
  const res = await cascade();
  expect(res.status).toBe(200);
  const row = mockCreate.mock.calls[0][0];
  expect(row).toMatchObject({ book_id: 'book-1', lala_seed_count: 0 });
  expect(row).not.toHaveProperty('book_title');
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('non-object'));
});

test('nothing on the never-writable list is on the writable list', () => {
  for (const key of CASCADE_AI_WRITABLE_FIELDS) expect(CASCADE_AI_NEVER_WRITABLE).not.toContain(key);
  expect(CASCADE_AI_WRITABLE_FIELDS).toHaveLength(13);
});
