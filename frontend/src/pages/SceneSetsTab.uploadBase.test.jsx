/**
 * DJ finding 5 (Evoni, 2026-10-02, §8(hh)): "Uploading an image to replace
 * a set's base starts a regeneration. An upload must only replace the base
 * image (it follows S6's protections on an approved base); no generation
 * call." The upload no longer runs the Scene Spec or makes angles from it,
 * and an approved base offers no Replace.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const SETS = [
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', angles: [], generation_status: 'complete', base_still_url: 'https://x/atelier.jpg', base_approved: false },
  { id: 'set-2', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', angles: [], generation_status: 'complete', base_still_url: 'https://x/glass.jpg', base_approved: true },
];
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);
const posts = () => vi.mocked(apiClient.post).mock.calls.map(([url]) => url);

describe('SceneSetsTab: replacing a base by upload (DJ 5)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } }
    ));
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { stillUrl: 'https://x/new.jpg' } } });
  });

  test('an upload only uploads: no Scene Spec, no angles, no generation', async () => {
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    const input = card('set-1').querySelector('input[type="file"][multiple]');
    const file = new File(['jpg'], 'atelier.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(posts()).toContain('/api/v1/scene-sets/set-1/upload-base'));
    // Let any follow-up calls run.
    await new Promise((r) => setTimeout(r, 50));
    expect(posts().filter((u) => /spec\/generate|spec\/create-angles|generate-base|\/generate$/.test(u))).toEqual([]);
  });

  test('an approved base offers no Replace (S6); an unapproved one does', async () => {
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    expect(document.querySelector('[data-testid="scene-set-replace-base-set-2"]')).toBeNull();
    expect(document.querySelector('[data-testid="scene-set-replace-base-set-1"]')).toBeTruthy();
  });
});
