/**
 * The deal plans — the frontend mirror is pinned to the server (deal build
 * PR 3, Task #2341; Evoni's Deal PR 3 ruling, points 1, 2 and 4).
 *
 * The Terms area shows the components each deal type carries, which
 * deliverables it pays and which take an automatic anchor, from
 * frontend/src/constants/dealPlans.json, because the frontend cannot import
 * src/services. The source of truth is dealPricingService.
 */
const path = require('path');
const { DEAL_PLANS, EVENT_COMPONENTS, DELIVERABLE_ANCHORS } = require('../../../src/services/dealPricingService');

const mirror = require(path.join('..', '..', '..', 'frontend', 'src', 'constants', 'dealPlans.json'));

describe('deal plan mirror (frontend/src/constants/dealPlans.json)', () => {
  it('the plans equal the server plans', () => {
    expect(mirror.plans).toEqual(JSON.parse(JSON.stringify(DEAL_PLANS)));
  });

  it('the components carry the server fields and labels', () => {
    expect(mirror.components).toEqual(Object.fromEntries(
      Object.entries(EVENT_COMPONENTS).map(([k, c]) => [k, { field: c.field, label: c.label }])
    ));
  });

  it('the deliverable anchors equal the server list', () => {
    expect(mirror.deliverable_anchors).toEqual({ ...DELIVERABLE_ANCHORS });
  });

  it('mirrors nothing else', () => {
    expect(Object.keys(mirror)).toEqual(['components', 'plans', 'deliverable_anchors']);
  });
});
