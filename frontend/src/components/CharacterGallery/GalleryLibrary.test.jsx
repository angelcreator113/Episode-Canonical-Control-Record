/**
 * Visual Memory, phase 1 (Evoni, 2026-10-18): inside the gallery, an ADMIN
 * adds a picture tagged with this character and whoever else is in it, and
 * edits a picture's tags, status and who may see it. Others see no tools.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CharacterGalleryTab from './CharacterGalleryTab';

const maren = { id: 'c-1', display_name: 'Maren' };
const asset = {
  id: 'a-1', status: 'approved', visibility: 'internal',
  links: [{ id: 'l-1', entity_type: 'character', entity_id: 'c-1', name: 'Maren' }, { id: 'l-2', entity_type: 'character', entity_id: 'c-2', name: 'Sable' }],
};
const groups = [
  { key: 'portraits', label: 'Portraits', items: [{ id: 'portrait:0', url: 'https://img/p.png', caption: 'Their profile photo', source: 'profile_photo' }] },
  { key: 'tagged', label: 'Tagged', items: [{ id: 'media:a-1', url: 'https://img/t.png', caption: 'At the market', source: 'library', asset }] },
];
const reply = (canEdit) => ({ data: { success: true, linked: true, can_edit: canEdit, groups } });

describe('GalleryLibrary', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  test('someone who is not ADMIN sees the pictures and no library tools', async () => {
    vi.mocked(api.get).mockResolvedValue(reply(false));
    render(<CharacterGalleryTab character={maren} />);
    expect(await screen.findByTestId('gallery-tagged')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add a picture/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open: At the market' }));
    expect(screen.queryByTestId('gallery-picture-library')).toBeNull();
  });

  test('Add a picture: its address, tagged with them and one more found by name', async () => {
    vi.mocked(api.get).mockImplementation((url) => (url.startsWith('/api/v1/media/taggables')
      ? Promise.resolve({ data: { success: true, items: [{ entity_type: 'character', entity_id: 'c-2', name: 'Sable' }, { entity_type: 'character', entity_id: 'c-1', name: 'Maren' }] } })
      : Promise.resolve(reply(true))));
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, asset } });
    render(<CharacterGalleryTab character={maren} />);
    fireEvent.click(await screen.findByRole('button', { name: /Add a picture/ }));
    const form = screen.getByTestId('gallery-add');
    fireEvent.change(within(form).getByLabelText('Or its address'), { target: { value: 'https://img/new.png' } });
    fireEvent.change(within(form).getByLabelText('Caption'), { target: { value: 'Bread rising' } });
    fireEvent.change(within(form).getByLabelText(/Tag who or what else/), { target: { value: 'Sa' } });
    const pick = await within(form).findByRole('button', { name: /Sable/ });
    expect(within(form).queryByRole('button', { name: /^Maren/ })).toBeNull();
    fireEvent.click(pick);
    fireEvent.click(within(form).getByRole('button', { name: 'Add to the gallery' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, sent] = api.post.mock.calls[0];
    expect(url).toBe('/api/v1/media');
    expect(sent.get('url')).toBe('https://img/new.png');
    expect(sent.get('caption')).toBe('Bread rising');
    expect(sent.get('visibility')).toBe('internal');
    expect(JSON.parse(sent.get('links'))).toEqual([{ entity_type: 'character', entity_id: 'c-1' }, { entity_type: 'character', entity_id: 'c-2' }]);
  });

  test('in the larger view: untag, change who may see it, and add a picture not yet in the library', async () => {
    vi.mocked(api.get).mockResolvedValue(reply(true));
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true, asset: { ...asset, links: [asset.links[0]] } } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, asset: { ...asset, visibility: 'public' } } });
    render(<CharacterGalleryTab character={maren} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open: At the market' }));
    const panel = screen.getByTestId('gallery-picture-library');
    fireEvent.click(within(panel).getByRole('button', { name: 'Untag Sable' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/media/a-1/links/l-2'));
    await waitFor(() => expect(within(panel).queryByText('Sable')).toBeNull());
    fireEvent.change(within(panel).getByLabelText('Who may see it'), { target: { value: 'public' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/media/a-1', { visibility: 'public' }));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, asset: { id: 'a-2', status: 'approved', visibility: 'internal', links: [asset.links[0]] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Open: Their profile photo' }));
    const fresh = screen.getByTestId('gallery-picture-library');
    fireEvent.click(within(fresh).getByRole('button', { name: /Add to the library/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/media', expect.objectContaining({
      url: 'https://img/p.png', source: 'portrait', status: 'approved', visibility: 'internal',
    })));
    expect(await within(fresh).findByRole('button', { name: 'Untag Maren' })).toBeTruthy();
  });
});
