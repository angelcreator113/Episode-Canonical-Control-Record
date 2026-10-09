/**
 * Her own title image, and deleting the framed card (Evoni, 2026-10-09: "i
 * also want to be able to upload my own episode title and i cant delete
 * Full-screen framed card").
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTitleCard from './EpisodeTitleCard';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' };
const CARD = { asset_id: 'card-1', designed_for: 'Gala Night', outdated: false, image_url: 'https://x/card.png' };
const state = (over = {}) => ({
  title: 'Gala Night', approved: true, approved_value: 'Gala Night', card: null, offer: { offered: false },
  overlay: null, overlay_offer: { offered: false }, ...over,
});
const ok = (data) => Promise.resolve({ data: { success: true, data } });

describe('title image upload and framed card delete', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('Upload your own title sends the image and shows the new overlay', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state()));
    vi.mocked(api.post).mockReturnValue(ok(state({ overlay: { asset_id: 'up-1', outdated: false, style: { uploaded: true } } })));
    const onChange = vi.fn();
    render(<EpisodeTitleCard episode={EPISODE} part="overlay" onChange={onChange} />);
    const input = await screen.findByTestId('etc-overlay-upload-input');
    const file = new File(['png'], 'my-title.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/episodes/ep-1/title-overlay/upload');
    expect(body.get('file')).toBe(file);
    await screen.findByTestId('etc-overlay-delete');
    expect(onChange).toHaveBeenCalled();
  });

  test('Delete card asks first, then deletes; no card, no button', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({ card: CARD })));
    vi.mocked(api.delete).mockReturnValue(ok(state({ card: null })));
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<EpisodeTitleCard episode={EPISODE} part="card" />);
    fireEvent.click(await screen.findByTestId('etc-card-delete'));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('etc-card-delete'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-card'));
    await waitFor(() => expect(screen.queryByTestId('etc-card-delete')).toBeNull());
  });
});
