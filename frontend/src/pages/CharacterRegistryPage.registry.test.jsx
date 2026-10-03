/**
 * The Character Registry works in a chosen registry (audit IA-05,
 * 2026-10-03): the active show's by default, switchable, kept in the URL;
 * quick create goes into that registry, never the first one the API
 * returned; a name already in it is refused with a way to open the
 * existing character; the Feed's "Registry →" link opens the character.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../services/api';
import CharacterRegistryPage, { chooseRegistry, duplicateIn } from './CharacterRegistryPage';
import { rememberShow } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
// Newest first, as the API orders them: the other show's registry is [0].
const REGISTRIES = [
  { id: 'reg-other', title: 'Another Registry', show_id: 'show-a', characters: [{ id: 'c1', display_name: 'Rival', character_key: 'rival', role_type: 'pressure' }] },
  { id: 'reg-sal', title: 'SAL Cast', show_id: 'show-b', characters: [{ id: 'c2', display_name: 'Marcus', character_key: 'marcus', role_type: 'support' }, { id: 'c3', display_name: 'Nadia', character_key: 'nadia', role_type: 'mirror' }] },
];
const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const renderAt = (entry = '/character-registry') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/character-registry" element={<><CharacterRegistryPage /><Where /></>} />
      <Route path="/character/:id" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const cardNames = () => screen.queryAllByText(/^(Rival|Marcus|Nadia)$/).map((el) => el.textContent).sort();

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
    if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: REGISTRIES } };
    return { data: {} };
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
});

describe('chooseRegistry / duplicateIn', () => {
  test('the URL\'s registry, else the active show\'s, else the only one, else none', () => {
    expect(chooseRegistry(REGISTRIES, { urlRegistryId: 'reg-other', showId: 'show-b' })).toBe('reg-other');
    expect(chooseRegistry(REGISTRIES, { showId: 'show-b' })).toBe('reg-sal');
    expect(chooseRegistry(REGISTRIES, { showId: 'show-z' })).toBeNull();
    expect(chooseRegistry([REGISTRIES[1]], {})).toBe('reg-sal');
    expect(chooseRegistry([], { showId: 'show-b' })).toBeNull();
  });
  test('a duplicate is the same name, case aside, or the same key', () => {
    expect(duplicateIn(REGISTRIES[1], ' marcus ').id).toBe('c2');
    expect(duplicateIn(REGISTRIES[1], 'Nadia!').id).toBe('c3');
    expect(duplicateIn(REGISTRIES[1], 'Rival')).toBeNull();
  });
});

describe('CharacterRegistryPage: the chosen registry', () => {
  test('opens on the active show\'s registry and creates into it, not the first one returned', async () => {
    rememberShow('show-b');
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia']));
    expect(screen.getByTestId('registry-count').textContent).toBe('2 characters in SAL Cast');
    fireEvent.click(screen.getByTestId('new-character'));
    expect(screen.getByTestId('create-title').textContent).toBe('New Character in SAL Cast');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jules' } });
    fireEvent.click(screen.getByTestId('create-submit'));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/character-registry/registries/reg-sal/characters');
    expect(api.post.mock.calls[0][1]).toMatchObject({ display_name: 'Jules', character_key: 'jules' });
  });

  test('switching registries changes the view, the URL and the create target', async () => {
    rememberShow('show-b');
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia']));
    fireEvent.change(screen.getByTestId('registry-select'), { target: { value: 'reg-other' } });
    await waitFor(() => expect(cardNames()).toEqual(['Rival']));
    expect(screen.getByTestId('where').textContent).toBe('/character-registry?registry=reg-other');
    fireEvent.click(screen.getByTestId('new-character'));
    expect(screen.getByTestId('create-title').textContent).toBe('New Character in Another Registry');
  });

  test('with no show\'s registry it shows all, read-only until a registry is chosen in the form', async () => {
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia', 'Rival']));
    expect(screen.getByTestId('registry-count').textContent).toBe('3 characters across 2 registries');
    fireEvent.click(screen.getByTestId('new-character'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jules' } });
    expect(screen.getByTestId('create-submit').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('create-registry'), { target: { value: 'reg-sal' } });
    expect(screen.getByTestId('create-submit').disabled).toBe(false);
    fireEvent.click(screen.getByTestId('create-submit'));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/character-registry/registries/reg-sal/characters');
  });

  test('a name already in the registry is refused, with a way to open the existing character', async () => {
    rememberShow('show-b');
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia']));
    fireEvent.click(screen.getByTestId('new-character'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'marcus' } });
    expect(screen.getByTestId('create-duplicate').textContent).toContain('Marcus already exists in SAL Cast');
    expect(screen.getByTestId('create-submit').disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Open it →'));
    expect(screen.getByTestId('where').textContent).toBe('/character/c2');
  });

  test('?character= from the Feed opens that character', async () => {
    renderAt('/character-registry?view=world&character=c3');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/character/c3'));
  });
});
