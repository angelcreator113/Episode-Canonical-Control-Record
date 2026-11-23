/**
 * Generation B3 (Evoni, 2026-11-23): Start Episode sends the scene set its
 * Locations step showed for the event (the value the server sent when the
 * step loaded, not what was chosen in the step), shows the server's refusal
 * when the event has another set by then, and says so when the episode was
 * started but its locations were not saved.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import useStartEpisode, { shownEventSet } from './useStartEpisode';

const START_URL = '/api/v1/world/show-1/events/ev-1/generate-episode';
const LOCATIONS_URL = '/api/v1/world/show-1/events/ev-1/episode-locations';
const STALE = "This event's scene set changed while this was being made. Nothing was saved over the newer choice.";
const KEYED = { headers: { 'Idempotency-Key': expect.any(String) } };

let setToast;
let navigate;
const mount = () => renderHook(() => useStartEpisode({
  showId: 'show-1', eventId: 'ev-1', gatesMet: true, used: false, moneyPending: false,
  readiness: { warningItems: [] }, moneyWarnings: [], setToast, navigate, joinFromWhosNew: null,
}));
/** Opens the Locations step with what the server sends, confirms `chosen`, and answers "No one new". */
async function startWith(hook, chosen) {
  await act(async () => { await hook.result.current.handleStartEpisode(); });
  await waitFor(() => expect(hook.result.current.locationsStep).not.toBeNull());
  act(() => { hook.result.current.confirmStartEpisode(chosen); });
  await act(async () => { await hook.result.current.finishStartEpisode(); });
}

describe('shownEventSet', () => {
  test('the server\'s own field, null included; else the proposal\'s event entry; else null', () => {
    expect(shownEventSet({ event_scene_set_id: 'set-a', locations: [{ role: 'event', scene_set_id: 'set-x' }] })).toBe('set-a');
    expect(shownEventSet({ event_scene_set_id: null, locations: [{ role: 'event', scene_set_id: 'set-x' }] })).toBeNull();
    expect(shownEventSet({ locations: [{ role: 'home', scene_set_id: 'h' }, { role: 'event', scene_set_id: 'set-x' }] })).toBe('set-x');
    expect(shownEventSet({ locations: [] })).toBeNull();
    expect(shownEventSet(null)).toBeNull();
  });
});

describe('useStartEpisode and the set the Locations step showed', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    setToast = vi.fn();
    navigate = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === LOCATIONS_URL) {
        return { data: { success: true, data: {
          event_scene_set_id: 'set-a',
          locations: [{ role: 'event', scene_set_id: 'set-a', name: null }, { role: 'home', scene_set_id: 'set-home', name: null }],
          missing: ['closet'],
        } } };
      }
      return { data: { success: true } };
    });
  });

  test('the displayed set is sent, as it was when the step loaded, even when another set is chosen in the step', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { episode: { id: 'ep-9' }, setup_status: { complete: true, steps: { locations: { status: 'complete', count: 2 } } } } } });
    const hook = mount();
    const chosen = [{ role: 'event', scene_set_id: 'set-b', name: null }, { role: 'home', scene_set_id: 'set-home', name: null }];
    await startWith(hook, chosen);
    expect(api.post).toHaveBeenCalledWith(START_URL, { draft_script: false, locations: chosen, event_scene_set_id: 'set-a' }, KEYED);
    expect(navigate).toHaveBeenCalledWith('/episodes/ep-9?tab=overview');
    expect(setToast).not.toHaveBeenCalled();
  });

  test('an event with no set: null is sent', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { event_scene_set_id: null, locations: [], missing: ['event', 'home', 'closet'] } } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { episode: { id: 'ep-9' } } } });
    const hook = mount();
    await startWith(hook, []);
    expect(api.post).toHaveBeenCalledWith(START_URL, { draft_script: false, locations: [], event_scene_set_id: null }, KEYED);
  });

  test('the event\'s set changed since the step loaded (409 STALE_SOURCE_SET): the server\'s sentence is shown, nothing is opened, and the steps stay so it can be started again', async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409, data: { success: false, code: 'STALE_SOURCE_SET', error: STALE } } }));
    const hook = mount();
    await startWith(hook, [{ role: 'event', scene_set_id: 'set-a', name: null }]);
    expect(setToast).toHaveBeenCalledWith(STALE);
    expect(navigate).not.toHaveBeenCalled();
    expect(hook.result.current.whosNewStep).not.toBeNull();
    expect(hook.result.current.locationsStep).not.toBeNull();
    expect(hook.result.current.starting).toBe(false);
  });

  test('started, but its locations were not saved: said with the reason, and the episode is opened (its checklist shows the step until it is done)', async () => {
    const reason = `${STALE} The episode's locations were not saved: set them in the episode's Locations.`;
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, setup_complete: false, data: {
      episode: { id: 'ep-9' },
      setup_status: { complete: false, steps: { scene_plan: { status: 'complete' }, locations: { status: 'failed', code: 'STALE_SOURCE_SET', reason } } },
    } } });
    const hook = mount();
    await startWith(hook, [{ role: 'event', scene_set_id: 'set-a', name: null }]);
    expect(setToast).toHaveBeenCalledWith(`The episode was started, but its locations were not saved: ${reason}`);
    expect(navigate).toHaveBeenCalledWith('/episodes/ep-9?tab=overview');
  });
});
