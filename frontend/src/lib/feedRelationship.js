/**
 * Relationship changes are posts (the Feed project, docs/FEED_POSTS.md
 * rule 8, 2026-10-04). A relationship change is a feed post with
 * post_type 'relationship', so it has a story time, draft or live, likes
 * and comments like any post, and every screen draws that one record:
 * the wall, the One Post zone, the Relationship Changes zone, the
 * profile's Relationship Status line.
 *
 * The sentence is written by relationshipText and read back by
 * parseRelationship, so the two always agree:
 *   status  — changed her relationship status to "It's complicated."
 *   friends — and Marcus are now friends.
 */

export const RELATIONSHIP_POST_TYPE = 'relationship';
export const STATUSES = ['Single', 'In a relationship', 'Engaged', 'Married', "It's complicated", 'In an open relationship', 'Widowed'];

export function relationshipText({ kind, status, withName }) {
  if (kind === 'status') {
    const s = String(status || '').trim().replace(/[."]+$/, '');
    return s ? `changed her relationship status to "${s}."` : null;
  }
  if (kind === 'friends') {
    const w = String(withName || '').trim();
    return w ? `and ${w} are now friends.` : null;
  }
  return null;
}

const STATUS_RE = /relationship status to "([^"]+?)\.?"/i;
const FRIENDS_RE = /^and (.+?) are now friends\.?$/i;

/** { kind: 'status', status } | { kind: 'friends', withName } | null */
export function parseRelationship(post) {
  if (!post || post.post_type !== RELATIONSHIP_POST_TYPE) return null;
  const text = String(post.content_text || '').trim();
  const s = STATUS_RE.exec(text);
  if (s) return { kind: 'status', status: s[1] };
  const f = FRIENDS_RE.exec(text);
  if (f) return { kind: 'friends', withName: f[1] };
  return { kind: 'other' };
}

/**
 * The poster's current relationship status from their newest live
 * relationship-status post, else null (the profile field stays the
 * fallback). Posts may arrive in any order.
 */
export function latestStatus(posts, handle) {
  const h = String(handle || '').toLowerCase();
  const mine = (posts || [])
    .filter((p) => p.status !== 'draft' && String(p.poster_handle || p.socialProfile?.handle || '').toLowerCase() === h)
    .map((p) => ({ p, r: parseRelationship(p) }))
    .filter((x) => x.r?.kind === 'status')
    .sort((a, b) => new Date(b.p.posted_at || 0) - new Date(a.p.posted_at || 0));
  return mine[0]?.r.status || null;
}
