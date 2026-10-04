// ============================================================================
// UNIT TEST — comments as records (the Feed project, step 4)
// ============================================================================
// GET /:postId/comments answers live comments unless ?status=; the
// reactors read and every write are requireAuth; drafting is behind
// aiRateLimiter; PATCH refuses a live comment (2009) and approving sets
// it live with a posted_at; DELETE is the one way a live comment goes;
// the single-post read carries the live comments; the model is registered.

const fs = require('fs');
const path = require('path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const routes = read('src', 'routes', 'feedPostRoutes.js');
const slice = (from, to) => { const a = routes.indexOf(from); return routes.slice(a, routes.indexOf(to, a)); };

describe('feed comments contract', () => {
  test('the routes and their guards', () => {
    expect(routes).toMatch(/router\.get\('\/:postId\/comments',\s*optionalAuth,\s*async/);
    expect(routes).toMatch(/router\.get\('\/:postId\/comments\/reactors',\s*requireAuth,\s*async/);
    expect(routes).toMatch(/router\.post\('\/:postId\/comments',\s*requireAuth,\s*async/);
    expect(routes).toMatch(/router\.post\('\/:postId\/comments\/draft',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    expect(routes).toMatch(/router\.patch\('\/comments\/:commentId',\s*requireAuth,\s*async/);
    expect(routes).toMatch(/router\.delete\('\/comments\/:commentId',\s*requireAuth,\s*async/);
  });
  test('the list is live by default; a live comment is locked; approving dates it; deletes recount', () => {
    const list = slice("router.get('/:postId/comments'", "router.get('/:postId/comments/reactors'");
    expect(list).toMatch(/statusWhere\(req\.query\.status\)/);
    const patch = slice("router.patch('/comments/:commentId'", "router.delete('/comments/:commentId'");
    expect(patch).toMatch(/if \(comment\.status === 'live'\) return res\.status\(409\)\.json\(\{ error: COMMENT_LOCKED/);
    expect(patch).toMatch(/updates\.status = 'live'; updates\.posted_at = comment\.posted_at \|\| new Date\(\)/);
    expect(patch).toMatch(/recountComments\(models, comment\.feed_post_id\)/);
    const del = slice("router.delete('/comments/:commentId'", '// ── GET EPISODE FEED');
    expect(del).toMatch(/await comment\.destroy\(\);\s*if \(wasLive\) await recountComments/);
  });
  test('drafting goes through the drafter and keeps its status codes', () => {
    const draft = slice("router.post('/:postId/comments/draft'", "router.patch('/comments/:commentId'");
    expect(draft).toMatch(/draftReactions\(require\('\.\.\/models'\), req\.params\.postId, \{/);
    expect(draft).toMatch(/if \(err instanceof DraftError\) return res\.status\(err\.status\)/);
  });
  test('the single-post read carries the live comments, in order', () => {
    const one = slice("router.get('/post/:postId'", '// ── COMMENTS');
    expect(one).toMatch(/model: FeedComment, as: 'comments', where: \{ status: 'live' \}, required: false/);
    expect(one).toMatch(/order: FeedComment \? \[\[\{ model: FeedComment, as: 'comments' \}, 'sort_order', 'ASC'\]\]/);
  });
  test('the model is registered and associated', () => {
    const index = read('src', 'models', 'index.js');
    expect(index).toMatch(/FeedComment = require\('\.\/FeedComment'\)\(sequelize\)/);
    expect(index).toMatch(/if \(FeedComment && FeedComment\.associate\) \{\s*FeedComment\.associate\(requiredModels\);/);
    expect(index).toMatch(/module\.exports\.FeedComment = FeedComment;/);
    const model = read('src', 'models', 'FeedComment.js');
    expect(model).toMatch(/tableName: 'feed_comments'/);
    expect(model).toMatch(/models\.FeedPost\.hasMany\(FeedComment, \{ foreignKey: 'feed_post_id', as: 'comments' \}\)/);
  });
});

describe('the wall\'s routes (2026-10-04)', () => {
  test('POST /feed-posts writes a post by hand, live by default, requireAuth', () => {
    expect(routes).toMatch(/router\.post\('\/',\s*requireAuth,\s*async/);
    const create = slice("router.post('/', requireAuth", '// ── PENDING REACTION DRAFTS');
    expect(create).toMatch(/if \(!show_id\) return res\.status\(400\)/);
    expect(create).toMatch(/if \(!content_text\?\.trim\(\)\) return res\.status\(400\)/);
    expect(create).toMatch(/statusWhere\(status === undefined \? 'live' : status\)/);
    expect(create).toMatch(/posted_at: scoped\.status === 'live' \? new Date\(\) : null/);
    expect(create).toMatch(/ai_generated: false/);
  });
  test('GET /feed-posts/comments/pending lists a show\'s draft reactions with their posts, requireAuth, before the param routes', () => {
    expect(routes).toMatch(/router\.get\('\/comments\/pending',\s*requireAuth,\s*async/);
    expect(routes.indexOf("router.get('/comments/pending'")).toBeLessThan(routes.indexOf("router.get('/:showId/timeline'"));
    expect(routes.indexOf("router.get('/comments/pending'")).toBeLessThan(routes.indexOf("router.get('/:postId/comments'"));
    const pending = slice("router.get('/comments/pending'", '// ── GENERATE FEED POSTS');
    expect(pending).toMatch(/where: \{ show_id, status: 'draft', deleted_at: null \}/);
  });
  test('the list carries each post\'s live comments on ?with=comments and counts distinct posts', () => {
    const list = slice("router.get('/', optionalAuth", "router.post('/', requireAuth");
    expect(list).toMatch(/withWhat === 'comments' && FeedComment \? \[\{\s*model: FeedComment, as: 'comments', where: \{ status: 'live' \}, required: false/);
    expect(list).toMatch(/FeedPost\.count\(\{ where, distinct: true, col: 'id' \}\)/);
  });
});
