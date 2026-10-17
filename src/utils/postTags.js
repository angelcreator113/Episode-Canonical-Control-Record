'use strict';

/**
 * A post's tags (feed_posts.tags; Evoni, 2026-10-17): her own labels, such
 * as Studio, Design Process or BTS. cleanTags trims and collapses spaces,
 * drops empties and repeats (ignoring case, the first spelling kept), and
 * refuses anything that is not a list of short strings.
 */

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;

function cleanTags(input) {
  if (!Array.isArray(input)) return { error: 'tags must be a list' };
  const seen = new Set();
  const tags = [];
  for (const raw of input) {
    if (typeof raw !== 'string') return { error: 'each tag must be text' };
    const tag = raw.replace(/\s+/g, ' ').trim();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) return { error: `a tag is ${MAX_TAG_LENGTH} characters at most` };
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return { error: `${MAX_TAGS} tags at most` };
  return { tags };
}

module.exports = { MAX_TAGS, MAX_TAG_LENGTH, cleanTags };
