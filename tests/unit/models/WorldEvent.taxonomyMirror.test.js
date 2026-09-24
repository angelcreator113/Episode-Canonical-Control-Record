/**
 * WorldEvent category/format — the frontend mirror is pinned to the model
 * (Task #1780).
 *
 * The Event Package's Basics offers category and format from
 * frontend/src/constants/eventTaxonomy.json, because the frontend cannot
 * import src/models. The source of truth is WorldEvent's validate.isIn
 * lists. This test reads both and fails if they disagree in content or
 * order, so a value added to (or removed from) the model can never be
 * missing from (or linger in) the Package's picker.
 *
 * No database: .define() is in-memory only.
 */
const path = require('path');
const { Sequelize } = require('sequelize');

function defineRealWorldEvent() {
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', { logging: false });
  const defineWorldEvent = require(path.join('..', '..', '..', 'src', 'models', 'WorldEvent.js'));
  return defineWorldEvent(sequelize);
}

const mirror = require(path.join('..', '..', '..', 'frontend', 'src', 'constants', 'eventTaxonomy.json'));

describe('WorldEvent category/format mirror (frontend/src/constants/eventTaxonomy.json)', () => {
  const WorldEvent = defineRealWorldEvent();

  it.each(['category', 'format'])('%s: the mirror equals the model isIn list', (field) => {
    const attr = WorldEvent.rawAttributes[field];
    expect(attr).toBeDefined();
    const isIn = attr.validate && attr.validate.isIn;
    expect(Array.isArray(isIn)).toBe(true);
    // Sequelize's isIn takes [[...values]].
    expect(mirror[field]).toEqual(isIn[0]);
  });

  it('mirrors nothing else', () => {
    expect(Object.keys(mirror).sort()).toEqual(['category', 'format']);
  });
});
