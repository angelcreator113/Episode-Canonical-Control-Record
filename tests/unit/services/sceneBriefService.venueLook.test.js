/**
 * The Scene Brief with an Event Venue Look (Evoni's ruling L1 and her
 * answers Q3 and Q4, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 * the look replaces the theme, mood and colours in the event layer, and its
 * lighting replaces the time line, falling back to event_time when empty.
 */
const { buildSceneBrief } = require('../../../src/services/sceneBriefService');

const SET = { id: 'set-1', name: 'The Glasshouse', canonical_description: 'A glass conservatory.' };
const EVENT = {
  id: 'ev-1', name: 'Velour Gala', theme: 'Midnight garden', mood: 'Romantic', color_palette: ['emerald', 'blush'],
  format: 'gala', event_time: '20:00', description: 'An awards night. Dinner follows.',
};
const line = (brief, key) => brief.lines.find((l) => l.key === key);

describe('buildSceneBrief with a venue look', () => {
  test('without a look the event layer is unchanged', () => {
    const brief = buildSceneBrief({ sceneSet: SET, event: EVENT });
    expect(line(brief, 'concept').text).toBe('Dressed for Velour Gala, themed "Midnight garden": An awards night.');
    expect(line(brief, 'mood').text).toBe('Mood: Romantic.');
    expect(line(brief, 'decor_colours')).toBeDefined();
    expect(line(brief, 'time').source).toBe('event');
  });

  test('a look with no lighting keeps the event_time line; no overall keeps the description', () => {
    const brief = buildSceneBrief({ sceneSet: SET, event: { ...EVENT, venue_look: { decor: 'Ivory linens.' } } });
    expect(line(brief, 'concept')).toMatchObject({ text: 'Dressed for Velour Gala: An awards night.', source: 'event' });
    expect(line(brief, 'decor').text).toContain('Ivory linens.');
    expect(line(brief, 'mood')).toBeUndefined();
    expect(line(brief, 'decor_colours')).toBeUndefined();
    expect(line(brief, 'time')).toMatchObject({ source: 'event', label: 'Time of day' });
    expect(line(brief, 'setup').text).toBe('Set up for a gala.');
  });

  test('an override still replaces a look line', () => {
    const brief = buildSceneBrief({
      sceneSet: SET,
      event: { ...EVENT, venue_look: { lighting: 'Candlelight.' } },
      overrides: { time: 'Bright noon sun.' },
    });
    expect(line(brief, 'time')).toMatchObject({ text: 'Bright noon sun.', source: 'override' });
  });
});
