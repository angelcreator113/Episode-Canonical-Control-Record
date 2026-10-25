/**
 * The slot-intention draft prompt names the season it is in (Evoni,
 * 2026-10-25): its title, else its own number ("Season 2"), never a fixed
 * "Season 1" for a season with no title.
 */
const { buildDraftPrompt, seasonName } = require('../../../src/services/seasonIntentionService');

const ctx = (arc) => ({ arc, phase: { phase: 1, title: 'Doors' }, earlier: [], goals: [], debt: [], threads: [], carried: '' });
const slot = (seasonNumber) => ({ slot_number: 4, season_number: seasonNumber });

describe('seasonName', () => {
  test('the title when the arc has one', () => {
    expect(seasonName({ title: 'Velvet Season', season_number: 2 }, slot(2))).toBe('the season "Velvet Season"');
  });

  test('no title: the arc\'s own number, else the slot\'s, else "the season"', () => {
    expect(seasonName({ title: '', season_number: 3 }, slot(3))).toBe('Season 3');
    expect(seasonName(null, slot(2))).toBe('Season 2');
    expect(seasonName(null, {})).toBe('the season');
  });
});

describe('buildDraftPrompt names the season', () => {
  test('a Season 2 arc with no title is "Season 2", not "Season 1"', () => {
    const prompt = buildDraftPrompt(slot(2), ctx({ title: null, season_number: 2 }));
    expect(prompt).toContain('Draft the intention for episode slot S2 · E4 of Season 2.');
    expect(prompt).not.toContain('Season 1');
  });

  test('a titled arc keeps its title', () => {
    const prompt = buildDraftPrompt(slot(1), ctx({ title: 'Soft Luxury Ascension', season_number: 1 }));
    expect(prompt).toContain('Draft the intention for episode slot S1 · E4 of the season "Soft Luxury Ascension".');
  });
});
