/**
 * The Assets tab's venue Fix button (audit LINK-03, 2026-10-03): the event's
 * set in this show's Scene Sets with the way back, the event panel when
 * there is no set yet, nothing without an event. It used to open
 * /shows/:id/scene-library, a route that does not exist.
 */
import { describe, test, expect } from 'vitest';
import { venueFixTarget } from './EpisodeAssetsTab';

const episode = { id: 'ep-1', title: 'Gala Night' };

describe('venueFixTarget', () => {
  test('the event\'s set opens in Scene Sets, carrying the assets tab back', () => {
    expect(venueFixTarget({ event: { id: 'ev-1', scene_set_id: 'set-9' }, episode, showId: 'show-1' })).toEqual({
      label: 'Open in Scene Sets',
      url: '/shows/show-1/world?tab=scene-sets&set=set-9&from=%2Fepisodes%2Fep-1%3Ftab%3Dassets&fromLabel=Gala%20Night&need=Venue%20image',
    });
  });

  test('no set yet: the event panel; no event or show: no button', () => {
    expect(venueFixTarget({ event: { id: 'ev-1' }, episode, showId: 'show-1' })).toEqual({ label: 'Event Panel', url: '/shows/show-1/world?tab=events' });
    expect(venueFixTarget({ event: null, episode, showId: 'show-1' })).toBeNull();
    expect(venueFixTarget({ event: { id: 'ev-1', scene_set_id: 'set-9' }, episode, showId: null })).toBeNull();
  });
});
