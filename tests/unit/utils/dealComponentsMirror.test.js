/**
 * The deal components mirror (ruling D14, 2026-09-30; build PR 3): the
 * Event Package's checkboxes, labels and the one-to-one map read
 * frontend/src/constants/dealComponents.json, pinned here to the server's
 * src/utils/dealComponents.js.
 */
const path = require('path');
const d = require('../../../src/utils/dealComponents');

const mirror = require(path.join('..', '..', '..', 'frontend', 'src', 'constants', 'dealComponents.json'));

describe('deal components mirror', () => {
  it('equals the server definitions', () => {
    expect(mirror.keys).toEqual([...d.DEAL_COMPONENT_KEYS]);
    expect(mirror.labels).toEqual({ ...d.DEAL_COMPONENT_LABELS });
    expect(mirror.cash).toEqual([...d.CASH_COMPONENTS]);
    expect(mirror.by_deal_type).toEqual(JSON.parse(JSON.stringify(d.COMPONENTS_BY_DEAL_TYPE)));
  });

  it('mirrors nothing else', () => {
    expect(Object.keys(mirror)).toEqual(['keys', 'labels', 'cash', 'by_deal_type']);
  });
});
