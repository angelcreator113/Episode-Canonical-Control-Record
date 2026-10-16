'use strict';

jest.mock('../../../src/services/characterEvents', () => ({
  eventsForProfile: jest.fn(),
}));

const { eventsForProfile } = require('../../../src/services/characterEvents');
const { storyTrailOf, nameRegex } = require('../../../src/services/characterStoryTrail');

function fakeSequelize(handlers) {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, opts) => {
      calls.push({ sql, opts });
      for (const [match, rows] of handlers) if (sql.includes(match)) return [rows];
      return [[]];
    }),
  };
}

describe('nameRegex', () => {
  test('joins display and real name, strips @, dedupes case-insensitively', () => {
    expect(nameRegex({ display_name: '@NiaVale', selected_name: 'niavale' })).toBe('\\m(niavale)\\M');
    expect(nameRegex({ display_name: 'Nia Vale', selected_name: 'Marcus' })).toBe('\\m(nia vale|marcus)\\M');
  });
  test('skips names under three letters and returns null when none is usable', () => {
    expect(nameRegex({ display_name: 'Al', selected_name: null })).toBeNull();
    expect(nameRegex(null)).toBeNull();
  });
  test('escapes regex characters', () => {
    expect(nameRegex({ display_name: 'J.R. (Jr)' })).toBe('\\m(j\\.r\\. \\(jr\\))\\M');
  });
});

describe('storyTrailOf', () => {
  beforeEach(() => eventsForProfile.mockReset());

  test('with a feed profile: posts, counts, and stories/chapters by episode, key and name', async () => {
    eventsForProfile.mockResolvedValue([{ episode_id: 'ep1' }, { episode_id: 'ep1' }, { episode_id: null }]);
    const sq = fakeSequelize([
      ['FROM feed_posts fp', [{ id: 1, content_text: 'hello', status: 'published', posted_at: '2026-10-01', episode_number: 3 }]],
      ['GROUP BY status', [{ status: 'published', n: 4 }, { status: 'draft', n: 2 }, { status: 'scheduled', n: 1 }]],
      ['information_schema.columns', [{ '?column?': 1 }]],
      ['FROM stories s', [{ id: 's1', title: 'Gala', format: 'short_story', status: 'draft', word_count: null, show_id: 'sh', episode_number: 3 }]],
      ['FROM storyteller_chapters c', [{ id: 'c1', book_id: 'b1', title: 'One', chapter_number: 1, book_title: 'Before Lala', written: false }]],
    ]);
    const out = await storyTrailOf(sq, { feed_profile_id: 7, display_name: 'Nia Vale', character_key: 'nia-vale' });

    expect(eventsForProfile).toHaveBeenCalledWith(sq, 7);
    expect(out.posts).toEqual([{ id: 1, text: 'hello', status: 'published', at: '2026-10-01', episode_number: 3 }]);
    expect(out.post_counts).toEqual({ live: 5, draft: 2 });
    expect(out.stories[0]).toMatchObject({ id: 's1', word_count: 0, episode_number: 3 });
    expect(out.chapters[0]).toMatchObject({ id: 'c1', book_title: 'Before Lala', written: false });

    const story = sq.calls.find((c) => c.sql.includes('FROM stories s'));
    expect(story.sql).toMatch(/s\.episode_id IN \(:episodeIds\) OR LOWER\(s\.pov_character\) = LOWER\(:key\) OR s\.content ~\* :nameRe/);
    expect(story.opts.replacements).toEqual({ episodeIds: ['ep1'], key: 'nia-vale', nameRe: '\\m(nia vale)\\M' });
    const chapter = sq.calls.find((c) => c.sql.includes('FROM storyteller_chapters c'));
    expect(chapter.sql).toMatch(/c\.episode_id IN \(:episodeIds\) OR c\.draft_prose ~\* :nameRe/);
  });

  test('before chapters have episode_id, chapters are found by name only', async () => {
    eventsForProfile.mockResolvedValue([{ episode_id: 'ep1' }]);
    const sq = fakeSequelize([['information_schema.columns', []]]);
    await storyTrailOf(sq, { feed_profile_id: 7, display_name: 'Nia Vale' });
    const chapter = sq.calls.find((c) => c.sql.includes('FROM storyteller_chapters c'));
    expect(chapter.sql).not.toMatch(/c\.episode_id IN/);
    expect(chapter.opts.replacements).toEqual({ nameRe: '\\m(nia vale)\\M' });
  });

  test('no feed profile and no usable name: no posts, events, or chapter query', async () => {
    const sq = fakeSequelize([]);
    const out = await storyTrailOf(sq, { feed_profile_id: null, display_name: 'Al', character_key: 'al' });
    expect(eventsForProfile).not.toHaveBeenCalled();
    expect(out).toEqual({ posts: [], post_counts: { live: 0, draft: 0 }, stories: [], chapters: [] });
    expect(sq.calls.map((c) => c.sql).join('\n')).not.toMatch(/feed_posts|storyteller_chapters/);
    expect(sq.calls).toHaveLength(1); // stories by key only
  });
});
