/**
 * Show Settings → Logo: the show's logo, read, uploaded and removed through
 * /api/v1/shows/:id/logo. Uploading or removing saves at once.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import { ShowLogoBlock } from './ShowSettings';

const LOGO = { url: 'https://bucket.example/shows/logos/show-1/a.png', width: 1024, height: 256 };

describe('ShowLogoBlock', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });
  afterEach(() => vi.restoreAllMocks());

  test('with no logo: says so and offers an upload; the upload posts the file and shows it', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, logo: null } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, logo: LOGO } });
    const onToast = vi.fn();
    render(<ShowLogoBlock showId="show-1" onToast={onToast} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/logo'));
    expect(screen.getByText('No logo')).toBeTruthy();
    expect(screen.getByText('Upload logo')).toBeTruthy();
    expect(screen.queryByTestId('show-logo-remove')).toBeNull();
    expect(screen.getByTestId('show-logo-input').getAttribute('accept')).toBe('image/png,image/jpeg,image/webp');

    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('show-logo-input'), { target: { files: [file] } });
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Logo saved'));
    const [url, form] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/shows/show-1/logo');
    expect(form.get('image')).toBe(file);
    expect(screen.getByAltText("The show's logo").getAttribute('src')).toBe(LOGO.url);
    expect(screen.getByText('Replace logo')).toBeTruthy();
  });

  test('a refused upload shows the reason and keeps the old logo', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, logo: LOGO } });
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'The logo must be a PNG, JPEG or WebP image.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onToast = vi.fn();
    render(<ShowLogoBlock showId="show-1" onToast={onToast} />);
    await waitFor(() => expect(screen.getByAltText("The show's logo")).toBeTruthy());
    fireEvent.change(screen.getByTestId('show-logo-input'), { target: { files: [new File(['x'], 'logo.svg', { type: 'image/svg+xml' })] } });
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Not saved: The logo must be a PNG, JPEG or WebP image.', 'error'));
    expect(screen.getByAltText("The show's logo").getAttribute('src')).toBe(LOGO.url);
  });

  test('Remove asks first, then deletes and goes back to No logo', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, logo: LOGO } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true, logo: null } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const onToast = vi.fn();
    render(<ShowLogoBlock showId="show-1" onToast={onToast} />);
    await waitFor(() => expect(screen.getByTestId('show-logo-remove')).toBeTruthy());

    fireEvent.click(screen.getByTestId('show-logo-remove'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('show-logo-remove'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Logo removed'));
    expect(api.delete).toHaveBeenCalledWith('/api/v1/shows/show-1/logo');
    expect(screen.getByText('No logo')).toBeTruthy();
  });
});
