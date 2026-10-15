// ============================================================================
// UNIT TEST — a character's places, and sharing one on The Pulse
// ============================================================================
// Evoni, 2026-10-15: "a character's home venue scene set which is their
// everyday scene set which can be shared on the pulse". The places are the
// character homes of #3228; sharing makes a DRAFT post from the character's
// feed profile, with the set's picture and its venue. No database.

const mockListPlaces = jest.fn();
jest.mock('../../../src/services/characterPlacesService', () => {
  const actual = jest.requireActual('../../../src/services/characterPlacesService');
  return { ...actual, listPlaces: (...a) => mockListPlaces(...a) };
});
jest.mock('../../../src/services/storyClock', () => ({ presentOrder: jest.fn(async () => 7) }));
jest.mock('../../../src/utils/feedPlaces', () => ({
  resolvePlace: jest.fn(async (_m, body) => ({ values: { place_location_id: body.place_location_id, place_city: 'radiance_row' } })),
}));

const { placesForCharacter, sharePlace, PlaceShareError } = require('../../../src/services/characterPlaceShare');

const CHAR = '11111111-1111-1111-1111-111111111111';
const SET_HOME = '22222222-2222-2222-2222-222222222222';
const SET_BARE = '33333333-3333-3333-3333-333333333333';
const VENUE = '44444444-4444-4444-4444-444444444444';

function makeModels({ character = { id: CHAR, display_name: 'slowsift', selected_name: 'Maren Ellis', feed_profile_id: 7, show_id: 'show-1' } } = {}) {
  const query = jest.fn(async (sql) => {
    if (/FROM registry_characters rc/.test(sql)) return [[character].filter(Boolean)];
    if (/FROM scene_sets s/.test(sql)) {
      return [[
        { id: SET_HOME, base_still_url: 'https://cdn/base.jpg', world_location_id: VENUE, everyday_url: 'https://cdn/everyday.jpg' },
        { id: SET_BARE, base_still_url: null, world_location_id: null, everyday_url: null },
      ]];
    }
    return [[]];
  });
  return {
    sequelize: { query },
    SocialProfile: { findByPk: jest.fn(async () => ({ id: 7, handle: '@slowsift', display_name: 'slowsift' })) },
    FeedPost: { create: jest.fn(async (v) => ({ id: 'post-1', ...v })) },
  };
}

beforeEach(() => {
  mockListPlaces.mockReset();
  mockListPlaces.mockResolvedValue({ characters: [{ id: CHAR, is_lead: false, places: [
    { id: 'p1', role: 'home', label: null, scene_set_id: SET_HOME, scene_set_name: "Maren's Loft", source: 'character' },
    { id: 'p2', role: 'other', label: 'The bakery', scene_set_id: SET_BARE, scene_set_name: 'Corner Bakery', source: 'character' },
  ] }] });
});

test("their places come with each set's picture: the everyday look when it is this set", async () => {
  const out = await placesForCharacter(makeModels().sequelize, CHAR);
  expect(out.show_id).toBe('show-1');
  expect(out.places[0]).toMatchObject({ role: 'home', image_url: 'https://cdn/everyday.jpg', everyday: true, world_location_id: VENUE });
  expect(out.places[1]).toMatchObject({ image_url: null, everyday: false });
});

test('a character in no show has no places', async () => {
  const models = makeModels({ character: { id: CHAR, feed_profile_id: 7, show_id: null } });
  expect(await placesForCharacter(models.sequelize, CHAR)).toEqual({ show_id: null, is_lead: false, places: [] });
  expect(mockListPlaces).not.toHaveBeenCalled();
});

test('sharing makes a draft from their feed profile with the picture and the venue', async () => {
  const models = makeModels();
  const { post } = await sharePlace(models, { characterId: CHAR, sceneSetId: SET_HOME });
  expect(post).toMatchObject({
    show_id: 'show-1', social_profile_id: 7, poster_handle: 'slowsift', poster_platform: 'lalaverse',
    status: 'draft', posted_at: null, content_text: 'home.',
    image_url: 'https://cdn/everyday.jpg', photos: [{ url: 'https://cdn/everyday.jpg', alt: "Maren Ellis's home" }],
    place_location_id: VENUE, place_city: 'radiance_row', story_order: 7,
  });
});

test('a caption given is used', async () => {
  const models = makeModels();
  const { post } = await sharePlace(models, { characterId: CHAR, sceneSetId: SET_HOME, caption: '  linen day.  ' });
  expect(post.content_text).toBe('linen day.');
});

test.each([
  ['no feed profile', { character: { id: CHAR, feed_profile_id: null, show_id: 'show-1' } }, SET_HOME, 409],
  ['a set that is not theirs', {}, '55555555-5555-5555-5555-555555555555', 404],
  ['a set with no picture', {}, SET_BARE, 409],
])('refused: %s', async (_name, opts, setId, status) => {
  const models = makeModels(opts);
  await expect(sharePlace(models, { characterId: CHAR, sceneSetId: setId })).rejects.toMatchObject({ status });
  await expect(sharePlace(models, { characterId: CHAR, sceneSetId: setId })).rejects.toBeInstanceOf(PlaceShareError);
  expect(models.FeedPost.create).not.toHaveBeenCalled();
});
