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
