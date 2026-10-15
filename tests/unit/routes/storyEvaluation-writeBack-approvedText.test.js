// ============================================================================
// UNIT TEST — POST /write-back writes the approved version as edited
// ============================================================================
// The evaluation screen lets the author edit the synthesised approved
// version. The edit lived only in the page, so write-back wrote the
// synthesis saved at evaluation and the edit was lost. The page now sends
// approved_text, and the route writes it.

const express = require('express');
const request = require('supertest');

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/services/storyEnrichmentService', () => ({ enrichAfterWriteBack: jest.fn(async () => {}) }));
jest.mock('../../../src/services/postGenerationReview', () => ({ reviewInBackground: jest.fn() }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

let mockStory;
const mockLines = [];
jest.mock('../../../src/models', () => ({
  sequelize: { transaction: jest.fn(async () => ({ commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}) })) },
  StorytellerStory: { findByPk: jest.fn(async () => mockStory) },
  StorytellerChapter: { findByPk: jest.fn(async () => ({ id: 'ch-1', toJSON: () => ({ id: 'ch-1' }) })) },
  StorytellerLine: {
    count: jest.fn(async () => 0),
    create: jest.fn(async (row) => { mockLines.push(row); return row; }),
  },
  StorytellerMemory: { create: jest.fn() },
  RegistryCharacter: { findOne: jest.fn() },
}));

const router = require('../../../src/routes/storyEvaluationRoutes');

const app = express();
app.use(express.json());
app.use('/', router);

beforeEach(() => {
  mockLines.length = 0;
  mockStory = {
    id: 's1', story_number: 1, status: 'evaluated',
    text: 'The synthesis.\nAs evaluated.',
    save: jest.fn(async () => {}),
    toJSON() { return { id: 's1' }; },
  };
});

test('the edited approved version is what is written to the chapter', async () => {
  const res = await request(app).post('/write-back').send({
    story_id: 's1', chapter_id: 'ch-1', approved_text: '  Her edit.\nKept.  ',
  });
  expect(res.status).toBe(200);
  expect(mockLines.map((l) => l.text)).toEqual(['Her edit.', 'Kept.']);
  expect(mockStory.text).toBe('Her edit.\nKept.');
  expect(mockStory.save).toHaveBeenCalled();
});

test('without approved_text the synthesis saved at evaluation is written', async () => {
  const res = await request(app).post('/write-back').send({ story_id: 's1', chapter_id: 'ch-1' });
  expect(res.status).toBe(200);
  expect(mockLines.map((l) => l.text)).toEqual(['The synthesis.', 'As evaluated.']);
});

test('approved_text that is not text is refused', async () => {
  const res = await request(app).post('/write-back').send({ story_id: 's1', chapter_id: 'ch-1', approved_text: { x: 1 } });
  expect(res.status).toBe(400);
  expect(mockLines).toEqual([]);
});
