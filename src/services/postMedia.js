'use strict';

/**
 * Visual Memory, phase 2, with real Pulse post formats (Evoni's "Character
 * Visual Memory System"; 2026-10-19: "yes start phase 2 with the post types
 * after visual memory"). A post points at pictures in the shared library
 * (services/mediaLibrary): the file is never copied, only its URL is put on
 * the post. Its caption is never changed. A picture never makes a story fact.
 *
 *   FORMATS / formatOf(post)   post | carousel | story | video | live | text |
 *                       quote (words only, no picture); null
 *                       post_format reads as the older post_type story / live
 *                       / reel, else 'post'
 *   checkFormat(format, n)     how many pictures each format takes
 *   FORMAT_FOR_DELIVERABLE        a deal deliverable (utils/deliverableFormats)
 *                       → the post format that delivers it (for the later
 *                       "deliverables that check themselves")
 *   STORY_HOURS, storyExpired(post, now)   a story leaves The Pulse 24 hours
 *                       after it went live (posted_at)
 *   pictureEditor(db, postId)  the post, its pictures, and its poster's library
 *   attachPictures(db, postId, { assetIds, format, by })   replaces the post's
 *                       pictures with these library pictures, in this order;
 *                       a live (or scheduled) post may only use pictures that
 *                       are approved and public (409 with the ones that aren't)
 *   publishProblems(db, post)  the post's library pictures that are not yet
 *                       approved and public: what stops it going live
 *   approvePictures(db, postId)  Evoni's one click: those pictures approved
 *                       and public
 *   blockedUrls(db, urls)      the URLs of library pictures that are not
 *                       approved and public, for the public feed to drop
 *   publicPosts(db, posts, { now })   a feed's posts as the public may see them:
 *                       no non-public library picture, no expired story
 *   needsPicture(db, { showId, characterId, limit })   posts with no picture
 *   suggestFor(db, postId, { limit })   the poster's library pictures ranked
 *                       for its caption: words they share, the setting, and
 *                       still lifes before portraits ("Not every post needs a
 *                       portrait"). Deterministic; no AI.
 */

const media = require('./mediaLibrary');
const { notConfidentialSql } = require('../utils/confidentialCharacters');

const { MediaError } = media;

// text and quote are words only (Evoni, 2026-10-19: "text and quote stay text";
// services/postPictures makes pictures for post and carousel only).
const FORMATS = Object.freeze(['post', 'carousel', 'story', 'video', 'live', 'text', 'quote']);
const FORMAT_LABELS = Object.freeze({ post: 'Post', carousel: 'Carousel', story: 'Story', video: 'Pulse video', live: 'Live', text: 'Text', quote: 'Quote' });
// How many pictures each format takes: [fewest, most].
const PICTURES = Object.freeze({ post: [0, 4], carousel: [2, 10], story: [0, 1], video: [0, 1], live: [0, 1], text: [0, 0], quote: [0, 0] });
const STORY_HOURS = 24;
// A deal deliverable (utils/deliverableFormats keys) → the format that delivers it.
const FORMAT_FOR_DELIVERABLE = Object.freeze({
  pulse_post: 'post', carousel_post: 'carousel', pulse_stories: 'story', pulse_video: 'video',
  grwm_video: 'video', try_on_haul: 'video', go_live: 'live',
});
const OLD_TYPES = Object.freeze({ story: 'story', live: 'live', reel: 'video' });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatOf(post) {
  if (post?.post_format && FORMATS.includes(post.post_format)) return post.post_format;
  return OLD_TYPES[post?.post_type] || 'post';
}

function checkFormat(format, count) {
  if (!FORMATS.includes(format)) throw new MediaError(400, `format must be one of ${FORMATS.join(', ')}.`);
  const [min, max] = PICTURES[format];
  if (count < min) throw new MediaError(400, `A ${FORMAT_LABELS[format].toLowerCase()} needs at least ${min} pictures.`);
  if (count > max) throw new MediaError(400, max === 0 ? `A ${FORMAT_LABELS[format].toLowerCase()} post is words only; it takes no picture.` : `A ${FORMAT_LABELS[format].toLowerCase()} takes ${max === 1 ? 'one picture' : `up to ${max} pictures`}.`);
  return format;
}

function storyExpired(post, now = new Date()) {
  if (formatOf(post) !== 'story' || post.status !== 'live' || !post.posted_at) return false;
  return new Date(post.posted_at).getTime() + STORY_HOURS * 3600000 <= now.getTime();
}

/** The URLs on a post, in order: its photos list, else its one image_url. */
function urlsOf(post) {
  const list = Array.isArray(post?.photos) ? post.photos.map((p) => p?.url).filter(Boolean) : [];
  if (list.length) return list;
  return post?.image_url ? [post.image_url] : [];
}

const notPublic = (a) => !(a.status === 'approved' && a.visibility === 'public' && !a.deleted_at);

async function loadPost(db, postId) {
  if (!UUID_RE.test(String(postId))) throw new MediaError(404, 'Post not found.');
  const post = await db.FeedPost.findOne({ where: { id: postId, deleted_at: null } });
  if (!post) throw new MediaError(404, 'Post not found.');
  return post;
}

/** The registry character who posts it, Dr. Sinclair kept out. */
async function posterOf(db, post) {
  if (!post.social_profile_id) return null;
  const [[row]] = await db.sequelize.query(
    `SELECT rc.id, COALESCE(rc.selected_name, rc.display_name) AS name FROM registry_characters rc
      WHERE rc.feed_profile_id = :pid AND rc.deleted_at IS NULL AND ${notConfidentialSql('rc')} ORDER BY rc.created_at ASC LIMIT 1`,
    { replacements: { pid: post.social_profile_id } });
  return row || null;
}

/** The post's library pictures, in the post's order (photos), with the ones only linked after. */
async function picturesOf(db, post) {
  const byUrl = await media.assetsByUrl(db, urlsOf(post));
  return urlsOf(post).map((url) => ({ url, asset: byUrl.get(url) || null }));
}

async function publishProblems(db, post) {
  const pics = await picturesOf(db, post);
  return pics.filter((p) => p.asset && notPublic(p.asset)).map((p) => ({ id: p.asset.id, url: p.url, status: p.asset.status, visibility: p.asset.visibility }));
}

async function pictureEditor(db, postId) {
  const post = await loadPost(db, postId);
  const poster = await posterOf(db, post);
  const library = poster ? await media.listFor(db, { entityType: 'character', entityId: poster.id, audience: 'admin' }) : [];
  return {
    post: {
      id: post.id, status: post.status, content_text: post.content_text, release_state: post.release_state || null,
      format: formatOf(post), photos: urlsOf(post),
    },
    poster,
    pictures: await picturesOf(db, post),
    library,
    formats: FORMATS.map((f) => ({ key: f, label: FORMAT_LABELS[f], min: PICTURES[f][0], max: PICTURES[f][1] })),
  };
}

async function attachPictures(db, postId, { assetIds = [], format = null, by = null } = {}) {
  const post = await loadPost(db, postId);
  if (!Array.isArray(assetIds)) throw new MediaError(400, 'asset_ids must be a list.');
  const ids = [...new Set(assetIds.map(String))];
  const fmt = checkFormat(format || formatOf(post), ids.length);
  const assets = [];
  for (const id of ids) assets.push(await media.getAsset(db, id));
  // Going out, or already out: only approved, public pictures.
  const goingOut = post.status === 'live' || post.release_state === 'scheduled';
  const blocked = goingOut ? assets.filter(notPublic) : [];
  if (blocked.length) {
    const err = new MediaError(409, `${blocked.length === 1 ? 'A picture is' : `${blocked.length} pictures are`} not approved and public yet, and this post ${post.status === 'live' ? 'is on The Pulse' : 'is scheduled'}.`);
    err.pictures = blocked.map((a) => ({ id: a.id, url: a.url, status: a.status, visibility: a.visibility }));
    throw err;
  }
  // The post's tags in the library: these pictures, and no others.
  await db.sequelize.query(
    `UPDATE media_asset_links SET deleted_at = NOW(), updated_at = NOW()
      WHERE entity_type = 'post' AND entity_id = :pid AND deleted_at IS NULL ${ids.length ? 'AND asset_id NOT IN (:ids)' : ''}`,
    { replacements: { pid: post.id, ids } });
  for (const a of assets) await media.linkAsset(db, a.id, { entity_type: 'post', entity_id: post.id, role: 'pictured' }, { by });
  const photos = assets.map((a) => ({ url: a.url, alt: String(a.caption || '').slice(0, 300) }));
  const first = photos[0] || null;
  const newFirst = (first?.url || null) !== (post.image_url || null);
  // The caption (content_text) is never touched.
  await post.update({
    photos: photos.length ? photos : null,
    image_url: first?.url || null,
    image_description: first ? (first.alt || post.image_description || null) : null,
    post_format: fmt === 'post' && !post.post_format ? null : fmt,
  });
  if (newFirst) {
    const teasers = require('./pulseTeasers');
    await teasers.recutFor(db, teasers.postReveals(post.id));
  }
  return pictureEditor(db, post.id);
}

async function approvePictures(db, postId) {
  const post = await loadPost(db, postId);
  const problems = await publishProblems(db, post);
  // Approving never makes a private camera-roll photo public: its moment has
  // to be marked posted first (services/cameraRoll; Evoni, 2026-10-19).
  const assets = await Promise.all(problems.map((p) => media.getAsset(db, p.id)));
  const privateRoll = assets.filter((a) => media.isPrivateCameraRoll(a));
  if (privateRoll.length) {
    const err = new MediaError(409, `${privateRoll.length === 1 ? 'A picture is' : `${privateRoll.length} pictures are`} from a private camera roll. Mark the moment as posted on their Gallery tab first.`);
    err.pictures = privateRoll.map((a) => ({ id: a.id, url: a.url, status: a.status, visibility: a.visibility }));
    throw err;
  }
  for (const p of problems) await media.updateAsset(db, p.id, { status: 'approved', visibility: 'public' });
  return { approved: problems.map((p) => p.id) };
}

async function blockedUrls(db, urls) {
  const list = [...new Set((urls || []).filter(Boolean))];
  if (!list.length) return new Set();
  const [rows] = await db.sequelize.query(
    `SELECT url FROM media_assets WHERE deleted_at IS NULL AND NOT (status = 'approved' AND visibility = 'public')
        AND md5(url) IN (SELECT md5(u) FROM unnest(ARRAY[:urls]::text[]) AS u)`, { replacements: { urls: list } });
  return new Set(rows.map((r) => r.url));
}

/** A feed's posts (plain objects) as the public sees them. */
async function publicPosts(db, posts, { now = new Date() } = {}) {
  const shown = posts.filter((p) => !storyExpired(p, now));
  const blocked = await blockedUrls(db, shown.flatMap((p) => [...urlsOf(p), p.image_url]));
  if (!blocked.size) return shown;
  return shown.map((p) => {
    const photos = Array.isArray(p.photos) ? p.photos.filter((ph) => ph?.url && !blocked.has(ph.url)) : p.photos;
    const imageUrl = p.image_url && blocked.has(p.image_url) ? (photos?.[0]?.url || null) : p.image_url;
    const out = { ...p, photos, image_url: imageUrl };
    if (Array.isArray(p.image_urls)) out.image_urls = p.image_urls.filter((u) => !blocked.has(u));
    if (!imageUrl) out.image_description = null;
    return out;
  });
}

async function needsPicture(db, { showId = null, characterId = null, limit = 50 } = {}) {
  if (showId && !UUID_RE.test(String(showId))) throw new MediaError(400, 'show_id must be a show id.');
  if (characterId && !UUID_RE.test(String(characterId))) throw new MediaError(400, 'character_id must be a character id.');
  const [rows] = await db.sequelize.query(
    `SELECT fp.id, fp.show_id, fp.status, fp.content_text, fp.poster_handle, fp.posted_at, fp.post_format, fp.post_type,
            rc.id AS character_id, COALESCE(rc.selected_name, rc.display_name) AS name
       FROM feed_posts fp JOIN registry_characters rc ON rc.feed_profile_id = fp.social_profile_id AND rc.deleted_at IS NULL
      WHERE fp.deleted_at IS NULL AND fp.status IN ('draft', 'live') AND fp.image_url IS NULL
        AND NOT COALESCE(jsonb_typeof(fp.photos) = 'array' AND jsonb_array_length(fp.photos) > 0, false)
        AND COALESCE(fp.content_text, '') <> '' AND ${notConfidentialSql('rc')}
        ${showId ? 'AND fp.show_id = :showId' : ''} ${characterId ? 'AND rc.id = :characterId' : ''}
      ORDER BY COALESCE(fp.posted_at, fp.created_at) DESC LIMIT ${Math.min(Number(limit) || 50, 200)}`,
    { replacements: { showId, characterId } });
  return rows.map((r) => ({ ...r, format: formatOf(r) }));
}

// ── Suggestions ─────────────────────────────────────────────────────────────
const STOP = new Set(('the and for are but not you all any can had her was one our out day get has him his how man new now old see two way who '
  + 'boy did its let put say she too use that with have this will your from they know want been good much some time very when come here '
  + 'just like long make many over such take than them well were what into still more only also back after most really today about').split(' '));
// Setting words: a caption naming one wants a picture of that place.
const SETTINGS = Object.freeze(['kitchen', 'studio', 'home', 'bedroom', 'closet', 'office', 'cafe', 'street', 'garden', 'gym', 'salon', 'store', 'shop', 'car', 'beach', 'balcony', 'bathroom', 'atelier', 'runway', 'club', 'gallery', 'market']);
// Words that ask for the person themselves.
const SELF = Object.freeze(['selfie', 'outfit', 'look', 'face', 'fit', 'wearing', 'mirror', 'me', 'hair', 'makeup']);

/** Words, lowercased, without the commonest endings. */
function stems(text) {
  return [...new Set(String(text || '').toLowerCase().match(/[a-z']+/g) || [])]
    .map((w) => w.replace(/'s$/, '').replace(/(ing|ed|es|s)$/, ''))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function assetText(a) {
  const d = a.details || {};
  const parts = [a.caption, ...Object.values(d).flat(), ...(a.links || []).map((l) => l.name)];
  return parts.filter(Boolean).join(' ');
}

/** Rank pictures for a caption; the same caption and pictures always give the same order. */
function rankPictures(caption, assets) {
  const words = stems(caption);
  const raw = String(caption || '').toLowerCase();
  const settings = SETTINGS.filter((s) => raw.includes(s));
  const wantsSelf = SELF.some((s) => new RegExp(`\\b${s}\\b`).test(raw));
  return assets.map((a) => {
    const have = new Set(stems(assetText(a)));
    const shared = words.filter((w) => have.has(w));
    const places = (a.links || []).filter((l) => l.entity_type === 'scene_set' || l.role === 'location');
    const atSetting = settings.filter((s) => places.some((l) => String(l.name || '').toLowerCase().includes(s)) || have.has(s));
    let score = shared.length * 2 + atSetting.length * 3;
    const portrait = a.source === 'portrait' || a.source === 'cover';
    if (portrait && !wantsSelf) score -= 1;
    if (portrait && wantsSelf) score += 1;
    const ready = !notPublic(a);
    return {
      asset: a, score, ready,
      why: [
        ...(shared.length ? [`shares ${shared.slice(0, 4).join(', ')}`] : []),
        ...(atSetting.length ? [`at the ${atSetting[0]}`] : []),
        ...(portrait && !wantsSelf ? ['a portrait (not every post needs one)'] : []),
      ],
    };
  }).sort((x, y) => (y.score - x.score) || (Number(y.ready) - Number(x.ready))
    || (new Date(y.asset.created_at || 0) - new Date(x.asset.created_at || 0)) || String(x.asset.id).localeCompare(String(y.asset.id)));
}

async function suggestFor(db, postId, { limit = 6 } = {}) {
  const post = await loadPost(db, postId);
  const poster = await posterOf(db, post);
  if (!poster) return { post_id: post.id, suggestions: [], note: 'This post has no character in the registry, so there is no library to suggest from.' };
  // A camera-roll photo they did not post is never offered for a post (private stays private).
  const library = (await media.listFor(db, { entityType: 'character', entityId: poster.id, audience: 'admin' }))
    .filter((a) => !media.isPrivateCameraRoll(a));
  const ranked = rankPictures(post.content_text, library).filter((r) => r.score > 0).slice(0, Math.min(Number(limit) || 6, 20));
  return {
    post_id: post.id,
    suggestions: ranked.map((r) => ({ id: r.asset.id, url: r.asset.url, caption: r.asset.caption, status: r.asset.status, visibility: r.asset.visibility, score: r.score, ready: r.ready, why: r.why })),
  };
}

module.exports = {
  FORMATS, FORMAT_LABELS, PICTURES, STORY_HOURS, FORMAT_FOR_DELIVERABLE, SETTINGS,
  formatOf, checkFormat, storyExpired, urlsOf, stems, rankPictures, assetText, notPublic, loadPost, posterOf,
  pictureEditor, attachPictures, publishProblems, approvePictures, blockedUrls, publicPosts, needsPicture, suggestFor,
};
