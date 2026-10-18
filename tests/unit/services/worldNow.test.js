'use strict';

/**
 * The world as the script writers see it (Evoni, 2026-10-18: "yes start the
 * world facts and temperature"): the State tab's world facts and the latest
 * world temperature, its label, what it means and which way it is going,
 * reach both script writers. No database, no network.
 */
const { latestTemperatureForShow, worldNowBlock, MAX_FACTS } = require('../../../src/services/worldNow');

const seq = (rows) => ({ query: jest.fn(async () => [rows]) });
const reading = (value) => ({ metadata: { world_temperature: { value, updated_at: '2026-10-18T00:00:00Z' } } });

describe('latestTemperatureForShow', () => {
  test('the newest reading, its label and meaning, and the way it is going', async () => {
    const s = seq([reading(70), reading(52)]);
    expect(await latestTemperatureForShow(s, 'show-1')).toEqual({
      value: 70, label: 'HOT', meaning: 'High attention. Brands are curious. Rivals are activated.', trajectory: 'RISING_FAST', updated_at: '2026-10-18T00:00:00Z',
    });
    const [sql, opts] = s.query.mock.calls[0];
    expect(sql).toContain('snapshot_label = :temperature');
    expect(opts.replacements).toEqual({ showId: 'show-1', temperature: 'temperature_update' });
  });

  test('one reading has no trend; none is null; a failed read is logged and null', async () => {
    expect((await latestTemperatureForShow(seq([reading(40)]), 's')).trajectory).toBeNull();
    expect(await latestTemperatureForShow(seq([]), 's')).toBeNull();
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await latestTemperatureForShow({ query: async () => { throw new Error('down'); } }, 's')).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('worldNowBlock', () => {
  test('the facts and the temperature, as one section', () => {
    const block = worldNowBlock({
      snapshot: { world_facts: ['Glow Week is cancelled this year', { fact: 'Dazzle House is hiring' }] },
      temperature: { value: 70.4, label: 'HOT', meaning: 'High attention.', trajectory: 'RISING' },
    });
    expect(block).toBe(`═══ THE WORLD NOW ═══
What is true in the LalaVerse now (the script agrees with it):
- Glow Week is cancelled this year
- Dazzle House is hiring
World temperature: 70/100, HOT, rising since the last episode. High attention. Let the episode's pressure and how people treat Lala fit it.
`);
  });

  test('no facts and no temperature is nothing; the facts are capped', () => {
    expect(worldNowBlock({})).toBe('');
    expect(worldNowBlock({ snapshot: { world_facts: { worldTemperature: 3 } } })).toBe('');
    const many = worldNowBlock({ snapshot: { world_facts: Array.from({ length: 20 }, (_, i) => `fact ${i}`) } });
    expect(many.match(/^- fact/gm)).toHaveLength(MAX_FACTS);
  });
});

describe('the script writers', () => {
  test('the Script tab writer puts it after Lala\'s state', () => {
    const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');
    const prompt = buildScriptPrompt({ brief: null, scenePlan: [], franchiseLaws: [], eventData: null, wardrobeItems: [], lalaStats: null, outfitScore: null, worldNow: '═══ THE WORLD NOW ═══\n- Glow Week is cancelled this year\n' });
    expect(prompt).toContain('═══ THE WORLD NOW ═══\n- Glow Week is cancelled this year');
  });

  test('the episode script writer carries it', () => {
    const { buildFullPrompt } = require('../../../src/services/episodeScriptWriterService');
    const prompt = buildFullPrompt({ brief: null, scenePlan: [], event: null, financial: null, wardrobe: [], franchiseLaws: [], worldState: null, worldNow: '═══ THE WORLD NOW ═══\n- Dazzle House is hiring\n' });
    expect(prompt).toContain('- Dazzle House is hiring');
  });
});
