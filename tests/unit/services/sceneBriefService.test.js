/**
 * The Scene Brief (ruling S1, Evoni 2026-09-30; EVENT_EPISODE_FLOW.md
 * §8(dd)): one brief, three layers (place, event, shot) and the
 * environment, no people.
 */
const {
  buildSceneBrief, briefToPrompt, timeOfDayFromEventTime, seasonFromDate, SHOT_CAMERAS,
} = require('../../../src/services/sceneBriefService');

const SET = {
  id: 'set-1', name: 'The Glasshouse', world_location_id: 'loc-1',
  canonical_description: 'A greenhouse ballroom with iron ribs and a glass roof.',
  visual_language: { room_properties: { room_size: 'grand', ceiling_height: 'vaulted' } },
  time_of_day: 'evening', season: 'winter',
};
const LOCATION = {
  id: 'loc-1', name: 'The Glasshouse', venue_type: 'event_hall', city: 'Los Angeles', district: 'Echo Park',
  effective_style_guide: {
    architecture: 'Victorian iron-and-glass conservatory',
    materials: { metal: 'black wrought iron', stone: 'travertine' },
    flooring: 'travertine tiles', palette: ['ivory', 'black'], lighting: 'iron pendant lanterns',
  },
  venue_details: { equipment: ['a raised stage', 'a bar'] },
  color: '#ff00ff', // a map display colour: never read
};
const EVENT = {
  id: 'ev-1', name: 'Velour Launch', theme: 'Midnight Garden', format: 'brand_launch',
  color_palette: ['plum', 'gold'], mood: 'hushed and glamorous', event_time: '20:00', event_date: '2026-06-12',
  description: 'Velour launches its autumn line. Guests arrive at eight.',
};

const line = (brief, key) => brief.lines.find((l) => l.key === key);

describe('buildSceneBrief (S1)', () => {
  test('the place layer comes from the scene set and its World Location, labelled From venue', () => {
    const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION });
    const place = brief.lines.filter((l) => l.layer === 'place');
    expect(place.map((l) => l.key)).toEqual([
      'identity', 'description', 'architecture', 'materials', 'flooring', 'building_colours', 'layout', 'equipment', 'lighting', 'surroundings',
    ]);
    expect(place.every((l) => l.source === 'venue')).toBe(true);
    expect(line(brief, 'surroundings').text).toBe('Outside, through windows and doorways: Echo Park, Los Angeles.');
    expect(line(brief, 'equipment').text).toContain('a raised stage, a bar');
    expect(line(brief, 'identity').text).toMatch(/, an event hall\.$/);
    expect(line(buildSceneBrief({ sceneSet: SET, location: { ...LOCATION, venue_type: 'rooftop_bar' } }), 'identity').text).toMatch(/, a rooftop bar\.$/);
    expect(brief.world_location_id).toBe('loc-1');
  });

  test('map display colours never reach the brief', () => {
    expect(briefToPrompt(buildSceneBrief({ sceneSet: SET, location: LOCATION }))).not.toContain('#ff00ff');
  });

  test('no event layer without an explicitly chosen event (S3: never the first match)', () => {
    const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION });
    expect(brief.lines.some((l) => l.layer === 'event')).toBe(false);
    expect(brief.event_id).toBeNull();
  });

  test('the event layer: concept, setup, colours as décor and props only; the event\'s time and date set the environment', () => {
    const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION, event: EVENT });
    expect(line(brief, 'concept')).toMatchObject({ layer: 'event', source: 'event' });
    expect(line(brief, 'concept').text).toBe('Dressed for Velour Launch, themed "Midnight Garden": Velour launches its autumn line.');
    expect(line(brief, 'setup').text).toBe('Set up for a brand launch.');
    expect(line(brief, 'decor_colours').text).toMatch(/only in décor and props.*never on the building: plum, gold\./);
    expect(line(brief, 'time')).toMatchObject({ source: 'event', text: expect.stringMatching(/^Evening/) });
    expect(line(brief, 'season')).toMatchObject({ source: 'event', text: 'Summer.' });
    expect(brief.event_id).toBe('ev-1');
  });

  test('the shot: camera, required features, continuity, clear space for character overlays', () => {
    const brief = buildSceneBrief({
      sceneSet: SET, location: LOCATION, angleLabel: 'VANITY', requiredFeatures: 'The gilt mirror must show', continuity: true,
    });
    expect(line(brief, 'camera').text).toBe(SHOT_CAMERAS.VANITY);
    expect(line(brief, 'required_features').text).toBe('The gilt mirror must show.');
    expect(line(brief, 'continuity')).toBeTruthy();
    expect(line(brief, 'overlay_space').text).toMatch(/clear, uncluttered floor space .* for character overlays/);
  });

  test('no people, ever: the rules open the prompt', () => {
    const prompt = briefToPrompt(buildSceneBrief({ sceneSet: SET, location: LOCATION, event: EVENT }));
    expect(prompt.startsWith('An empty space with no people')).toBe(true);
    expect(prompt).not.toMatch(/feminine aesthetic|Soft natural lighting|Pinterest/);
  });

  test('overrides replace a line, add weather, or remove a line; each is labelled Your override', () => {
    const brief = buildSceneBrief({
      sceneSet: SET, location: LOCATION, event: EVENT,
      overrides: { decor_colours: 'Deep plum drapes and gold candelabra', weather: 'light rain on the glass roof', equipment: '' },
    });
    expect(line(brief, 'decor_colours')).toMatchObject({ source: 'override', text: 'Deep plum drapes and gold candelabra.' });
    expect(line(brief, 'weather')).toMatchObject({ layer: 'environment', source: 'override', text: 'light rain on the glass roof.' });
    expect(line(brief, 'equipment')).toBeUndefined();
    expect(brief.overrides.weather).toBe('light rain on the glass roof');
  });

  test('missing essentials are flagged: no World Location, no description, no time of day', () => {
    const brief = buildSceneBrief({ sceneSet: { id: 'x', name: 'Bare room' } });
    expect(brief.missing.map((m) => m.key)).toEqual(['world_location', 'description', 'time']);
    const full = buildSceneBrief({ sceneSet: SET, location: LOCATION });
    expect(full.missing).toEqual([]);
  });
});

describe('environment helpers', () => {
  test.each([
    ['07:30', 'morning'], ['14:00', 'afternoon'], ['18:00', 'golden_hour'], ['8:00 PM', 'evening'], ['23:30', 'night'], ['', null],
  ])('%s is %s', (t, key) => {
    expect(timeOfDayFromEventTime(t)).toBe(key);
  });

  test('season from a date', () => {
    expect(seasonFromDate('2026-12-20')).toBe('winter');
    expect(seasonFromDate('2026-04-02')).toBe('spring');
    expect(seasonFromDate(null)).toBeNull();
  });
});
