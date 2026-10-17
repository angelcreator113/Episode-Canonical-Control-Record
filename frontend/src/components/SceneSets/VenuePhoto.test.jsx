/**
 * Evoni, 2026-10-17: "the venue has its own photo", apart from the set's
 * main photo: upload, replace or remove it on the set's panel.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import VenuePhoto from './VenuePhoto';

describe('VenuePhoto', () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  test('a set with no World Location says how to add one', () => {
    render(<VenuePhoto set={{ id: 'set-1', world_location_id: null }} />);
    expect(screen.getByTestId('venue-photo-set-1').textContent).toMatch(/Link this set to its World Location/);
    expect(screen.queryByTestId('venue-photo-upload-set-1')).toBeNull();
  });

  test('upload sends the photo, then the set is read again', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const onSaved = vi.fn();
    const onToast = vi.fn();
    render(<VenuePhoto set={{ id: 'set-1', world_location_id: 'loc-1' }} onSaved={onSaved} onToast={onToast} />);
    expect(screen.getByTestId('venue-photo-upload-set-1').textContent).toMatch(/Upload/);
    fireEvent.change(screen.getByTestId('venue-photo-input-set-1'), { target: { files: [new File(['x'], 'street.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/api/v1/scene-sets/set-1/venue-photo');
    expect(vi.mocked(api.post).mock.calls[0][1].get('image').name).toBe('street.jpg');
    expect(onToast).toHaveBeenCalledWith('Venue photo saved');
  });

  test('a saved photo shows, with Replace and Remove', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const onSaved = vi.fn();
    render(<VenuePhoto set={{ id: 'set-1', world_location_id: 'loc-1', venue_photo_url: 'https://x/street.jpg' }} onSaved={onSaved} />);
    expect(screen.getByTestId('venue-photo-img-set-1').getAttribute('src')).toBe('https://x/street.jpg');
    expect(screen.getByTestId('venue-photo-upload-set-1').textContent).toMatch(/Replace/);
    fireEvent.click(screen.getByTestId('venue-photo-remove-set-1'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/venue-photo'));
    expect(onSaved).toHaveBeenCalled();
  });
});
