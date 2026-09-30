/**
 * The deliverable formats — the frontend mirror is pinned to the server
 * definitions (ruling D15, Evoni 2026-09-30, superseding the Deal PR 3 list
 * of Task #2341).
 *
 * The Terms form offers the formats from
 * frontend/src/constants/deliverableTypes.json, because the frontend cannot
 * import src/. The source of truth is src/utils/deliverableFormats.js, which
 * the deliverable routes enforce (eventTermsService.DELIVERABLE_TYPES).
 */
const path = require('path');
const { DELIVERABLE_TYPES } = require('../../../src/services/eventTermsService');
const formats = require('../../../src/utils/deliverableFormats');

const mirror = require(path.join('..', '..', '..', 'frontend', 'src', 'constants', 'deliverableTypes.json'));

describe('deliverable format mirror (frontend/src/constants/deliverableTypes.json)', () => {
  it('lists the server types, in order', () => {
    expect(mirror.deliverable_type).toEqual([...DELIVERABLE_TYPES]);
    expect([...DELIVERABLE_TYPES]).toEqual([...formats.DELIVERABLE_TYPES]);
  });

  it('is D15\'s list, with answer 8\'s Instagram post, and Other', () => {
    expect([...DELIVERABLE_TYPES]).toEqual([
      'instagram_reel', 'instagram_post', 'tiktok_video', 'grwm_video', 'instagram_stories',
      'carousel_post', 'go_live', 'link_in_bio', 'try_on_haul', 'ugc', 'other',
    ]);
  });

  it('mirrors the formats, the platform labels and the quantity range exactly', () => {
    expect(mirror.formats).toEqual(JSON.parse(JSON.stringify(formats.DELIVERABLE_FORMATS)));
    expect(mirror.platform_labels).toEqual({ ...formats.PLATFORM_LABELS });
    expect(mirror.quantity).toEqual({ min: formats.QUANTITY_MIN, max: formats.QUANTITY_MAX });
  });

  it('mirrors nothing else', () => {
    expect(Object.keys(mirror)).toEqual(['deliverable_type', 'formats', 'platform_labels', 'quantity']);
  });
});
