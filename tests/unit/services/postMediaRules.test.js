/**
 * Visual Memory phase 2 rules (services/postMedia): how many pictures each
 * Pulse format takes, when a story ends, which format delivers a deal's
 * deliverable, how pictures are ranked for a caption (the same every time;
 * still lifes before portraits), and what the public feed may show.
 */
const pm = require('../../../src/services/postMedia');
const { DELIVERABLE_FORMATS: DELIVERABLES } = require('../../../src/utils/deliverableFormats');

describe('postMedia rules', () => {
  test('formats: a carousel takes 2 to 10 pictures; a story, a video and a live one at most', () => {
    expect(pm.FORMATS).toEqual(['post', 'carousel', 'story', 'video', 'live', 'text', 'quote']);
    expect(() => pm.checkFormat('carousel', 1)).toThrow(/at least 2/);
    expect(pm.checkFormat('carousel', 2)).toBe('carousel');
    expect(pm.checkFormat('carousel', 10)).toBe('carousel');
    expect(() => pm.checkFormat('carousel', 11)).toThrow(/up to 10/);
    expect(() => pm.checkFormat('story', 2)).toThrow(/one picture/);
    expect(pm.checkFormat('post', 0)).toBe('post');
    expect(() => pm.checkFormat('post', 5)).toThrow(/up to 4/);
    expect(() => pm.checkFormat('reel', 1)).toThrow(/format must be one of/);
  });

  test('a post with no format reads as its older post_type story / live / reel, else a post', () => {
    expect(pm.formatOf({ post_format: 'carousel', post_type: 'relationship' })).toBe('carousel');
    expect(pm.formatOf({ post_type: 'story' })).toBe('story');
    expect(pm.formatOf({ post_type: 'reel' })).toBe('video');
    expect(pm.formatOf({ post_type: 'relationship' })).toBe('post');
  });

  test('a live story ends 24 hours after it went live; a draft story never has', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    expect(pm.storyExpired({ post_format: 'story', status: 'live', posted_at: '2026-10-18T11:59:00Z' }, now)).toBe(true);
    expect(pm.storyExpired({ post_format: 'story', status: 'live', posted_at: '2026-10-18T13:00:00Z' }, now)).toBe(false);
    expect(pm.storyExpired({ post_format: 'story', status: 'draft', posted_at: '2026-10-01T00:00:00Z' }, now)).toBe(false);
    expect(pm.storyExpired({ post_format: 'post', status: 'live', posted_at: '2026-10-01T00:00:00Z' }, now)).toBe(false);
  });

  test('every deliverable it maps is a real deliverable, to a real format', () => {
    for (const [key, format] of Object.entries(pm.FORMAT_FOR_DELIVERABLE)) {
      expect(DELIVERABLES[key]).toBeTruthy();
      expect(pm.FORMATS).toContain(format);
    }
    expect(pm.FORMAT_FOR_DELIVERABLE).toMatchObject({ carousel_post: 'carousel', pulse_stories: 'story', go_live: 'live', pulse_video: 'video', pulse_post: 'post' });
  });

  const library = [
    { id: 'p1', source: 'portrait', caption: 'Maren, portrait', details: {}, links: [], status: 'approved', visibility: 'public', created_at: '2026-10-10' },
    { id: 'b1', source: 'upload', caption: 'Dough rising in a ceramic bowl', details: { objects: ['bread', 'ceramic bowl'] }, links: [], status: 'approved', visibility: 'internal', created_at: '2026-10-11' },
    { id: 'k1', source: 'scene_set', caption: 'Morning light', details: {}, links: [{ entity_type: 'scene_set', role: 'location', name: "Maren's kitchen" }], status: 'approved', visibility: 'public', created_at: '2026-10-09' },
    { id: 'g1', source: 'upload', caption: 'Gala gown on the runway', details: {}, links: [], status: 'approved', visibility: 'public', created_at: '2026-10-12' },
  ];

  test('Maren\'s "still here. the bread is rising." ranks the dough first, never the gala, and the portrait below', () => {
    const ranked = pm.rankPictures('still here. the bread is rising.', library);
    expect(ranked[0].asset.id).toBe('b1');
    expect(ranked[0].why.join(' ')).toMatch(/bread/);
    const ids = ranked.map((r) => r.asset.id);
    expect(ids.indexOf('p1')).toBeGreaterThan(ids.indexOf('g1'));
    expect(ranked.find((r) => r.asset.id === 'g1').score).toBe(0);
    expect(pm.rankPictures('still here. the bread is rising.', [...library].reverse()).map((r) => r.asset.id)).toEqual(ids);
  });

  test('a setting word finds their place, and an outfit caption wants the portrait', () => {
    expect(pm.rankPictures('slow morning in the kitchen', library)[0].asset.id).toBe('k1');
    expect(pm.rankPictures('today\'s outfit, mirror check', library)[0].asset.id).toBe('p1');
  });

  test('the public feed drops library pictures that are not approved and public, and ended stories', async () => {
    const db = { sequelize: { query: jest.fn().mockResolvedValue([[{ url: 'https://img/private.jpg' }]]) } };
    const now = new Date('2026-10-19T12:00:00Z');
    const out = await pm.publicPosts(db, [
      { id: 'a', status: 'live', image_url: 'https://img/private.jpg', image_description: 'x', photos: [{ url: 'https://img/private.jpg' }, { url: 'https://img/ok.jpg' }] },
      { id: 'b', status: 'live', post_format: 'story', posted_at: '2026-10-17T00:00:00Z' },
      { id: 'c', status: 'live', image_url: 'https://img/private.jpg', photos: null },
    ], { now });
    expect(out.map((p) => p.id)).toEqual(['a', 'c']);
    expect(out[0].photos).toEqual([{ url: 'https://img/ok.jpg' }]);
    expect(out[0].image_url).toBe('https://img/ok.jpg');
    expect(out[1].image_url).toBeNull();
    expect(out[1].image_description).toBeNull();
  });
});
