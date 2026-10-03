// ============================================================================
// Pitch Me (episode creation step 6, Evoni 2026-10-03): episodePitchService.
// Mocked models and Anthropic client; no database, no network.
// ============================================================================
// The model may only use the people, brands and places it was given:
// unknown ids and brands are dropped, as are categories and formats outside
// WorldEvent's lists. A pitch without title, premise and organizer is dropped.

jest.mock('../../../src/services/financialTransactionService', () => ({
  getCurrentBalance: jest.fn(async () => 425),
}));
jest.mock('../../../src/services/seasonSuggestionService', () => ({
  loadSeasonInputs: jest.fn(async () => ({
    slot: { slot_number: 4, label: 'S1 · E4', story_purpose: 'Win the room', career_focus: 'brand', desired_pressure: 'medium' },
    goals: [{ title: 'First beauty deal' }],
    debt: [],
    recent: [],
  })),
}));

const { buildPitchPrompt, parsePitches, pitchEpisodes, MODELS } = require('../../../src/services/episodePitchService');

const INPUTS = {
  state: { coins: 425, reputation: 3, brand_trust: 2, influence: 2, stress: 4 },
  season: { slot: { label: 'S1 · E4', story_purpose: 'Win the room' }, goals: [], debt: [] },
  creators: [
    { id: 11, handle: 'maya', display_name: 'Maya Chen', lala_relationship: 'aware' },
    { id: 12, handle: 'dana', display_name: 'Dana', lala_relationship: 'direct' },
    { id: 13, handle: 'tasha', display_name: 'Tasha Monroe', lala_relationship: 'competitive' },
  ],
  brands: [{ name: 'Ori Beauty', category: 'beauty' }],
  locations: [{ id: 'loc-1', name: 'The Honey Table', city: 'Velour City' }],
  recent: [{ name: 'Velour Awards Night' }],
};

const reply = (pitches) => `Here you go:\n${JSON.stringify({ pitches })}`;

describe('buildPitchPrompt', () => {
  test('gives the model Lala, the season, the lists with ids, and the recent events not to repeat', () => {
    const prompt = buildPitchPrompt(INPUTS);
    expect(prompt).toMatch(/Lala: 425 coins, reputation 3\/10/);
    expect(prompt).toMatch(/Next season slot S1 · E4: purpose "Win the room"/);
    expect(prompt).toMatch(/- id 11: Maya Chen, Lala: aware/);
    expect(prompt).toMatch(/- Ori Beauty \(beauty\)/);
    expect(prompt).toMatch(/- id loc-1: The Honey Table, Velour City/);
    expect(prompt).toMatch(/Recent events \(do not repeat\): Velour Awards Night/);
    expect(prompt).toMatch(/Never invent a person, brand or place/);
  });
});

describe('parsePitches', () => {
  test('keeps what it was given and drops what it was not', () => {
    const pitches = parsePitches(reply([
      {
        title: '"Champagne Before Noon"', kind: 'career', category: 'brunch_dining', format: 'brunch',
        organizer: { kind: 'brand', brand: 'ori beauty' },
        featured: [{ profile_id: 11, role: 'opportunity' }, { profile_id: 99, role: 'friend' }, { profile_id: 13, role: 'nemesis' }],
        venue_location_id: 'loc-1',
        premise: 'Ori Beauty hosts an intimate creator brunch. Lala gets the last seat.',
        opportunity: 'A first real relationship with Ori Beauty.', pressure: 'Brunch chic on 425 coins.', wildcard: 'Tasha is there.',
      },
      {
        title: 'Made Up', category: 'not_a_category', format: 'rave',
        organizer: { kind: 'creator', profile_id: 12 }, featured: [{ profile_id: 12, role: 'friend' }],
        venue_location_id: 'loc-404', premise: 'Dana throws a party.',
      },
      { title: 'Invented', organizer: { kind: 'brand', brand: 'Not A Brand' }, premise: 'x' },
      { title: '', organizer: { kind: 'creator', profile_id: 11 }, premise: 'No title.' },
    ]), INPUTS);

    expect(pitches).toHaveLength(2);
    expect(pitches[0]).toEqual({
      title: 'Champagne Before Noon', kind: 'career', category: 'brunch_dining', format: 'brunch',
      organizer: { kind: 'brand', name: 'Ori Beauty' },
      featured: [
        { profile_id: 11, handle: 'maya', display_name: 'Maya Chen', role: 'opportunity' },
        { profile_id: 13, handle: 'tasha', display_name: 'Tasha Monroe', role: null },
      ],
      venue: { id: 'loc-1', name: 'The Honey Table' },
      premise: 'Ori Beauty hosts an intimate creator brunch. Lala gets the last seat.',
      opportunity: 'A first real relationship with Ori Beauty.', pressure: 'Brunch chic on 425 coins.', wildcard: 'Tasha is there.',
    });
    // The organizer is never also featured; unknown place and taxonomy are dropped.
    expect(pitches[1]).toMatchObject({
      organizer: { kind: 'creator', profile_id: 12, name: 'Dana' },
      featured: [], venue: null, category: null, format: null, kind: null,
    });
  });

  test('no JSON, or broken JSON, gives no pitches', () => {
    expect(parsePitches('no json here', INPUTS)).toEqual([]);
    expect(parsePitches('{"pitches": [', INPUTS)).toEqual([]);
  });

  test('at most three', () => {
    const one = { title: 'T', organizer: { kind: 'brand', brand: 'Ori Beauty' }, premise: 'P.' };
    expect(parsePitches(reply([one, one, one, one]), INPUTS)).toHaveLength(3);
  });
});

describe('pitchEpisodes', () => {
  const rows = (list) => list.map((r) => ({ toJSON: () => r }));
  const models = () => ({
    sequelize: { query: jest.fn(async () => [[{ reputation: 3, brand_trust: 2, influence: 2, stress: 4, coins: 999 }]]) },
    SocialProfile: { findAll: jest.fn(async () => rows(INPUTS.creators)) },
    LalaverseBrand: { findAll: jest.fn(async () => rows(INPUTS.brands)) },
    WorldLocation: { findAll: jest.fn(async () => rows(INPUTS.locations)) },
    WorldEvent: { findAll: jest.fn(async () => rows(INPUTS.recent)) },
  });

  test('one Haiku call with the loaded world; coins are the ledger balance', async () => {
    const create = jest.fn(async () => ({ content: [{ text: reply([{ title: 'Champagne Before Noon', organizer: { kind: 'brand', brand: 'Ori Beauty' }, premise: 'A brunch.' }]) }] }));
    const result = await pitchEpisodes(models(), 'show-1', { client: { messages: { create } } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe(MODELS[0]);
    expect(MODELS).toEqual(['claude-haiku-4-5-20251001']);
    expect(create.mock.calls[0][0].messages[0].content).toMatch(/Lala: 425 coins/);
    expect(result.pitches.map((p) => p.title)).toEqual(['Champagne Before Noon']);
  });

  test('nothing usable back is an error, not an empty success', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '{"pitches": []}' }] }));
    expect(await pitchEpisodes(models(), 'show-1', { client: { messages: { create } } })).toEqual({ error: 'No usable pitches came back. Please try again.', status: 502 });
  });

  test('a world with no creators or brands does not call the model', async () => {
    const m = models();
    m.SocialProfile.findAll = jest.fn(async () => []);
    m.LalaverseBrand.findAll = jest.fn(async () => []);
    const create = jest.fn();
    const result = await pitchEpisodes(m, 'show-1', { client: { messages: { create } } });
    expect(create).not.toHaveBeenCalled();
    expect(result.status).toBe(422);
  });

  test('a failed load is logged and the rest still pitch', async () => {
    const m = models();
    m.WorldLocation.findAll = jest.fn(async () => { throw new Error('no table'); });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const create = jest.fn(async () => ({ content: [{ text: reply([{ title: 'T', organizer: { kind: 'creator', profile_id: 11 }, premise: 'P.' }]) }] }));
    const result = await pitchEpisodes(m, 'show-1', { client: { messages: { create } } });
    expect(spy).toHaveBeenCalledWith('[EpisodePitch] locations load failed:', 'no table');
    expect(result.pitches).toHaveLength(1);
    spy.mockRestore();
  });
});
