/**
 * WorldEvent deal_type — the frontend mirror is pinned to the model (deal
 * build PR 2, Task #2330).
 *
 * The Event Package's Terms area offers the deal types from
 * frontend/src/constants/dealTypes.json, because the frontend cannot import
 * src/models. The source of truth is WorldEvent's validate.isIn list for
 * deal_type (WorldEvent.DEAL_TYPES). This test fails if they disagree in
 * content or order, as the category/format mirror test does.
 *
 * No database: .define() is in-memory only.
 */
const path = require('path');
const { Sequelize } = require('sequelize');

const mirror = require(path.join('..', '..', '..', 'frontend', 'src', 'constants', 'dealTypes.json'));

describe('WorldEvent deal_type mirror (frontend/src/constants/dealTypes.json)', () => {
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', { logging: false });
  const WorldEvent = require(path.join('..', '..', '..', 'src', 'models', 'WorldEvent.js'))(sequelize);

  it('the mirror equals the model isIn list', () => {
    expect(mirror.deal_type).toEqual(WorldEvent.rawAttributes.deal_type.validate.isIn[0]);
    expect(mirror.deal_type).toEqual(WorldEvent.DEAL_TYPES);
  });

  it('mirrors nothing else', () => {
    expect(Object.keys(mirror)).toEqual(['deal_type']);
  });
});
