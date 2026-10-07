/**
 * Assets → Overlays, the show's overlay library (Evoni, 2026-10-07): the
 * production overlays any episode can use, each ready or not made and
 * "Used in …" from GET /ui-overlays/:showId/usage; Make with AI, Upload,
 * Delete and New overlay keep the existing routes.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ProductionOverlaysTab from './ProductionOverlaysTab';

const OVERLAYS = [
  { id: 'show_title', name: 'Show Title', category: 'production', description: 'Opens every episode', generated: true, url: 'https://x/title.png', asset_id: 'a-title', variants: [{ asset_id: 'a-title' }, { asset_id: 'a-title-2' }] },
  { id: 'lower_third', name: 'Lower Third', category: 'production', generated: false, url: null, asset_id: null, custom: true, custom_id: 't-lower' },
  { id: 'phone_home', name: 'Phone Home', category: 'phone', generated: true, url: 'https://x/phone.png', asset_id: 'a-phone' },
];
const USAGE = {
  'a-title': [{ id: 'e1', episode_number: 1, title: 'The Opening' }],
  'a-title-2': [{ id: 'e1', episode_number: 1, title: 'The Opening' }, { id: 'e3', episode_number: 3, title: 'Studio' }],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/ui-overlays/show-1') return { data: { success: true, data: OVERLAYS } };
    if (url === '/api/v1/ui-overlays/show-1/usage') return { data: { success: true, data: USAGE } };
    return { data: {} };
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { name: 'Exit Button' } } });
  vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
});

describe('Show Overlays library', () => {
  test('lists only production overlays, each ready or not made, with the episodes that use it', async () => {
    render(<ProductionOverlaysTab showId="show-1" />);
    await screen.findByTestId('sol-card-show_title');
    expect(screen.queryByTestId('sol-card-phone_home')).toBeNull();
    expect(screen.getByTestId('sol-state-show_title').textContent).toBe('Ready');
    expect(screen.getByTestId('sol-state-lower_third').textContent).toBe('Not made');
    await waitFor(() => expect(screen.getByTestId('sol-usage-show_title').textContent).toBe('Used in 2 episodes'));
    expect(screen.getByTestId('sol-usage-lower_third').textContent).toBe('Not used yet');
    expect(screen.getByTestId('sol-tile-ready').textContent).toContain('1/2');
    expect(screen.getByTestId('sol-tile-episodes').textContent).toContain('2');
    expect(within(screen.getByTestId('sol-card-show_title')).getByRole('img', { name: 'Show Title' }).getAttribute('src')).toBe('https://x/title.png');
  });

  test('Make with AI generates that overlay; Remake once it is ready', async () => {
    render(<ProductionOverlaysTab showId="show-1" />);
    expect((await screen.findByTestId('sol-generate-show_title')).textContent).toContain('Remake');
    fireEvent.click(screen.getByTestId('sol-generate-lower_third'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/generate/lower_third'));
  });

  test('Upload sends the chosen file for that overlay', async () => {
    render(<ProductionOverlaysTab showId="show-1" />);
    fireEvent.click(await screen.findByTestId('sol-upload-lower_third'));
    const file = new File(['x'], 'lower.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('sol-file'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/upload/lower_third', expect.any(FormData)));
  });

  test('New overlay adds a production type from its name and prompt', async () => {
    render(<ProductionOverlaysTab showId="show-1" />);
    fireEvent.click(await screen.findByTestId('sol-new'));
    const dialog = screen.getByRole('dialog', { name: 'New overlay' });
    const add = within(dialog).getByRole('button', { name: 'Add overlay' });
    expect(add.disabled).toBe(true);
    fireEvent.change(within(dialog).getByPlaceholderText(/Show title card/), { target: { value: 'Exit Button' } });
    fireEvent.change(within(dialog).getByPlaceholderText(/Describe it/), { target: { value: 'A gold heart button' } });
    fireEvent.click(add);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/types', {
      name: 'Exit Button', description: '', prompt: 'A gold heart button', category: 'production',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('Delete removes a custom type and its image after confirming', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ProductionOverlaysTab showId="show-1" />);
    fireEvent.click(await screen.findByTestId('sol-delete-lower_third'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/types/t-lower'));
    await waitFor(() => expect(screen.queryByTestId('sol-card-lower_third')).toBeNull());
    confirmSpy.mockRestore();
  });

  test('no overlays: an empty state with New overlay', async () => {
    vi.mocked(api.get).mockImplementation(async () => ({ data: { success: true, data: [] } }));
    render(<ProductionOverlaysTab showId="show-1" />);
    expect(await screen.findByTestId('sol-empty')).toBeTruthy();
  });
});
