// ============================================================================
// UNIT TEST — feed post status at every door (the Feed project, step 2)
// ============================================================================
// The list and the show timeline answer live posts unless ?status= says
// otherwise; the episode's own feed answers both; PUT refuses a live post
// with 409 (2009: no edit button) and only accepts draft|live; posts
// created inside an episode start as drafts (the generator, a ripple
// reply to a draft, a financial post tied to an episode); publishing the
// episode sets them live.

const fs = require('fs');
const path = require('path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const routes = read('src', 'routes', 'feedPostRoutes.js');
const slice = (src, from, to) => { const a = src.indexOf(from); return src.slice(a, src.indexOf(to, a)); };

describe('feed post status contract', () => {
  test('the list and the timeline scope by status, live by default', () => {
    const list = slice(routes, "router.get('/', optionalAuth", '// ── GENERATE FEED POSTS');
    const timeline = slice(routes, "router.get('/:showId/timeline'", '// ── GET EPISODE FEED');
    expect(list).toMatch(/const scoped = statusWhere\(status\);[\s\S]*?const where = \{ deleted_at: null, \.\.\.scoped \}/);
    expect(timeline).toMatch(/const scoped = statusWhere\(status\);[\s\S]*?const where = \{ show_id: showId, deleted_at: null, \.\.\.scoped \}/);
  });
  test('the episode feed answers drafts and live posts alike', () => {
    const episode = slice(routes, "router.get('/episode/:episodeId'", '// ── UPDATE POST');
    expect(episode).toMatch(/statusWhere\(req\.query\.status === undefined \? 'all' : req\.query\.status\)/);
  });
  test('PUT refuses a live post and accepts only draft or live as a status', () => {
    const put = slice(routes, "router.put('/:postId'", '// ── DELETE POST');
    expect(put).toMatch(/if \(isLive\(post\)\) return res\.status\(409\)\.json\(\{ error: LOCKED_MESSAGE/);
    expect(put).toMatch(/!\['draft', 'live'\]\.includes\(req\.body\.status\)/);
    expect(put).toMatch(/const updatable = \['status', 'content_text'/);
  });
  test('posts created inside an episode start as drafts', () => {
    expect(read('src', 'services', 'feedPostGeneratorService.js')).toMatch(/sort_order: i,\s*\/\/[^\n]*\n\s*status: 'draft',/);
    expect(read('src', 'services', 'feedEngagementService.js')).toMatch(/status: post\.status === 'draft' \? 'draft' : 'live'/);
    const fin = read('src', 'services', 'financialFeedService.js');
    expect(fin).toMatch(/timeline_position, status, created_at, updated_at/);
    expect(fin).toMatch(/status: post\.episode_id \? 'draft' : 'live'/);
  });
  test('publishing the episode sets its drafts live', () => {
    const ctl = read('src', 'controllers', 'episodeController.js');
    expect(ctl).toMatch(/if \(updateData\.status === 'published' && oldValues\.status !== 'published'\) \{[\s\S]*?publishEpisodePosts\(require\('\.\.\/models'\), id\)/);
    expect(ctl).toMatch(/console\.error\('\[Episode\] publishing the feed posts failed/);
  });
  test('the model declares the column', () => {
    expect(read('src', 'models', 'FeedPost.js')).toMatch(/status: \{\s*type: DataTypes\.STRING\(16\), allowNull: false, defaultValue: 'live',\s*validate: \{ isIn: \[\['draft', 'live'\]\] \}/);
  });
});
