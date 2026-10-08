/**
 * The post-generation review, wired up (Evoni's ruling, 2026-10-08).
 *
 * Nothing ran it: no page sent POST /reviews/post-generation a story, the
 * route reviewed evaluation_result.approved_version or story_a rather than
 * the final text, and post_generation_reviews.story_id was an INTEGER that
 * could not hold a story's UUID (it saved parseInt of the id). Now:
 *   - Evaluate runs the review in the background on story.text, the final
 *     text the write-back puts in the manuscript, and the row names the
 *     story (story_id is a UUID referencing it, migration 20261008210000);
 *   - a newer review of a story supersedes its older ones;
 *   - GET /reviews/unacknowledged names each review's story: its title, and
 *     its chapter and book once written back (the Story Dashboard's link);
 *   - the route runs it on demand, and refuses what it cannot review.
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

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });

const TAG = crypto.randomUUID().slice(0, 8);
const ids = { book: crypto.randomUUID(), chapter: crypto.randomUUID(), story: crypto.randomUUID(), empty: crypto.randomUUID(), doomed: crypto.randomUUID() };
const FINAL = `The synthesised scene ${TAG}: JustAWoman opens the studio at dawn.`;
const FINAL_2 = `The second synthesis ${TAG}: Lala remembers where she came from.`;
const FAILED_REVIEW = {
  violations: [{ severity: 'critical', law_violated: 'Lala does not know her origin', offending_line: 'Lala remembers where she came from.', why_it_violates: 'Origin awareness.', suggested_rewrite: 'Lala feels something she cannot name.' }],
  warnings: [], passed: false, overall_assessment: `Origin drift ${TAG}.`, strongest_moment: 'The studio at dawn.',
};

// The review's call answers `review`; Evaluate's answers an evaluation.
const isReview = (params) => String(params.system || '').includes('Post-Generation Review agent');
function answer({ approved, review }) {
  mockCreate.mockImplementation(async (params) => (isReview(params)
    ? reply(review)
    : reply({ scores: {}, winner: 'voice_a', winner_reason: 'Depth.', synthesis_notes: 'Combined.', approved_version: approved })));
}

// By text, so the lookup reads either column type (an INTEGER before migration 20261008210000).
const reviewsOf = (storyId) => q(
  `SELECT id, CAST(story_id AS text) AS story_id, approved_version_reviewed, passed, author_acknowledged, deleted_at
     FROM post_generation_reviews WHERE CAST(story_id AS text) = :storyId ORDER BY id`,
  { storyId });

async function waitForReview(storyId, text) {
  for (let i = 0; i < 100; i += 1) {
    const found = (await reviewsOf(storyId)).find((r) => r.approved_version_reviewed === text && !r.deleted_at);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`no review of ${storyId} for: ${text}`);
}

(shouldSkip ? describe.skip : describe)('the post-generation review, wired up', () => {
  let token;
  const auth = () => `Bearer ${token}`;
  const evaluate = (storyId) => request(app).post('/api/v1/memories/evaluate-stories').set('Authorization', auth()).send({ story_id: storyId });
  const unacknowledged = () => request(app).get('/api/v1/reviews/unacknowledged').set('Authorization', auth());
  const reviewNow = (storyId) => request(app).post('/api/v1/reviews/post-generation').set('Authorization', auth()).send({ story_id: storyId });

  const addStory = (id, title, text) => run(
    `INSERT INTO storyteller_stories (id, character_key, story_number, title, text, story_a, story_b, story_c, status, created_at, updated_at)
     VALUES (:id, :key, 1, :title, :text, 'Voice A draft.', 'Voice B draft.', 'Voice C draft.', 'draft', NOW(), NOW())`,
    { id, key: `review_test_${id.slice(0, 8)}`, title, text });

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    token = TokenService.generateTokenPair({
      id: 'test-user-post-gen-review', email: 'test@post-gen-review.dev', name: 'Post-Gen Review Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO storyteller_books (id, title, created_at, updated_at) VALUES (:book, :title, NOW(), NOW())`,
      { book: ids.book, title: `Review test book ${TAG}` });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, title, created_at, updated_at)
               VALUES (:chapter, :book, 1, :title, NOW(), NOW())`, { ...ids, title: `Review test chapter ${TAG}` });
    await addStory(ids.story, `Review test story ${TAG}`, '');
    await addStory(ids.empty, `Review test empty ${TAG}`, '');
    await addStory(ids.doomed, `Review test doomed ${TAG}`, FINAL);
  });

  afterAll(async () => {
    const stories = [ids.story, ids.empty, ids.doomed];
    await run('DELETE FROM post_generation_reviews WHERE CAST(story_id AS text) IN (:stories)', { stories });
    await run('DELETE FROM story_revisions WHERE CAST(story_id AS text) IN (:stories)', { stories });
    await run('DELETE FROM pipeline_tracking WHERE CAST(story_id AS text) IN (:stories)', { stories });
    await run('DELETE FROM storyteller_stories WHERE id IN (:stories)', { stories });
    await run('DELETE FROM storyteller_chapters WHERE id = :chapter', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
  });

  beforeEach(() => mockCreate.mockReset());

  it('Evaluate reviews the final text in the background, and the review names the story', async () => {
    answer({ approved: FINAL, review: FAILED_REVIEW });
    const res = await evaluate(ids.story);
    expect(res.status).toBe(200);
    const review = await waitForReview(ids.story, FINAL);
    expect(review).toMatchObject({ story_id: ids.story, passed: false, author_acknowledged: false });
    // The review read story.text, the synthesis, and not a voice's draft.
    const [{ text }] = await q('SELECT text FROM storyteller_stories WHERE id = :id', { id: ids.story });
    expect(text).toBe(FINAL);
    const reviewCall = mockCreate.mock.calls.find(([p]) => isReview(p))[0];
    expect(reviewCall.messages[0].content).toContain(`APPROVED SCENE:\n${FINAL}`);
    expect(reviewCall.messages[0].content).not.toContain('Voice A draft.');
  });

  it("the unacknowledged list names each review's story: its title, then its chapter and book once written back", async () => {
    const mine = async () => (await unacknowledged()).body.reviews.filter((r) => r.story_id === ids.story);
    const before = await mine();
    expect(before).toHaveLength(1);
    expect(before[0].story).toEqual({
      id: ids.story, title: `Review test story ${TAG}`, status: 'evaluated', chapter_id: null, chapter_title: null, book_id: null,
    });
    await run('UPDATE storyteller_stories SET written_back_chapter_id = :chapter WHERE id = :story', ids);
    const [after] = await mine();
    expect(after.story).toMatchObject({ chapter_id: ids.chapter, chapter_title: `Review test chapter ${TAG}`, book_id: ids.book });
    expect(after.violations).toEqual(FAILED_REVIEW.violations);
  });

  it("evaluating again supersedes the story's older review", async () => {
    answer({ approved: FINAL_2, review: { ...FAILED_REVIEW, overall_assessment: 'Second pass.' } });
    expect((await evaluate(ids.story)).status).toBe(200);
    const newer = await waitForReview(ids.story, FINAL_2);
    const rows = await reviewsOf(ids.story);
    expect(rows.map((r) => [r.approved_version_reviewed, r.deleted_at !== null])).toEqual([[FINAL, true], [FINAL_2, false]]);
    const listed = (await unacknowledged()).body.reviews.filter((r) => r.story_id === ids.story).map((r) => r.id);
    expect(listed).toEqual([newer.id]);
  });

  it('acknowledging a review takes it off the list', async () => {
    const [current] = (await reviewsOf(ids.story)).filter((r) => !r.deleted_at);
    const ack = await request(app).post(`/api/v1/reviews/${current.id}/acknowledge`).set('Authorization', auth());
    expect(ack.body).toEqual({ ok: true });
    expect((await unacknowledged()).body.reviews.filter((r) => r.story_id === ids.story)).toEqual([]);
  });

  it('the route reviews a story on demand, and refuses what it cannot review', async () => {
    answer({ approved: '', review: { violations: [], warnings: [], passed: true, overall_assessment: 'Clean.', strongest_moment: '' } });
    const ok = await reviewNow(ids.doomed);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ passed: true, violations: [], requires_attention: false, overall_assessment: 'Clean.' });
    expect((await reviewsOf(ids.doomed)).map((r) => [r.id, r.story_id])).toEqual([[ok.body.review_id, ids.doomed]]);

    expect((await reviewNow('42')).status).toBe(400);
    expect((await reviewNow('42')).body).toEqual({ error: 'story_id must be a story id (UUID)' });
    expect((await reviewNow(crypto.randomUUID())).status).toBe(404);
    const empty = await reviewNow(ids.empty);
    expect(empty.status).toBe(400);
    expect(empty.body.error).toContain('no final text');

    // A reply that cannot be read is not a pass: nothing is saved.
    answer({ approved: '', review: 'not json' });
    expect((await reviewNow(ids.doomed)).status).toBe(502);
    expect(await reviewsOf(ids.doomed)).toHaveLength(1);
  });

  it("story_id is a UUID referencing the story: deleting the story deletes its reviews", async () => {
    const [col] = await q(`SELECT data_type FROM information_schema.columns WHERE table_name = 'post_generation_reviews' AND column_name = 'story_id'`);
    expect(col.data_type).toBe('uuid');
    await run('DELETE FROM storyteller_stories WHERE id = :doomed', ids);
    expect(await reviewsOf(ids.doomed)).toEqual([]);
  });
});
