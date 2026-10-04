// ============================================================================
// UNIT TEST — a beat points at a post (the Feed project, step 3)
// ============================================================================
// The moments read carries each moment's linked post; PUT
// /:showId/moments/:momentId/post links or unlinks through
// services/feedMomentLink (its errors keep their status); GET
// /feed-posts/post/:postId serves one post to the One Post zone; the
// model declares feed_post_id and the association.

const fs = require('fs');
const path = require('path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const enhanced = read('src', 'routes', 'feedEnhancedRoutes.js');
const posts = read('src', 'routes', 'feedPostRoutes.js');

describe('feed moment ↔ post contract', () => {
  test('the moments read includes the linked post', () => {
    expect(enhanced).toMatch(/include: FeedPost \? \[\{ model: FeedPost, as: 'post', attributes: POST_ATTRIBUTES, required: false \}\] : \[\]/);
  });
  test('PUT /:showId/moments/:momentId/post links through the service, requireAuth', () => {
    expect(enhanced).toMatch(/router\.put\('\/:showId\/moments\/:momentId\/post',\s*requireAuth,\s*async/);
    expect(enhanced).toMatch(/linkMomentToPost\(require\('\.\.\/models'\), \{\s*showId: req\.params\.showId, momentId: req\.params\.momentId, feedPostId: req\.body\?\.feed_post_id \?\? null,/);
    expect(enhanced).toMatch(/if \(err\.status\) return res\.status\(err\.status\)\.json\(\{ error: err\.message \}\)/);
  });
  test('GET /feed-posts/post/:postId serves one post (public catalog read)', () => {
    expect(posts).toMatch(/router\.get\('\/post\/:postId',\s*optionalAuth,\s*async/);
    expect(posts).toMatch(/where: \{ id: req\.params\.postId, deleted_at: null \}/);
  });
  test('the model declares feed_post_id and the post association', () => {
    const model = read('src', 'models', 'FeedMoment.js');
    expect(model).toMatch(/feed_post_id: \{ type: DataTypes\.UUID, allowNull: true \}/);
    expect(model).toMatch(/FeedMoment\.belongsTo\(models\.FeedPost, \{ foreignKey: 'feed_post_id', as: 'post' \}\)/);
  });
  test('the phone has a One Post zone with a post picker', () => {
    const renderer = read('frontend', 'src', 'components', 'ScreenContentRenderer.jsx');
    const editor = read('frontend', 'src', 'components', 'ContentZoneEditor.jsx');
    expect(renderer).toMatch(/\{ key: 'feed_post', label: 'One Post'/);
    expect(renderer).toMatch(/case 'feed_post':\s*return <SinglePostRenderer config=\{config\} \/>/);
    // The picker serves the One Post zone and, since the Comments zone read records, that zone too.
    expect(editor).toMatch(/\['feed_post', 'comments_list'\]\.includes\(zone\.content_type\)/);
    expect(editor).toMatch(/handleConfigChange\('post_id'/);
  });
});

describe('put a post at a beat (2026-10-04)', () => {
  test('POST /:showId/moments/:episodeId/beat creates through the service, requireAuth, 201 when new', () => {
    expect(enhanced).toMatch(/router\.post\('\/:showId\/moments\/:episodeId\/beat',\s*requireAuth,\s*async/);
    expect(enhanced).toMatch(/createMomentForPost\(require\('\.\.\/models'\), \{/);
    expect(enhanced).toMatch(/res\.status\(created \? 201 : 200\)/);
  });
  test('the single-post read says which beats show the post', () => {
    expect(posts).toMatch(/where: \{ feed_post_id: post\.id, deleted_at: null \}/);
    expect(posts).toMatch(/beats: beats\.map\(\(b\) => \(\{ moment_id: b\.id, episode_id: b\.episode_id, beat_number: b\.beat_number/);
  });
});

describe('the story clock (docs/FEED_POSTS.md rule 9)', () => {
  test('a wall post is stamped with the present; the wall list carries the episode number', () => {
    expect(posts).toMatch(/story_order: episode_id \? null : await require\('\.\.\/services\/storyClock'\)\.presentOrder\(require\('\.\.\/models'\), show_id\)/);
    expect(posts).toMatch(/withWhat === 'comments' && Episode \? \[\{ model: Episode, as: 'episode', attributes: \['id', 'episode_number'\], required: false \}\]/);
  });
  test('putting a post at a beat answers the story check', () => {
    expect(enhanced).toMatch(/story_check: story,/);
  });
});
