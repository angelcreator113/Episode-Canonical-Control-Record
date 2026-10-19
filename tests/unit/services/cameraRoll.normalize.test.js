// ============================================================================
// The camera roll's rules (services/cameraRoll; Evoni, 2026-10-19): a moment
// keeps to known values and short text, a photographer only for work and
// events, the outfit follows the purpose, and a plan keeps to its limit with
// at most a third of its photos showing a face. No database, no AI.
// ============================================================================

const {
  normalizeMoment, normalizePlan, photoPrompt, PURPOSES, TAKERS, OUTFITS, ALBUMS,
} = require('../../../src/services/cameraRoll');

describe('normalizeMoment', () => {
  it('keeps known values and replaces unknown ones', () => {
    const m = normalizeMoment({ moment: '  coffee   and a notebook ', purpose: 'nonsense', taken_by: 'drone', album: 'nowhere', outfit: 'tuxedo' });
    expect(m).toMatchObject({ moment: 'coffee and a notebook', purpose: 'private', taken_by: 'friend', album: 'everyday', outfit: 'at_home' });
    expect(PURPOSES).toContain(m.purpose);
    expect(TAKERS).toContain(m.taken_by);
    expect(ALBUMS).toContain(m.album);
    expect(OUTFITS).toContain(m.outfit);
  });

  it('a photographer only for work and events', () => {
    expect(normalizeMoment({ moment: 'breakfast', taken_by: 'photographer', album: 'everyday' }).taken_by).toBe('friend');
    expect(normalizeMoment({ moment: 'the stall', taken_by: 'photographer', purpose: 'work' }).taken_by).toBe('photographer');
    expect(normalizeMoment({ moment: 'the gala', taken_by: 'photographer', album: 'events' }).taken_by).toBe('photographer');
  });

  it('the outfit follows the purpose and album when none is given', () => {
    expect(normalizeMoment({ moment: 'a', purpose: 'posted' }).outfit).toBe('going_out');
    expect(normalizeMoment({ moment: 'a', purpose: 'work' })).toMatchObject({ outfit: 'work', album: 'work' });
    expect(normalizeMoment({ moment: 'a', album: 'events' }).outfit).toBe('event');
    expect(normalizeMoment({ moment: 'a', album: 'objects' }).outfit).toBe('none');
    expect(normalizeMoment({ moment: 'a', purpose: 'private' }).outfit).toBe('at_home');
    expect(normalizeMoment({ moment: 'a', purpose: 'posted', outfit: 'at_home' }).outfit).toBe('at_home');
  });

  it('a screenshot shows no face; a date must be a real YYYY-MM-DD; text is clipped', () => {
    expect(normalizeMoment({ moment: 'the order list', purpose: 'screenshot', shows_face: true }).shows_face).toBe(false);
    expect(normalizeMoment({ moment: 'a', story_date: '2026-02-30x' }).story_date).toBeNull();
    expect(normalizeMoment({ moment: 'a', story_date: '2026-03-14' }).story_date).toBe('2026-03-14');
    expect(normalizeMoment({ moment: 'x'.repeat(500) }).moment).toHaveLength(300);
  });
});

describe('normalizePlan', () => {
  const face = (i) => ({ moment: `face ${i}`, shows_face: true, taken_by: 'selfie' });

  it('keeps to the limit, drops empty moments, and lets at most a third show a face', () => {
    const plan = normalizePlan([{ moment: '' }, ...Array.from({ length: 10 }, (_, i) => face(i)), { moment: 'jar' }, { moment: 'view' }], 12);
    expect(plan).toHaveLength(12);
    expect(plan.filter((m) => m.shows_face)).toHaveLength(4);
    // A selfie that loses its face becomes a friend's photo.
    expect(plan.filter((m) => !m.shows_face && m.taken_by === 'selfie')).toHaveLength(0);
    expect(plan.slice(0, 4).every((m) => m.shows_face)).toBe(true);
  });

  it('a plan of six allows two faces; nothing from a bad answer', () => {
    expect(normalizePlan(Array.from({ length: 6 }, (_, i) => face(i)), 6).filter((m) => m.shows_face)).toHaveLength(2);
    expect(normalizePlan(null, 6)).toEqual([]);
    expect(normalizePlan([{ moment: 'a' }], 0)).toEqual([]);
  });
});

describe('photoPrompt', () => {
  const character = { selected_name: 'Maren', appearance: { at_home: 'an old grey sweater', going_out: 'a camel coat' } };

  it('a candid phone photo, never a studio portrait, with no text or logos', () => {
    const p = photoPrompt(character, normalizeMoment({ moment: 'rain on the window', purpose: 'private', taken_by: 'friend' }));
    expect(p).toMatch(/candid phone photo/);
    expect(p).toMatch(/not a studio, not a photoshoot/);
    expect(p).toMatch(/No text, no letters, no logos, no brand names, no watermark/);
    expect(p).toMatch(/original fictional person/);
    expect(p).toMatch(/face is not in the frame/);
    expect(p).toMatch(/an old grey sweater/);
  });

  it('a face shot made from the headshot says so, and wears the going-out look when posted', () => {
    const p = photoPrompt(character, normalizeMoment({ moment: 'night out', purpose: 'posted', taken_by: 'mirror', shows_face: true }), { referenced: true });
    expect(p).toMatch(/same person as in the first reference image/);
    expect(p).toMatch(/a camel coat/);
    expect(p).toMatch(/mirror selfie/);
  });
});
