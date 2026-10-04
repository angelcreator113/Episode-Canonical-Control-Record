/**
 * lib/feedRelationship — relationship changes are posts (docs/FEED_POSTS.md
 * rule 8, 2026-10-04): the sentence written and read back agree, and the
 * current status is the poster's newest live status post.
 */
import { describe, test, expect } from 'vitest';
import { relationshipText, parseRelationship, latestStatus, RELATIONSHIP_POST_TYPE } from './feedRelationship';

const rel = (content_text, extra = {}) => ({ post_type: RELATIONSHIP_POST_TYPE, content_text, ...extra });

describe('feedRelationship', () => {
  test('writes the 2009 sentences and reads them back', () => {
    const a = relationshipText({ kind: 'status', status: "It's complicated" });
    expect(a).toBe('changed her relationship status to "It\'s complicated."');
    expect(parseRelationship(rel(a))).toEqual({ kind: 'status', status: "It's complicated" });
    expect(relationshipText({ kind: 'status', status: 'Single.' })).toBe('changed her relationship status to "Single."');
    const b = relationshipText({ kind: 'friends', withName: 'Marcus' });
    expect(b).toBe('and Marcus are now friends.');
    expect(parseRelationship(rel(b))).toEqual({ kind: 'friends', withName: 'Marcus' });
    expect(relationshipText({ kind: 'status', status: '  ' })).toBeNull();
    expect(relationshipText({ kind: 'friends', withName: '' })).toBeNull();
  });
  test('only relationship posts parse; an unrecognised one is "other"', () => {
    expect(parseRelationship({ post_type: 'post', content_text: 'and Marcus are now friends.' })).toBeNull();
    expect(parseRelationship(rel('moved to Velvet City.'))).toEqual({ kind: 'other' });
    expect(parseRelationship(null)).toBeNull();
  });
  test('latestStatus is the poster\'s newest live status post, drafts and others ignored', () => {
    const posts = [
      rel('changed her relationship status to "Single."', { poster_handle: 'lala', posted_at: '2026-10-01T10:00:00Z', status: 'live' }),
      rel('changed her relationship status to "It\'s complicated."', { poster_handle: 'lala', posted_at: '2026-10-03T10:00:00Z', status: 'live' }),
      rel('changed her relationship status to "Engaged."', { poster_handle: 'lala', posted_at: '2026-10-04T10:00:00Z', status: 'draft' }),
      rel('changed her relationship status to "Married."', { poster_handle: 'rival', posted_at: '2026-10-05T10:00:00Z', status: 'live' }),
      rel('and Marcus are now friends.', { poster_handle: 'lala', posted_at: '2026-10-06T10:00:00Z', status: 'live' }),
    ];
    expect(latestStatus(posts, 'lala')).toBe("It's complicated");
    expect(latestStatus(posts, 'rival')).toBe('Married');
    expect(latestStatus(posts, 'nobody')).toBeNull();
  });
});
