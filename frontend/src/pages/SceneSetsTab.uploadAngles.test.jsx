/**
 * Evoni, 2026-10-07: "i also need to be able to upload my own angles too".
 * Upload angles takes several images at once: each becomes its own angle,
 * named from its file, and its image is uploaded to it. Nothing is generated.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const SETS = [
  { id: 'set-1', name: "Lala's home", scene_type: 'HOME_BASE', generation_status: 'complete', base_still_url: 'https://x/home.jpg', angles: [{ id: 'a0', angle_label: 'GARDEN', angle_name: 'Garden', generation_status: 'complete' }] },
];
const posts = () => vi.mocked(apiClient.post).mock.calls;

describe('SceneSetsTab: Upload angles', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } }
    ));
    let n = 0;
    vi.mocked(apiClient.post).mockImplementation(async (url) => (
      url.endsWith('/angles') ? { data: { success: true, data: { id: `new-${++n}` } } } : { data: { success: true } }
    ));
  });

  test('two images become two angles, each named from its file, each with its image; nothing generates', async () => {
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('scene-set-open-set-1'));
    const input = screen.getByLabelText('Upload angle images');
    const files = [new File(['a'], 'garden.jpg', { type: 'image/jpeg' }), new File(['b'], 'front-door.png', { type: 'image/png' })];
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(posts().filter(([u]) => u.endsWith('/upload'))).toHaveLength(2));
    const creates = posts().filter(([u]) => u === '/api/v1/scene-sets/set-1/angles').map(([, body]) => body);
    expect(creates).toEqual([
      { angle_name: 'Garden', angle_label: 'GARDEN_2', angle_description: 'Uploaded image' },
      { angle_name: 'Front door', angle_label: 'FRONT_DOOR', angle_description: 'Uploaded image' },
    ]);
    expect(posts().filter(([u]) => u.endsWith('/upload')).map(([u]) => u)).toEqual([
      '/api/v1/scene-sets/set-1/angles/new-1/upload',
      '/api/v1/scene-sets/set-1/angles/new-2/upload',
    ]);
    expect(posts().filter(([u]) => /generate/.test(u))).toEqual([]);
  });
});
