/**
 * Required wardrobe slot coverage (audit GATE-02, 2026-10-03): with one
 * item, partial inventory and the missing slots by name; a full
 * configuration passes only when its required slots each have a piece.
 */
const { Op } = require('sequelize');
const { requiredSlotsFor, slotCoverage, wardrobeSlotCoverage } = require('../../../src/services/wardrobeSlotCoverageService');

const item = (clothing_category) => ({ id: clothing_category, clothing_category });

describe('requiredSlotsFor', () => {
  test('defaults to the taxonomy\'s required slots: outfit and shoes', () => {
    expect(requiredSlotsFor(null)).toEqual(['outfit', 'shoes']);
    expect(requiredSlotsFor({ metadata: {} })).toEqual(['outfit', 'shoes']);
    expect(requiredSlotsFor({ metadata: { required_slots: [] } })).toEqual(['outfit', 'shoes']);
  });

  test('a configured list is used in slot order, unknown keys dropped', () => {
    expect(requiredSlotsFor({ metadata: { required_slots: ['fragrance', 'shoes', 'hat', 'outfit', 'jewelry', 'accessories'] } }))
      .toEqual(['outfit', 'shoes', 'jewelry', 'accessories', 'fragrance']);
    expect(requiredSlotsFor({ metadata: { required_slots: ['hat'] } })).toEqual(['outfit', 'shoes']);
  });
});

describe('slotCoverage', () => {
  test('one shoe is partial inventory with the missing slot named', () => {
    const c = slotCoverage([item('heels')], ['outfit', 'shoes']);
    expect(c).toMatchObject({ inventory: 1, covered: false, missing: ['outfit'], text: 'Missing required slot: outfit' });
    expect(c.slots.find((s) => s.slot === 'shoes')).toMatchObject({ required: true, count: 1 });
    expect(c.slots.find((s) => s.slot === 'outfit')).toMatchObject({ required: true, count: 0 });
  });

  test('a five-slot configuration passes only with a piece in every required slot', () => {
    const five = ['outfit', 'shoes', 'jewelry', 'accessories', 'fragrance'];
    const partial = slotCoverage([item('dress'), item('shoes'), item('necklace')], five);
    expect(partial).toMatchObject({ covered: false, missing: ['accessories', 'fragrance'], text: 'Missing required slots: accessories, fragrance' });
    const full = slotCoverage([item('dress'), item('shoes'), item('necklace'), item('bag'), item('perfume')], five);
    expect(full).toMatchObject({ covered: true, missing: [], text: 'Required slots covered: outfit, shoes, jewelry, accessories, fragrance' });
  });

  test('no pieces at all says so; a piece with no slot is counted as unassigned', () => {
    expect(slotCoverage([], ['outfit', 'shoes'])).toMatchObject({ inventory: 0, covered: false, missing: ['outfit', 'shoes'], text: 'No wardrobe pieces uploaded' });
    const c = slotCoverage([item('dress'), item('shoes'), item('???')], ['outfit', 'shoes']);
    expect(c).toMatchObject({ inventory: 3, unassigned: 1, covered: true });
  });
});

describe('wardrobeSlotCoverage', () => {
  test('reads the show\'s required slots and its live pieces, show-less pieces included', async () => {
    const models = {
      Show: { findByPk: jest.fn(async () => ({ id: 'show-1', metadata: { required_slots: ['outfit', 'shoes', 'jewelry'] } })) },
      Wardrobe: { findAll: jest.fn(async () => [item('dress'), item('boots')]) },
    };
    const c = await wardrobeSlotCoverage(models, 'show-1');
    expect(models.Wardrobe.findAll.mock.calls[0][0]).toMatchObject({ where: { deleted_at: null, show_id: { [Op.or]: ['show-1', null] } }, raw: true });
    expect(c).toMatchObject({ show_id: 'show-1', required_slots: ['outfit', 'shoes', 'jewelry'], covered: false, missing: ['jewelry'] });
  });

  test('an unknown show is null, not an empty wardrobe', async () => {
    const models = { Show: { findByPk: jest.fn(async () => null) }, Wardrobe: { findAll: jest.fn() } };
    expect(await wardrobeSlotCoverage(models, 'nope')).toBeNull();
    expect(models.Wardrobe.findAll).not.toHaveBeenCalled();
  });
});
