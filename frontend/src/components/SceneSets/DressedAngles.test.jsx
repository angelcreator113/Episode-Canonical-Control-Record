/**
 * S8 (Evoni, 2026-10-02; §8(dd)), answer 2: "Dressed angles move onto the look
 * in the panel." For an event's finished look on a set, each angle with its
 * dressed version; Generate shows the brief and its cost first (S2), Upload
 * stores an image as the dressed angle.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import DressedAngles from './DressedAngles';

const LIST = '/api/v1/episode-brief/ep-1/dressed-angles?scene_set_id=set-1';
const BRIEF = {
  version: 1, scene_set_id: 'set-1', angle: 'DOORWAY', mode: 'full',
  lines: [{ layer: 'event', key: 'concept', label: 'Event', text: 'Dressed for Velour Gala.', source: 'look', essential: true }],
  rules: ['No people present.'], missing: [], overrides: {},
};
let data;

describe('DressedAngles (S8, answer 2)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    data = {
      look: { id: 'look-1', image_url: 'https://x/look.jpg' },
      angles: [
        { id: 'a-front', label: 'ESTABLISHING', name: 'Front steps', kind: 'front', still_image_url: 'https://x/f.jpg', dressed: null },
        { id: 'a-inside', label: 'WIDE', name: 'Main hall', kind: 'inside', still_image_url: 'https://x/i.jpg', dressed: { status: 'complete', image_url: 'https://x/i-dressed.jpg' } },
      ],
    };
    vi.mocked(api.get).mockImplementation(async (url) => (url === LIST ? { data: { data } } : { data: {} }));
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/brief')) return { data: { success: true, data: { target: { kind: 'dressed_angle', angle_id: 'a-front' }, brief: BRIEF, estimate: { usd: 0.04, priced: true } } } };
      return { data: { success: true } };
    });
  });

  test('lists each angle with its dressed status; Generate shows the cost first, then dresses it', async () => {
    render(<DressedAngles episodeId="ep-1" setId="set-1" />);
    const front = await screen.findByTestId('dressed-angle-a-front');
    expect(front.textContent).toContain('Front steps');
    expect(front.textContent).toContain('Not dressed yet');
    expect(screen.getByTestId('dressed-angle-a-inside').querySelector('img').getAttribute('src')).toBe('https://x/i-dressed.jpg');

    fireEvent.click(within(front).getByRole('button', { name: 'Generate dressed' }));
    await screen.findByTestId('scene-brief-confirm');
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.04');
    expect(vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith('/generate'))).toHaveLength(0);
    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/dressed-angles/a-front/generate', { overrides: {} }));
  });

  test('Upload stores the file as the dressed angle', async () => {
    render(<DressedAngles episodeId="ep-1" setId="set-1" />);
    const front = await screen.findByTestId('dressed-angle-a-front');
    const file = new File(['x'], 'dressed.jpg', { type: 'image/jpeg' });
    fireEvent.change(within(front).getByLabelText('Upload the dressed Front steps'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/dressed-angles/a-front/upload', expect.any(FormData), expect.anything()));
  });

  test('says so when the event has no finished look on this set', async () => {
    data = { look: null, angles: [] };
    render(<DressedAngles episodeId="ep-1" setId="set-1" />);
    expect(await screen.findByText('Dressed angles are made once this look is ready.')).toBeTruthy();
  });
});
