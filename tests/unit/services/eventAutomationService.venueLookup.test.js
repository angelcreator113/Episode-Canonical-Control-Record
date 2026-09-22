/**
 * eventAutomationService — venue lookup regression tests
 *
 * Covers the "two different hosts both get The Underground" bug:
 *  - findHostProfile must select `city` and `frequent_venues` so the host
 *    object it returns can actually drive findVenue's host-specific tiers.
 *  - findVenue must prefer a host's own frequent_venues, then their city,
 *    before falling back to a host-agnostic category-wide match.
 *  - When a host carries neither field, findVenue collapses to a purely
 *    category-based lookup that is identical for every host — which is
 *    the exact mechanism that produced the bug. That collapse is asserted
 *    here as documented behavior, not fixed silently, since it's a data
 *    problem (generated creators lacking frequent_venues) rather than a
 *    findVenue defect once the caller passes a real host object.
 */

jest.mock('sequelize', () => ({
  Op: {
    in: Symbol('in'),
    ne: Symbol('ne'),
    notIn: Symbol('notIn'),
    or: Symbol('or'),
    iLike: Symbol('iLike'),
  },
}));

const { findVenue, findHostProfile } = require('../../../src/services/eventAutomationService');

function createMockModels(overrides = {}) {
  return {
    WorldLocation: {
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides.WorldLocation,
    },
    SocialProfile: {
      findAll: jest.fn().mockResolvedValue([]),
      ...overrides.SocialProfile,
    },
  };
}

describe('findVenue — host-specific tiers', () => {
  test('tier 1: uses the host\'s own frequent_venues before anything else', async () => {
    const frequentVenue = { id: 'loc-host-fav', name: "Host's Favorite Spot" };
    const findOne = jest.fn().mockResolvedValueOnce(frequentVenue);
    const models = createMockModels({ WorldLocation: { findOne } });

    const host = { id: 'host-1', frequent_venues: ['loc-host-fav'], city: 'maverick_harbor' };
    const venue = await findVenue({ cultural_category: 'music' }, models, host);

    expect(venue).toBe(frequentVenue);
    expect(findOne).toHaveBeenCalledTimes(1);
    const whereArg = findOne.mock.calls[0][0].where;
    expect(whereArg.id).toBeDefined();
  });

  test('tier 2: falls back to a venue in the host\'s city when frequent_venues is empty', async () => {
    const cityVenue = { id: 'loc-city-1', name: 'Harbor Lounge' };
    const findOne = jest.fn().mockResolvedValueOnce(cityVenue);
    const models = createMockModels({ WorldLocation: { findOne } });

    const host = { id: 'host-2', frequent_venues: [], city: 'maverick_harbor' };
    const venue = await findVenue({ cultural_category: 'music' }, models, host);

    expect(venue).toBe(cityVenue);
    expect(findOne).toHaveBeenCalledTimes(1);
    const whereArg = findOne.mock.calls[0][0].where;
    // city gets underscore-stripped and title-cased before the iLike lookup
    const iLikeSymbol = Object.getOwnPropertySymbols(whereArg.city)[0];
    expect(whereArg.city[iLikeSymbol]).toContain('Maverick Harbor');
  });

  test('two hosts with distinct frequent_venues resolve to distinct venues (the fix working)', async () => {
    const venueA = { id: 'loc-a', name: "Host A's Spot" };
    const venueB = { id: 'loc-b', name: "Host B's Spot" };
    const findOne = jest.fn().mockImplementation(({ where }) => {
      const ids = where.id ? where.id[Object.getOwnPropertySymbols(where.id)[0]] : null;
      if (ids?.includes('loc-a')) return Promise.resolve(venueA);
      if (ids?.includes('loc-b')) return Promise.resolve(venueB);
      return Promise.resolve(null);
    });
    const models = createMockModels({ WorldLocation: { findOne } });

    const hostA = { id: 'host-a', frequent_venues: ['loc-a'] };
    const hostB = { id: 'host-b', frequent_venues: ['loc-b'] };

    const venueForA = await findVenue({ cultural_category: 'music' }, models, hostA);
    const venueForB = await findVenue({ cultural_category: 'music' }, models, hostB);

    expect(venueForA).toBe(venueA);
    expect(venueForB).toBe(venueB);
    expect(venueForA.id).not.toBe(venueForB.id);
  });

  test('tier 3: with no frequent_venues or city on either host, both collapse to the same host-agnostic pick (the reported bug)', async () => {
    const theUnderground = { id: 'loc-underground', name: 'The Underground', venue_type: 'bar' };
    // findOne is only ever hit for the category-wide, host-agnostic query here —
    // no where.id / where.city filter is present on any call.
    const findOne = jest.fn().mockResolvedValue(theUnderground);
    const models = createMockModels({ WorldLocation: { findOne } });

    const hostA = { id: 'host-a', handle: '@creatorA' }; // no frequent_venues, no city
    const hostB = { id: 'host-b', handle: '@creatorB' }; // different host, same gaps

    const venueForA = await findVenue({ cultural_category: 'music' }, models, hostA);
    const venueForB = await findVenue({ cultural_category: 'music' }, models, hostB);

    expect(venueForA).toBe(theUnderground);
    expect(venueForB).toBe(theUnderground);

    // Every call that actually ran had no host-specific filter at all —
    // confirms the lookup was host-agnostic, not that it "happened" to match.
    for (const call of findOne.mock.calls) {
      expect(call[0].where.id).toBeUndefined();
      expect(call[0].where.city).toBeUndefined();
    }
  });

  test('falls through to the location_type fallback when no venue_type matches exist', async () => {
    const anyVenue = { id: 'loc-any', name: 'Some Interior' };
    const findOne = jest.fn()
      .mockResolvedValueOnce(null) // tier 3: category match — none found
      .mockResolvedValueOnce(anyVenue); // tier 4: any venue/interior
    const models = createMockModels({ WorldLocation: { findOne } });

    const venue = await findVenue({ cultural_category: 'music' }, models, {});

    expect(venue).toBe(anyVenue);
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(findOne.mock.calls[1][0].where.location_type).toBeDefined();
  });
});

describe('findHostProfile — attribute selection', () => {
  test('the primary query selects city and frequent_venues', async () => {
    const findAll = jest.fn().mockResolvedValue([
      { id: 'p1', toJSON: () => ({ id: 'p1', handle: '@a', lala_relevance_score: 5 }) },
    ]);
    const models = createMockModels({ SocialProfile: { findAll } });

    await findHostProfile({ cultural_category: 'music', severity_level: 5 }, models);

    expect(findAll).toHaveBeenCalledTimes(1);
    const { attributes } = findAll.mock.calls[0][0];
    expect(attributes).toEqual(expect.arrayContaining(['city', 'frequent_venues']));
  });

  test('the celebrity_tier-missing-column fallback query also selects city and frequent_venues', async () => {
    const findAll = jest.fn()
      .mockRejectedValueOnce(new Error('column "celebrity_tier" does not exist'))
      .mockResolvedValueOnce([
        { id: 'p1', toJSON: () => ({ id: 'p1', handle: '@a', lala_relevance_score: 5 }) },
      ]);
    const models = createMockModels({ SocialProfile: { findAll } });

    await findHostProfile({ cultural_category: 'music', severity_level: 5 }, models);

    expect(findAll).toHaveBeenCalledTimes(2);
    const { attributes } = findAll.mock.calls[1][0];
    expect(attributes).toEqual(expect.arrayContaining(['city', 'frequent_venues']));
  });

  test('the returned host object carries city and frequent_venues through to findVenue', async () => {
    const scoredProfile = {
      id: 'p1',
      city: 'maverick_harbor',
      frequent_venues: ['loc-fav'],
      toJSON: () => ({
        id: 'p1', handle: '@a', content_category: 'music', archetype: 'chaos_creator',
        follower_tier: 'mid', lala_relevance_score: 9, city: 'maverick_harbor', frequent_venues: ['loc-fav'],
      }),
    };
    const findAll = jest.fn().mockResolvedValue([scoredProfile]);
    const models = createMockModels({ SocialProfile: { findAll } });

    const host = await findHostProfile({ cultural_category: 'music', severity_level: 5 }, models);

    expect(host.city).toBe('maverick_harbor');
    expect(host.frequent_venues).toEqual(['loc-fav']);
  });
});
