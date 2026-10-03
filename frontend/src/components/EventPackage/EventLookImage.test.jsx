/**
 * "Generate this look" in the Place section (Evoni's rulings L7-L9,
 * 2026-10-02, answers 3, 4 and 6; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventLookImage from './EventLookImage';

const BASE = '/api/v1/world/show-1/events/ev-1/look';
const SET = { id: 'set-1', name: 'Glasshouse Hall', base_still_url: 'https://x/approved.jpg', generation_status: 'complete' };
const BRIEF = (mode = 'event_dressing') => ({
  version: 1, scene_set_id: 'set-1', event_id: mode === 'event_dressing' ? 'ev-1' : null, angle: 'WIDE', mode,
  lines: [{ layer: 'place', key: 'identity', label: 'Place', text: 'Glasshouse Hall.', source: 'venue', essential: true }],
  rules: ['No people present.'], missing: [], overrides: {},
});
const sceneSetPath = (showId, setId) => `/shows/${showId}/world?tab=scene-sets&set=${setId}`;

let lookState;
let briefData;
// S8 (Evoni, 2026-10-02; §8(dd), answer 1): the look is made in the Scene
// Sets panel (canGenerate); the Place shows status and "Open in Scene Sets →".
const renderIt = (props = {}) => {
  const onToast = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <EventLookImage showId="show-1" eventId="ev-1" sceneSetPath={sceneSetPath} onToast={onToast} onSaved={onSaved} pollMs={5} canGenerate {...props} />
    </MemoryRouter>,
  );
  return { onToast, onSaved };
};
const posts = (u) => vi.mocked(api.post).mock.calls.filter(([url]) => url === u);

describe('EventLookImage (L7-L9)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    lookState = { scene_set: SET, approved_base: { scene_set_id: 'set-1', image_url: 'https://x/approved.jpg' }, look: null };
    briefData = { step: 'look', scene_set: { id: 'set-1', name: 'Glasshouse Hall' }, brief: BRIEF(), estimate: { usd: 0.04, priced: true } };
    vi.mocked(api.get).mockImplementation(async (url) => (url === BASE ? { data: { success: true, data: lookState } } : { data: {} }));
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${BASE}/brief`) return { data: { success: true, data: briefData } };
      if (url === `${BASE}/generate`) {
        lookState = { ...lookState, look: { id: 'look-1', status: 'generating' } };
        return { data: { success: true, data: { step: briefData.step, scene_set_id: 'set-1' } } };
      }
      return { data: {} };
    });
  });

  test('with an approved base: the cost first, then Confirm generates the look; it refreshes until ready and shows the thumbnail', async () => {
    const { onToast, onSaved } = renderIt();
    fireEvent.click(await screen.findByTestId('generate-this-look'));

    await screen.findByTestId('scene-brief-confirm');
    expect(screen.getByText('Generate this look on “Glasshouse Hall”')).toBeTruthy();
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.04');
    expect(posts(`${BASE}/generate`)).toHaveLength(0);

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posts(`${BASE}/generate`)).toHaveLength(1));
    expect(posts(`${BASE}/generate`)[0][1]).toEqual({ overrides: {} });
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    expect(onSaved).toHaveBeenCalled();

    lookState = { ...lookState, look: { id: 'look-1', status: 'complete', image_url: 'https://x/look.jpg' } };
    expect((await screen.findByTestId('event-look-thumb')).getAttribute('src')).toBe('https://x/look.jpg');
    expect(onToast).toHaveBeenCalledWith('The look is ready');
  });

  test('with no approved base: the base only, described as the empty room awaiting approval', async () => {
    briefData = { step: 'base', scene_set: null, creates_set: { name: 'The Glasshouse' }, brief: BRIEF('full'), estimate: { usd: 0.08, priced: true } };
    lookState = { scene_set: null, approved_base: null, look: null };
    const { onToast } = renderIt();
    fireEvent.click(await screen.findByTestId('generate-this-look'));
    await screen.findByTestId('scene-brief-confirm');
    expect(screen.getByText('Generate the base for “The Glasshouse”')).toBeTruthy();
    expect(screen.getByText(/The empty room, with no event dressing/)).toBeTruthy();

    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${BASE}/brief`) return { data: { success: true, data: briefData } };
      lookState = { scene_set: { ...SET, base_still_url: null, generation_status: 'generating' }, approved_base: null, look: null };
      return { data: { success: true, data: { step: 'base', scene_set_id: 'set-1' } } };
    });
    fireEvent.click(screen.getByTestId('sbc-confirm'));
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    lookState = { scene_set: { ...SET, generation_status: 'complete' }, approved_base: null, look: null };
    expect(await screen.findByTestId('event-look-awaiting')).toBeTruthy();
    expect(onToast).toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
  });

  test('a base waiting for approval is said so, and nothing is generated', async () => {
    lookState = { scene_set: SET, approved_base: null, look: null };
    briefData = { step: 'awaiting_approval', brief: null, estimate: null };
    const { onToast } = renderIt();
    expect(await screen.findByTestId('event-look-awaiting')).toBeTruthy();
    fireEvent.click(screen.getByTestId('generate-this-look'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('The base is waiting for your approval in Scene Sets'));
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
    expect(posts(`${BASE}/generate`)).toHaveLength(0);
  });

  test('several sets at the venue: Evoni chooses one, and it is sent with the brief and the generation', async () => {
    lookState = { scene_set: null, approved_base: null, look: null };
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === `${BASE}/brief`) {
        if (!body?.scene_set_id) return { data: { success: true, data: { step: 'choose', options: [{ id: 'set-a', name: 'Atrium' }, { id: 'set-b', name: 'Bar' }] } } };
        return { data: { success: true, data: { step: 'base', scene_set: { id: body.scene_set_id, name: 'Atrium' }, brief: BRIEF('full'), estimate: { usd: 0.08, priced: true } } } };
      }
      return { data: { success: true, data: { step: 'base', scene_set_id: 'set-a' } } };
    });
    renderIt();
    fireEvent.click(await screen.findByTestId('generate-this-look'));
    fireEvent.click(await screen.findByTestId('event-look-choose-set-a'));
    await screen.findByTestId('scene-brief-confirm');
    expect(posts(`${BASE}/brief`).some(([, b]) => b?.scene_set_id === 'set-a')).toBe(true);
    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posts(`${BASE}/generate`)).toHaveLength(1));
    expect(posts(`${BASE}/generate`)[0][1]).toEqual({ overrides: {}, scene_set_id: 'set-a' });
  });

  // DJ bug 1 (Evoni, 2026-10-02): the section stayed on "Generating…" after a
  // base-only run. Reloading the event after Confirm can remount it mid-run:
  // it refreshes whenever the server says something is generating.
  test('a base generating when the section opens is refreshed until it is done', async () => {
    lookState = { scene_set: { ...SET, base_still_url: null, generation_status: 'generating' }, approved_base: null, look: null };
    const { onToast } = renderIt();
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    lookState = { scene_set: { ...SET, generation_status: 'complete' }, approved_base: null, look: null };
    expect(await screen.findByTestId('event-look-awaiting')).toBeTruthy();
    expect(screen.queryByTestId('event-look-generating')).toBeNull();
    expect(onToast).toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
  });

  test('a look generating when the section opens is refreshed until it is done', async () => {
    lookState = { ...lookState, look: { id: 'look-1', status: 'generating' } };
    const { onToast } = renderIt();
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    lookState = { ...lookState, look: { id: 'look-1', status: 'complete', image_url: 'https://x/look.jpg' } };
    expect((await screen.findByTestId('event-look-thumb')).getAttribute('src')).toBe('https://x/look.jpg');
    expect(onToast).toHaveBeenCalledWith('The look is ready');
  });

  test('a load that fails says so, not "No look image yet", and Try again reloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    lookState = { scene_set: SET, approved_base: null, look: null };
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'));
    renderIt();
    expect(await screen.findByTestId('event-look-load-failed')).toBeTruthy();
    expect(screen.queryByText('No look image yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByTestId('event-look-load-failed')).toBeNull());
  });

  test('a failed base says so with its reason', async () => {
    lookState = { scene_set: { ...SET, base_still_url: null, generation_status: 'generating' }, approved_base: null, look: null };
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-generating');
    lookState = { scene_set: { ...SET, base_still_url: null, generation_status: 'failed', error: 'Timed out: no image after 10 minutes' }, approved_base: null, look: null };
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe('The base could not be generated: Timed out: no image after 10 minutes.');
    expect(onToast).toHaveBeenCalledWith('The base could not be generated: Timed out: no image after 10 minutes');
  });

  // DJ 6 (Evoni, 2026-10-02): after the venue's base is approved, the Place
  // section shows it, with "Generate this look" for the dressed version.
  test("the venue's approved base shows before the event's look exists, with Generate this look", async () => {
    lookState = { scene_set: null, approved_base: { scene_set_id: 'set-1', image_url: 'https://x/approved.jpg' }, look: null, editable: true };
    renderIt();
    const figure = await screen.findByTestId('event-look-approved-base');
    expect(figure.querySelector('img').getAttribute('src')).toBe('https://x/approved.jpg');
    expect(figure.textContent).toContain('Generate this look to dress it for this event.');
    expect(screen.getByTestId('generate-this-look')).toBeTruthy();
    expect(screen.queryByText('No look image yet.')).toBeNull();
  });

  test('an approval made elsewhere shows when the window regains focus', async () => {
    lookState = { scene_set: null, approved_base: null, look: null, editable: true };
    renderIt();
    expect(await screen.findByText('No look image yet.')).toBeTruthy();
    lookState = { scene_set: null, approved_base: { scene_set_id: 'set-1', image_url: 'https://x/approved.jpg' }, look: null, editable: true };
    fireEvent(window, new Event('focus'));
    expect(await screen.findByTestId('event-look-approved-base')).toBeTruthy();
  });

  // L13: the Place locks when the episode is accepted.
  test('an accepted episode locks the Place: no Generate this look', async () => {
    lookState = { ...lookState, editable: false };
    renderIt();
    expect(await screen.findByTestId('event-look-locked')).toBeTruthy();
    expect(screen.queryByTestId('generate-this-look')).toBeNull();
  });

  test('a failed look says so', async () => {
    lookState = { ...lookState, look: { id: 'look-1', status: 'failed', error: 'provider down' } };
    renderIt();
    expect((await screen.findByTestId('event-look-failed')).textContent).toBe('The last try failed: provider down.');
  });
});

// S8 (Evoni, 2026-10-02; §8(dd)): "Other pages (... Place ...) show status
// only, with one entry point: 'Open in Scene Sets →', landing on the exact
// set and zone, with a way back."
describe('EventLookImage in the Place (S8): status only', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    lookState = { scene_set: SET, approved_base: { scene_set_id: 'set-1', image_url: 'https://x/approved.jpg' }, look: null, editable: true };
    vi.mocked(api.get).mockImplementation(async (url) => (url === BASE ? { data: { success: true, data: lookState } } : { data: {} }));
  });

  test('no Generate this look; "Open in Scene Sets →" lands on the event\'s look, with the way back', async () => {
    renderIt({ canGenerate: false });
    const link = await screen.findByTestId('event-look-open');
    expect(link.textContent).toBe('Open in Scene Sets →');
    expect(link.getAttribute('href')).toBe(`/shows/show-1/world?tab=scene-sets&set=set-1&zone=look%3Aev-1&from=${encodeURIComponent('/shows/show-1/events/ev-1')}&fromLabel=Event&need=${encodeURIComponent("This event's look")}`);
    expect(screen.queryByTestId('generate-this-look')).toBeNull();
    expect(screen.getByTestId('event-look-approved-base').textContent).toContain("Make this event's look in Scene Sets.");
    expect(api.post).not.toHaveBeenCalled();
  });

  test('with no set and no approved base it says where to start', async () => {
    lookState = { scene_set: null, approved_base: null, look: null, editable: true };
    renderIt({ canGenerate: false });
    expect(await screen.findByText("Choose the event's scene set, then make its look in Scene Sets.")).toBeTruthy();
    expect(screen.queryByTestId('event-look-open')).toBeNull();
  });
});
