'use strict';

/**
 * One DREAM city list (Evoni, 2026-10-18: "start the one DREAM city list"):
 * a city's prompt text is made from its saved words; a city with none, or
 * no saved list, or a failed read keeps its built-in text; a save clears
 * the minute's cache.
 */
const { cityText, cityCultures, forgetCityCultures } = require('../../../src/services/dreamCityText');
const { DREAM_CITY_CULTURE } = require('../../../src/utils/feedCities');

const dbWith = (rows) => {
  const query = jest.fn(async () => (rows instanceof Error ? Promise.reject(rows) : rows));
  return { query, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
};

beforeEach(() => forgetCityCultures());

test('cityText: the saved words, a sentence said twice said once', () => {
  expect(cityText({
    key: 'echo_park',
    culture: 'Loud, late and viral. Chaotic, loud, viral culture.',
    energy: 'Chaotic, loud, viral culture. A meme by morning',
    famousFor: 'Music studios, comedy clubs',
    whoLivesHere: 'Musicians and comedians',
    majorEvents: ['Neon Nights', ' ', 'Cloud Carnival'],
  })).toBe('Loud, late and viral. Chaotic, loud, viral culture. A meme by morning. Known for music studios, comedy clubs. Home to musicians and comedians. Its big events: Neon Nights, Cloud Carnival.');
  expect(cityText({ key: 'echo_park', color: '#000' })).toBe('');
  expect(cityText(null)).toBe('');
});

test('cityCultures: saved cities their words, the rest built in; read once a minute until a save', async () => {
  const db = dbWith([{ data: [{ key: 'echo_park', culture: 'Karaoke capital.' }, { key: 'radiance_row', color: '#fff' }, { key: 'not_a_city', culture: 'x' }] }]);
  const out = await cityCultures(db);
  expect(out.echo_park).toBe('Karaoke capital.');
  expect(out.radiance_row).toBe(DREAM_CITY_CULTURE.radiance_row);
  expect(out.not_a_city).toBeUndefined();
  await cityCultures(db);
  expect(db.query).toHaveBeenCalledTimes(1);
  forgetCityCultures();
  await cityCultures(db);
  expect(db.query).toHaveBeenCalledTimes(2);
});

test('cityCultures: no saved list, or a failed read (logged), is the built-in texts', async () => {
  expect(await cityCultures(dbWith([]))).toEqual(DREAM_CITY_CULTURE);
  forgetCityCultures();
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await cityCultures(dbWith(new Error('down')))).toEqual(DREAM_CITY_CULTURE);
  expect(err).toHaveBeenCalled();
  err.mockRestore();
});

test('the place describer reads the city text it is given', () => {
  const { _readings } = require('../../../src/services/placeDescriptionService');
  const read = _readings({
    character: {}, file: { facts: {} }, fp: { city: 'echo_park' }, place: { role: 'work' }, location: null,
    cityCulture: { echo_park: 'Karaoke capital.' },
  });
  expect(read.cityCulture).toBe('Karaoke capital.');
});
