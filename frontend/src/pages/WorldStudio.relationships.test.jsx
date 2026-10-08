/**
 * World Studio's relationships live in character_relationships, the table
 * the Relationships page edits (Evoni's ruling, 2026-10-08; wiring map
 * fix-list item 23). The character's Relationships tab lists the table's
 * rows (a candidate says to confirm it on the Relationships page) and then
 * the old graph entries, marked as no longer edited; the add form takes a
 * World Studio character, not a typed name, and a tension in the
 * Relationships page's states. The routes' side:
 * tests/integration/worldStudioTension.integration.test.js.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('./RelationshipEngine', () => ({ default: () => null }));
vi.mock('./SocialProfileGenerator', () => ({ default: () => null }));

import apiClient from '../services/api';
import WorldStudio, { relationshipsOfChar, legacyRelationships, TENSION_STATES } from './WorldStudio';

const SABLE = {
  id: 'w-sable', name: 'Sable', character_type: 'rival', status: 'active', world_tag: 'lalaverse',
  relationships: [{ character_name: 'Nia', relationship_type: 'Rival', confirmed: true }],
  relationship_graph: [{ rel_id: 'old-1', character_name: 'Rex', relationship_type: 'friendship' }],
};
const NIA = { id: 'w-nia', name: 'Nia', character_type: 'peer', status: 'active', world_tag: 'lalaverse', relationships: [], relationship_graph: [] };
const RELS = {
  relationships: [
    { rel_id: 'r-1', character_name: 'Nia', relationship_type: 'Rival', tension_state: 'volatile', current_status: 'Active', confirmed: true, conflict_summary: 'The Avenue window.' },
    { rel_id: 'r-2', character_name: 'Mira', relationship_type: 'Ex', tension_state: 'simmering', confirmed: false },
  ],
  legacy: [{ rel_id: 'old-1', character_name: 'Rex', relationship_type: 'friendship', legacy: true }],
  in_registry: true,
};

const json = (data) => ({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/world/characters?')) return json({ characters: [SABLE, NIA] });
    if (String(url).endsWith('/world/characters/w-sable')) return json({ character: SABLE });
    return json({});
  }));
  vi.mocked(apiClient.get).mockImplementation(async (url) => (url === '/api/v1/world/characters/w-sable/relationships' ? { data: RELS } : { data: {} }));
});
afterEach(() => vi.unstubAllGlobals());

const openRelationships = async () => {
  render(<MemoryRouter><WorldStudio /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Sable', { selector: '.ws4-char-item-name, .ws4-char-item-name *' }));
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/characters/w-sable/relationships'));
  const tab = (await screen.findAllByRole('button', { name: /Relationships/ })).find((b) => b.classList.contains('ws4-tab'));
  fireEvent.click(tab);
};

describe('World Studio relationships (fix-list item 23)', () => {
  test("a character's relationships are the table's, then the old graph's; a bad graph is logged and read as none", () => {
    expect(relationshipsOfChar(SABLE).map((r) => r.character_name)).toEqual(['Nia', 'Rex']);
    expect(relationshipsOfChar({ relationship_graph: '[{"character_name":"A"}]' })).toHaveLength(1);
    expect(relationshipsOfChar({})).toEqual([]);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(legacyRelationships({ relationship_graph: '{oops' })).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(TENSION_STATES).toEqual(['calm', 'simmering', 'volatile', 'fractured', 'healing']);
  });

  test('the tab lists the table rows, a candidate to confirm, and the old entries marked as no longer edited', async () => {
    await openRelationships();
    const rows = await screen.findAllByTestId('ws-rel');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Nia')).toBeTruthy();
    expect(within(rows[0]).getByText('volatile')).toBeTruthy();
    expect(within(rows[0]).getByText(/The Avenue window/)).toBeTruthy();
    expect(within(rows[1]).getByText('Candidate: confirm it on the Relationships page')).toBeTruthy();
    const old = screen.getByTestId('ws-rel-legacy');
    expect(within(old).getByText('Rex')).toBeTruthy();
    expect(within(old).getByText('Old World Studio entry, no longer edited')).toBeTruthy();
    expect(screen.getByText('3 relationships')).toBeTruthy();
  });

  test('the add form takes a World Studio character and a tension, and a saved one reloads the list', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { relationship: { rel_id: 'r-3' } } });
    await openRelationships();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    const add = screen.getByRole('button', { name: 'Add Relationship' });
    expect(add.disabled).toBe(true);
    expect(screen.queryByPlaceholderText('Name or describe…')).toBeNull();
    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'w-nia' } });
    fireEvent.change(screen.getByLabelText('Tension'), { target: { value: 'fractured' } });
    expect(add.disabled).toBe(false);
    const loads = vi.mocked(apiClient.get).mock.calls.length;
    fireEvent.click(add);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, body] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe('/api/v1/world/characters/w-sable/relationships');
    expect(body).toMatchObject({ related_character_id: 'w-nia', tension_state: 'fractured', relationship_type: 'friendship' });
    expect(body).not.toHaveProperty('series_layer');
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.calls.length).toBeGreaterThan(loads));
  });
});
