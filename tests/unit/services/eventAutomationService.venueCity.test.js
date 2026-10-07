/**
 * eventAutomationService — the city an auto-created venue is given.
 *
 * ensureVenueLocation used to default the city to 'Nova Prime', which is
 * not one of the five DREAM cities (wiring map, fix-list item 13). The
 * city is now the address's, spelled as lalaHome
 * spells a DREAM city, or none, so the event's travel falls to its
 * fallback (lalaTravelsFor) instead of reading a city that does not exist.
 */

jest.mock('sequelize', () => ({ Op: { iLike: Symbol('iLike') } }));

const { ensureVenueLocation } = require('../../../src/services/eventAutomationService');

function models() {
  const create = jest.fn(async (row) => row);
  return { create, m: { WorldLocation: { findOne: jest.fn().mockResolvedValue(null), create } } };
}

describe('ensureVenueLocation — the city', () => {
  test('no address: no city, never Nova Prime', async () => {
    const { m, create } = models();
    await ensureVenueLocation("Mira's Venue", null, 'fashion', m);
    expect(create.mock.calls[0][0].city).toBeNull();
  });

  test('a DREAM city in the address is kept, spelled canonically', async () => {
    const { m, create } = models();
    await ensureVenueLocation('Club Noir', '12 Velvet St, The Arcade, echo  park', 'music', m);
    const row = create.mock.calls[0][0];
    expect(row.city).toBe('Echo Park');
    expect(row.district).toBe('The Arcade');
    expect(row.street_address).toBe('12 Velvet St');
  });

  test('"street, DREAM city" puts the city where it belongs', async () => {
    const { m, create } = models();
    await ensureVenueLocation('Glow Bar', '4 Lumen Ave, Radiance Row', 'beauty', m);
    const row = create.mock.calls[0][0];
    expect(row.city).toBe('Radiance Row');
    expect(row.district).toBeNull();
  });

  test('a city outside the five is kept as written', async () => {
    const { m, create } = models();
    await ensureVenueLocation('Harbor House', '1 Pier Rd, Old Town, Port Sable', 'food', m);
    expect(create.mock.calls[0][0].city).toBe('Port Sable');
  });
});
