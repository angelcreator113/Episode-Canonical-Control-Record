/**
 * A confirmed romance with Lala (character_relationships, written by the
 * "What changed" card; Evoni, 2026-10-23) tells the script writer "love
 * interest" beside the guest's lala_relationship tie, which stays as it is.
 */
const { storyContextBlocks, lalaRomances, LALA_TIES } = require('../../../src/services/episodeScriptWriterService');

const guest = (extra = {}) => ({ handle: 'truthville', display_name: 'Truthville', creator_name: 'Marcus Hale', platform: 'instagram', ...extra });
const blocks = (profiles) => JSON.stringify(storyContextBlocks({ socialProfiles: profiles, socialTasks: [] }, { withSeason: false }));

describe('love interest in the script prompt', () => {
  test('a romance adds "love interest: <note>" after the tie', () => {
    const text = blocks([guest({ lala_relationship: 'aware', lala_romance: 'Flirting at the gala' })]);
    expect(text).toContain(`With Lala: ${LALA_TIES.aware}; love interest: Flirting at the gala`);
  });

  test('a romance with no note, and no tie', () => {
    expect(blocks([guest({ lala_romance: '' })])).toContain('With Lala: love interest');
  });

  test('no romance: the tie alone', () => {
    const text = blocks([guest({ lala_relationship: 'direct' })]);
    expect(text).toContain(`With Lala: ${LALA_TIES.direct}`);
    expect(text).not.toContain('love interest');
  });

  test('lalaRomances reads confirmed romantic rows with Lala; a failed read is empty and logged', async () => {
    const query = jest.fn(async () => [[{ other: 'c1', note: 'Flirting' }, { other: 'c1', note: 'older' }]]);
    const out = await lalaRomances({ query }, ['c1', 'c1', null]);
    expect([...out]).toEqual([['c1', 'Flirting']]);
    expect(query.mock.calls[0][0]).toMatch(/is_romantic = true AND cr\.confirmed = true/);
    expect(query.mock.calls[0][1].replacements.ids).toEqual(['c1']);
    expect((await lalaRomances({ query }, [])).size).toBe(0);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await lalaRomances({ query: async () => { throw new Error('down'); } }, ['c1'])).size).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
