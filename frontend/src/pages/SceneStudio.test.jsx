/**
 * SceneStudio — Track 6 CP8 behavioral tests (file 6 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers on /world/* (characters,
 * scenes listing with optional ?status=, tension-check, scene-generate,
 * approve, delete). All clean — no cross-CP overlaps.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
import SceneStudio, {
  listCharactersApi,
  listScenesApi,
  getTensionCheckApi,
  generateSceneApi,
  approveSceneApi,
  deleteSceneApi,
} from './SceneStudio';

describe('SceneStudio — Track 6 CP8 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listCharactersApi GET on /world/characters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { characters: [] } });
    await listCharactersApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/characters');
  });

  test('listScenesApi GET on /world/scenes (no status filter)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { scenes: [] } });
    await listScenesApi('all');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/scenes');
  });

  test('listScenesApi GET with status filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { scenes: [] } });
    await listScenesApi('approved');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/scenes?status=approved');
  });

  test('getTensionCheckApi GET on /world/tension-check', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pairs: [] } });
    await getTensionCheckApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/tension-check');
    // With a show, that show's pairs.
    await getTensionCheckApi('show b');
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/v1/world/tension-check?show_id=show%20b');
  });

  test('generateSceneApi POST on /world/scenes/generate', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { scene: {} } });
    const payload = { character_a_id: 'a', character_b_id: 'b', scene_type: 'hook_up', location: undefined };
    await generateSceneApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/scenes/generate', payload);
  });

  test('approveSceneApi POST on /world/scenes/:sceneId/approve (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { scene: {} } });
    await approveSceneApi('sc-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/scenes/sc-1/approve');
  });

  test('deleteSceneApi DELETE on /world/scenes/:sceneId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteSceneApi('sc-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/world/scenes/sc-1');
  });

  test('listCharactersApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listCharactersApi()).rejects.toThrow('not authorized');
  });

  test('generateSceneApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
    await expect(generateSceneApi({})).rejects.toThrow('busy');
  });
});

// Scan Tension read `pairs`, which /world/tension-check never answered, so
// it always found none (2026-10-08). The route now answers the pairs, with
// the world characters' ids the generator takes, for the active show.
describe('SceneStudio — Scan Tension', () => {
  const PAIR = {
    relationship_id: 'rel-1', character_a_id: 'w-1', character_a_name: 'Lala', character_b_id: 'w-2', character_b_name: 'Nia Vale',
    tension_state: 'volatile', relationship_type: 'Rival', situation: 'The window display.',
  };
  const CHARACTERS = [
    { id: 'w-1', name: 'Lala', status: 'active', intimate_eligible: true },
    { id: 'w-2', name: 'Nia Vale', status: 'active', intimate_eligible: true },
  ];

  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: [{ id: 'show-b', name: 'Styling Adventures' }] } };
      if (url.startsWith('/api/v1/world/tension-check')) return { data: { pairs: [PAIR], triggered: [], one_night_candidates: [], trigger_count: 2 } };
      if (url === '/api/v1/world/characters') return { data: { characters: CHARACTERS } };
      return { data: { scenes: [] } };
    });
  });

  test("the scan lists the active show's pairs, and Use This Pair fills the generator", async () => {
    render(<MemoryRouter><SceneStudio /></MemoryRouter>);
    const scan = screen.getByRole('button', { name: 'Scan Tension' });
    await waitFor(() => expect(scan.disabled).toBe(false));
    fireEvent.click(scan);
    const card = (await screen.findByText('Lala ↔ Nia Vale')).closest('.ws4-tension-card');
    expect(within(card).getByText('volatile')).toBeTruthy();
    expect(within(card).getByText('The window display.')).toBeTruthy();
    expect(screen.getByText('1 pair(s) found')).toBeTruthy();
    expect(screen.getByText('Found 1 tension pair')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/tension-check?show_id=show-b');

    fireEvent.click(within(card).getByRole('button', { name: 'Use This Pair' }));
    const select = (placeholder) => screen.getAllByRole('combobox').find((el) => el.options[0]?.textContent === placeholder);
    expect(select('Character A…').value).toBe('w-1');
    expect(select('Character B (optional)…').value).toBe('w-2');
  });

  test('a failed scan says so', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { data: [] } };
      if (url.startsWith('/api/v1/world/tension-check')) throw Object.assign(new Error('boom'), { response: { data: { error: 'relation "world_characters" does not exist' } } });
      return { data: { scenes: [], characters: [] } };
    });
    render(<MemoryRouter><SceneStudio /></MemoryRouter>);
    const scan = screen.getByRole('button', { name: 'Scan Tension' });
    await waitFor(() => expect(scan.disabled).toBe(false));
    fireEvent.click(scan);
    expect(await screen.findByText('relation "world_characters" does not exist')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/tension-check');
  });
});
