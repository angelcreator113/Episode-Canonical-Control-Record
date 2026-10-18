/**
 * Studio types on Universe › Locations (2026-10-18): lists the suggested
 * type and name for each studio typed "other"; Apply sends the ticked ones
 * and refreshes the list; hidden when nothing needs fixing.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import apiClient from '../../services/api';
import StudioTypes from './StudioTypes';

const LUX = { location_id: 'l1', name: "SHOWROOM.LUX's Studio", venue_type: 'other', proposed: { venue_type: 'boutique', name: "SHOWROOM.LUX's Showroom" }, why: 'their niche is fashion' };
const VELVET = { location_id: 'l2', name: "velvetcore's Studio", venue_type: 'other', proposed: { venue_type: 'recording_studio', name: "velvetcore's Studio" }, why: 'their niche is beat tapes' };
const URL = '/api/v1/world/locations/studio-types';

beforeEach(() => { apiClient.get.mockReset(); apiClient.post.mockReset(); });

describe('StudioTypes', () => {
  test('nothing to fix: hidden', async () => {
    apiClient.get.mockResolvedValue({ data: { studios: [] } });
    const { container } = render(<StudioTypes />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(URL));
    expect(container.textContent).toBe('');
  });

  test('lists each suggestion; Apply sends the ticked ones and refreshes', async () => {
    const onChanged = vi.fn();
    apiClient.get.mockResolvedValueOnce({ data: { studios: [LUX, VELVET] } }).mockResolvedValue({ data: { studios: [VELVET] } });
    apiClient.post.mockResolvedValue({ data: { changed: 1 } });
    render(<StudioTypes onChanged={onChanged} />);
    expect(await screen.findByText(/2 creator studios are typed “other”/)).toBeTruthy();
    expect(screen.getByText("SHOWROOM.LUX's Showroom")).toBeTruthy();
    expect(screen.getByText(/was SHOWROOM\.LUX's Studio/)).toBeTruthy();
    expect(screen.getByText(/recording studio/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply 1' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(URL, { items: [{ location_id: 'l1', venue_type: 'boutique', name: "SHOWROOM.LUX's Showroom" }] }));
    expect(await screen.findByText('Updated 1 studio.')).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });
});
