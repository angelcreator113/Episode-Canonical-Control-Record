/**
 * Times & seasons of the everyday look (2026-10-15; step 2 of
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md): each slot is generated
 * (cost shown first) or uploaded; seasons need the Front view to generate.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import LookVariants from './LookVariants';

const BASE = '/api/v1/scene-sets/set-1/look-variants';
const slots = (values, labels, overrides = {}) => values.map((v, i) => ({ value: v, label: labels[i], variant: overrides[v] || null }));
const TIMES = ['morning', 'afternoon', 'golden_hour', 'evening', 'night'];
const TIME_LABELS = ['Morning', 'Afternoon', 'Golden hour', 'Evening', 'Night'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const SEASON_LABELS = ['Spring', 'Summer', 'Fall', 'Winter'];

let state;
const renderIt = () => {
  const onToast = vi.fn();
  render(<LookVariants setId="set-1" onToast={onToast} pollMs={5} />);
  return { onToast };
};
const posts = (u) => vi.mocked(api.post).mock.calls.filter(([url]) => url === u);

describe('LookVariants', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    state = {
      everyday_image_url: 'https://x/everyday.jpg', front_view_url: null,
      time: slots(TIMES, TIME_LABELS, { morning: { status: 'complete', source: 'uploaded', image_url: 'https://x/morning.jpg' } }),
      season: slots(SEASONS, SEASON_LABELS),
    };
    vi.mocked(api.get).mockImplementation(async () => ({ data: { success: true, data: state } }));
  });

  test('shows every slot; an uploaded one says so; seasons wait for the Front view', async () => {
    renderIt();
    await screen.findByTestId('look-variants');
    for (const v of TIMES) expect(screen.getByTestId(`look-variant-time-${v}`)).toBeTruthy();
    for (const v of SEASONS) expect(screen.getByTestId(`look-variant-season-${v}`)).toBeTruthy();
    expect(screen.getByTestId('look-variant-time-morning').textContent).toMatch(/Morning · uploaded/);
    expect(screen.getByTestId('look-variants-no-front')).toBeTruthy();
    expect(screen.getByTestId('look-variant-generate-season-winter').disabled).toBe(true);
    expect(screen.getByTestId('look-variant-upload-season-winter').disabled).toBe(false);
  });

  test('generate asks first with the cost, then generates and refreshes until ready', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${BASE}/time/evening/estimate`) return { data: { data: { estimate: { usd: 0.04 } } } };
      if (url === `${BASE}/time/evening/generate`) {
        state = { ...state, time: slots(TIMES, TIME_LABELS, { evening: { status: 'generating' } }) };
        return { data: { data: { status: 'generating' } } };
      }
      return { data: {} };
    });
    const { onToast } = renderIt();
    fireEvent.click(await screen.findByTestId('look-variant-generate-time-evening'));
    const confirm = await screen.findByTestId('look-variant-confirm');
    expect(confirm.textContent).toMatch(/Generate Evening — est\. \$0\.04\? A re-light of the everyday look\./);
    expect(posts(`${BASE}/time/evening/generate`)).toHaveLength(0);

    fireEvent.click(screen.getByTestId('look-variant-confirm-yes'));
    await waitFor(() => expect(posts(`${BASE}/time/evening/generate`)).toHaveLength(1));
    state = { ...state, time: slots(TIMES, TIME_LABELS, { evening: { status: 'complete', source: 'generated', image_url: 'https://x/evening.jpg' } }) };
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Evening is ready'));
    expect(screen.getByAltText('Evening').getAttribute('src')).toBe('https://x/evening.jpg');
  });

  // Audit 2026-10-15: a failed re-run keeps the previous image (complete,
  // with its error); a variant of an old everyday look is marked.
  test('a failed re-run says so, not "ready", and keeps its image; an old one is marked', async () => {
    state = { ...state, time: slots(TIMES, TIME_LABELS, {
      evening: { status: 'generating', image_url: 'https://x/evening.jpg' },
      night: { status: 'complete', source: 'generated', image_url: 'https://x/night.jpg', stale: true },
    }) };
    const { onToast } = renderIt();
    await screen.findByTestId('look-variants');
    expect(screen.getByTestId('look-variant-stale-time-night')).toBeTruthy();
    state = { ...state, time: slots(TIMES, TIME_LABELS, {
      evening: { status: 'complete', source: 'generated', image_url: 'https://x/evening.jpg', error: 'Kontext refused' },
    }) };
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Evening could not be generated: Kontext refused', 'error'));
    expect(onToast).not.toHaveBeenCalledWith('Evening is ready');
    expect(screen.getByAltText('Evening').getAttribute('src')).toBe('https://x/evening.jpg');
    expect(screen.getByTestId('look-variant-time-evening').textContent).toMatch(/Last try failed/);
  });

  test('upload sends the image to its slot; remove empties it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const { onToast } = renderIt();
    fireEvent.click(await screen.findByTestId('look-variant-upload-season-winter'));
    fireEvent.change(screen.getByTestId('look-variant-file'), { target: { files: [new File(['i'], 'w.png', { type: 'image/png' })] } });
    await waitFor(() => expect(posts(`${BASE}/season/winter/upload`)).toHaveLength(1));
    expect(posts(`${BASE}/season/winter/upload`)[0][1].get('image').name).toBe('w.png');
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Uploaded'));

    fireEvent.click(screen.getByTestId('look-variant-remove-time-morning'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`${BASE}/time/morning`));
  });

  test('a refusal is shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Variants use Flux Kontext, which needs FAL_KEY, which is not configured.' } } });
    const { onToast } = renderIt();
    fireEvent.click(await screen.findByTestId('look-variant-generate-time-night'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Variants use Flux Kontext, which needs FAL_KEY, which is not configured.', 'error'));
  });

  test('a first load that fails says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('offline'));
    renderIt();
    expect(await screen.findByTestId('look-variants-load-failed')).toBeTruthy();
  });
});
