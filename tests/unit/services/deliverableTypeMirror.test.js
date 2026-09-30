/**
 * The fixed deliverable types — the frontend mirror is pinned to the server
 * list (deal build PR 3, Task #2341; Evoni's Deal PR 3 ruling, QUESTION 2).
 *
 * The Terms form offers the types from
 * frontend/src/constants/deliverableTypes.json, because the frontend cannot
 * import src/services. The source of truth is
 * eventTermsService.DELIVERABLE_TYPES, which the deliverable routes enforce.
 */
const path = require('path');
const { DELIVERABLE_TYPES } = require('../../../src/services/eventTermsService');

const mirror = require(path.join('..', '..', '..', 'frontend', 'src', 'constants', 'deliverableTypes.json'));

describe('deliverable type mirror (frontend/src/constants/deliverableTypes.json)', () => {
  it('equals the server list, in order', () => {
    expect(mirror.deliverable_type).toEqual(DELIVERABLE_TYPES);
  });

  it('is the ruled list: Reel, Story Set (3), Post, Photo Set, Other', () => {
    expect(DELIVERABLE_TYPES).toEqual(['reel', 'story_set_3', 'post', 'photo_set', 'other']);
  });

  it('mirrors nothing else', () => {
    expect(Object.keys(mirror)).toEqual(['deliverable_type']);
  });
});
