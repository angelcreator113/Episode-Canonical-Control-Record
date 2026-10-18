/**
 * A studio's photos from its card (Evoni, 2026-10-18): Add photos makes one
 * set tied to the location (first photo main, the rest angles) and links it
 * as the resident's place of work; the resident's Places tab is linked; with
 * no show it says to choose one.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import StudioPhotos from './StudioPhotos';

const LOC = { id: 'loc-1', name: "velvetcore's Studio", residents: [{ id: 7, handle: 'velvetcore', display_name: 'velvetcore', character_id: 'c-9' }] };
const renderIt = (props = {}) => render(<MemoryRouter><StudioPhotos location={LOC} showId="show-1" {...props} /></MemoryRouter>);

beforeEach(() => { api.post.mockReset(); api.delete.mockReset(); });

describe('StudioPhotos', () => {
  test('links the resident\'s Places tab', () => {
    renderIt();
    expect(screen.getByRole('link', { name: 'velvetcore’s Places' }).getAttribute('href')).toBe('/character/c-9?tab=places');
  });

  test('Add photos: one set tied to the studio, its main photo, then linked as their place of work', async () => {
    const onDone = vi.fn();
    api.post.mockImplementation(async (url) => (url === '/api/v1/scene-sets' ? { data: { data: { id: 'set-1' } } } : { data: { success: true } }));
    renderIt({ onDone });
    const file = new File(['img'], 'studio.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('studio-photos-input-loc-1'), { target: { files: [file] } });
    expect(await screen.findByText("Photos added, as velvetcore's place of work.")).toBeTruthy();
    const calls = api.post.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(['/api/v1/scene-sets', '/api/v1/scene-sets/set-1/upload-base', '/api/v1/shows/show-1/character-places']);
    expect(api.post.mock.calls[0][1]).toEqual({ name: "velvetcore's Studio", scene_type: 'OTHER', show_id: 'show-1', world_location_id: 'loc-1' });
    expect(api.post.mock.calls[2][1]).toEqual({ character_id: 'c-9', scene_set_id: 'set-1', role: 'work' });
    expect(onDone).toHaveBeenCalled();
  });

  test('a failed main photo removes the set and says why', async () => {
    api.post.mockImplementation(async (url) => {
      if (url === '/api/v1/scene-sets') return { data: { data: { id: 'set-2' } } };
      throw Object.assign(new Error('x'), { response: { data: { error: 'not a readable image' } } });
    });
    api.delete.mockResolvedValue({ data: {} });
    renderIt();
    fireEvent.change(screen.getByTestId('studio-photos-input-loc-1'), { target: { files: [new File(['x'], 'a.heic', { type: 'image/heic' })] } });
    expect((await screen.findByRole('alert')).textContent).toBe('not a readable image');
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-2'));
  });

  test('with no show, it says to choose one', () => {
    renderIt({ showId: null });
    expect(screen.getByRole('button', { name: 'Add photos' }).disabled).toBe(true);
    expect(screen.getByText(/Choose a show first/)).toBeTruthy();
  });
});
