/**
 * The book's AI reads the franchise's rules only (Evoni's ruling,
 * 2026-10-08; the wiring map's fix-list item 25 follow-up). Story Engine
 * writing and evaluation, WriteMode, the tier guard and the post-generation
 * review are sent no show, so they read every show's rules, a show's own
 * canon included. They now take scope 'franchise' alone.
 *
 * Story evaluation's filter also keeps an always-inject rule as it meant
 * to: always_inject was never selected, so a rule whose applies_to names
 * systems ('story_engine', as the seeded laws do) was always dropped.
 *
 * The AI is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { loadFranchiseConstraints } = require('../../src/routes/storyEvaluationRoutes');
const { loadFranchiseKnowledge } = require('../../src/routes/memories/engine');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (text) => ({ content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } });
const TITLE = 'Book rules test';

(shouldSkip ? describe.skip : describe)("the book's AI reads the franchise's rules only", () => {
  let token;
  let reviewId;
  const showId = crypto.randomUUID();
  // A review names its story by the story's UUID (migration 20261008210000).
  const storyId = crypto.randomUUID();
  const t = {
    franchise: `${TITLE}: franchise law`,
    show: `${TITLE}: a show's own canon`,
    unassigned: `${TITLE}: show canon not yet assigned`,
    character: `${TITLE}: a law about one character`,
  };

  const insert = ({ title, scope = 'franchise', show = null, always = true, appliesTo = [] }) => run(
    `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, applies_to, status, scope, show_id, created_at, updated_at)
     VALUES (:title, :content, 'franchise_law', 'critical', :always, :applies::jsonb, 'active', :scope, :show, NOW(), NOW())`,
    { title, content: `${title}, in full.`, always, applies: JSON.stringify(appliesTo), scope, show });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-book-rules', email: 'test@book-rules.dev', name: 'Book Rules Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    // As the seeded laws are: always-inject, applies_to naming systems.
    await insert({ title: t.franchise, appliesTo: ['story_engine', 'scene_generation'] });
    await insert({ title: t.show, scope: 'show', show: showId, appliesTo: ['show_brain'] });
    await insert({ title: t.unassigned, scope: 'show', appliesTo: [] });
    await insert({ title: t.character, always: false, appliesTo: ['book_test_char'] });
    await run(`INSERT INTO storyteller_stories (id, character_key, story_number, title, text, story_a, created_at, updated_at)
               VALUES (:id, 'book_test_char', 1, 'Book rules test story', 'The approved scene.', 'The approved scene.', NOW(), NOW())`, { id: storyId });
  });

  afterAll(async () => {
    if (reviewId) await run(`DELETE FROM post_generation_reviews WHERE id = :id`, { id: reviewId });
    await run(`DELETE FROM storyteller_stories WHERE id = :id`, { id: storyId });
    await run(`DELETE FROM franchise_knowledge WHERE title LIKE :like`, { like: `${TITLE}%` });
  });

  beforeEach(() => mockCreate.mockReset());

  it("story evaluation: the franchise law reaches the story, no show's canon does, and a character's law only with its character", async () => {
    const block = await loadFranchiseConstraints(['someone_else']);
    expect(block).toContain(t.franchise);
    for (const x of [t.show, t.unassigned, t.character]) expect(block).not.toContain(x);
    expect(await loadFranchiseConstraints(['book_test_char'])).toContain(t.character);
  });

  it("WriteMode: the franchise's entries, never a show's", async () => {
    const block = await loadFranchiseKnowledge('book_test_char');
    expect(block).toContain(t.franchise);
    expect(block).not.toContain(t.show);
    expect(block).not.toContain(t.unassigned);
  });

  it("the tier guard checks a scene against the franchise's laws only", async () => {
    mockCreate.mockResolvedValue(reply('{"violations": [], "score": 100, "summary": "Clean."}'));
    const res = await request(app).post('/api/v1/tier/franchise-guard-check').set('Authorization', `Bearer ${token}`)
      .send({ scene_text: 'JustAWoman opens the studio at dawn.' });
    expect(res.status).toBe(200);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(t.franchise);
    expect(prompt).not.toContain(t.show);
    expect(prompt).not.toContain(t.unassigned);
  });

  it("the post-generation review reads the franchise's critical laws only", async () => {
    mockCreate.mockResolvedValue(reply('{"violations": [], "warnings": [], "passed": true, "overall_assessment": "Clean.", "strongest_moment": ""}'));
    const res = await request(app).post('/api/v1/reviews/post-generation').set('Authorization', `Bearer ${token}`).send({ story_id: storyId });
    expect(res.status).toBe(200);
    reviewId = res.body.review_id;
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(t.franchise);
    expect(prompt).toContain(t.character);
    expect(prompt).not.toContain(t.show);
    expect(prompt).not.toContain(t.unassigned);
  });
});
