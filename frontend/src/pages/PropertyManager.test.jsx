/**
 * PropertyManager — Track 6 CP11 behavioral tests (file 2 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers. No cross-CP
 * duplication; all helpers fresh.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import PropertyManager, {
  listPropertiesApi,
  createPropertyApi,
  addPropertyRoomApi,
  PROPERTY_ADMIN_ONLY_MESSAGE,
} from './PropertyManager';

describe('PropertyManager — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listPropertiesApi GET on /properties returns response.data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    const out = await listPropertiesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/properties');
    expect(out).toEqual({ data: [] });
  });

  test('createPropertyApi POST on /properties with payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    const payload = { name: "Lala's Penthouse", property_type: 'penthouse', style_preset_id: 'modern-glam' };
    await createPropertyApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/properties', payload);
  });

  test('addPropertyRoomApi POST on /properties/:id/rooms', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    await addPropertyRoomApi('p-1', { name: 'Master Bedroom', template_id: 'bedroom-master-rectangular' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/properties/p-1/rooms',
      { name: 'Master Bedroom', template_id: 'bedroom-master-rectangular' },
    );
  });

  describe('Error path propagation', () => {
    test('listPropertiesApi rejection propagates (caller catches → empty)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listPropertiesApi()).rejects.toThrow('not authorized');
    });

    test('createPropertyApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createPropertyApi({})).rejects.toThrow('validation');
    });

    test('addPropertyRoomApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
      await expect(addPropertyRoomApi('missing', {})).rejects.toThrow('not found');
    });
  });
});

// The four property writes are an ADMIN's (Evoni, 2026-11-22). The page still
// opens and lists for anyone signed in; a refused write says why.
describe('PropertyManager — a write the server kept for an admin', () => {
  const refused = () => Object.assign(new Error('Request failed with status code 403'), {
    response: { status: 403, data: { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' } },
  });
  const PROPERTY = { id: 'p-1', name: 'The Loft', metadata: { property_type: 'loft' }, childLocations: [] };
  const open = () => render(<MemoryRouter><PropertyManager /></MemoryRouter>);

  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [PROPERTY] } });
  });

  test('create property refused with a 403: the admin-only sentence, not the request error', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(refused());
    open();
    await screen.findByText(/The Loft/);
    fireEvent.change(screen.getByPlaceholderText(/Property Name/), { target: { value: 'New Place' } });
    fireEvent.click(screen.getByText('+ Create Property'));
    expect(await screen.findByText(PROPERTY_ADMIN_ONLY_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/status code 403/)).toBeNull();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  test('add room refused with a 403: the admin-only sentence, and the form stays open', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(refused());
    open();
    await screen.findByText(/The Loft/);
    fireEvent.click(screen.getByText('+ Add Room'));
    fireEvent.change(screen.getByPlaceholderText(/Room name/), { target: { value: 'Closet' } });
    fireEvent.change(screen.getByDisplayValue('Select layout template'), { target: { value: 'closet-walkin-large' } });
    const buttons = screen.getAllByText('+ Add Room');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText(PROPERTY_ADMIN_ONLY_MESSAGE)).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/properties/p-1/rooms', { name: 'Closet', template_id: 'closet-walkin-large' });
    expect(screen.getByPlaceholderText(/Room name/)).toBeTruthy();
  });

  test('any other failure keeps its own message', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Network Error'));
    open();
    await screen.findByText(/The Loft/);
    fireEvent.change(screen.getByPlaceholderText(/Property Name/), { target: { value: 'New Place' } });
    fireEvent.click(screen.getByText('+ Create Property'));
    expect(await screen.findByText('Network Error')).toBeTruthy();
    expect(screen.queryByText(PROPERTY_ADMIN_ONLY_MESSAGE)).toBeNull();
  });
});
