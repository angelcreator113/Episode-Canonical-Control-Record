/**
 * DreamMap — CP15 (city-positions persistence).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import DreamMap, { getMapPositionsApi, saveMapPositionsApi } from './DreamMap';

describe('DreamMap — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getMapPositionsApi GET on /world/map/positions', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { positions: {} } });
    await getMapPositionsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/map/positions');
  });

  test('saveMapPositionsApi PUT on /world/map/positions with positions wrapper', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const positions = { miami: { x: 100, y: 200 } };
    await saveMapPositionsApi(positions);
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/world/map/positions', { positions });
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
    await expect(saveMapPositionsApi({})).rejects.toThrow('forbidden');
  });
});

describe('DreamMap upload prompt', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.mocked(apiClient.get).mockResolvedValue({ data: { positions: {} } });
  });

  test('without a map image it asks for one, above the legend and zoom row', () => {
    render(<DreamMap locations={[]} profiles={[]} mapImageUrl={null} />);
    const prompt = screen.getByTestId('dream-map-upload-prompt');
    expect(prompt.textContent).toBe('Upload your rendered DREAM map below');
    expect(prompt.style.bottom).toBe('56px');
    expect(prompt.style.maxWidth).toBe('calc(100% - 32px)');
  });

  test('Edit Positions hides it (its own banner takes the spot); an uploaded image never shows it', () => {
    const { unmount } = render(<DreamMap locations={[]} profiles={[]} mapImageUrl={null} />);
    fireEvent.click(screen.getByText('Edit Positions'));
    expect(screen.queryByTestId('dream-map-upload-prompt')).toBeNull();
    expect(screen.getByText('Drag cities to reposition them on the map')).toBeTruthy();
    unmount();
    render(<DreamMap locations={[]} profiles={[]} mapImageUrl="https://example.test/map.png" />);
    expect(screen.queryByTestId('dream-map-upload-prompt')).toBeNull();
  });
});
