/**
 * The Character Registry works in a chosen registry (audit IA-05,
 * 2026-10-03): the active show's by default, switchable, kept in the URL;
 * quick create goes into that registry, never the first one the API
 * returned; a name already in it is refused with a way to open the
 * existing character; the Feed's "Registry →" link opens the character.
 * The cast (2026-10-08): Lala, her world (LalaVerse feed profiles linked
 * to characters) and the old system, with Archive.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

const CAST_REGISTRY = {
  id: 'reg-sal', title: 'SAL Cast', show_id: 'show-b', characters: [
    { id: 'lala', display_name: 'Lala', character_key: 'lala', role_type: 'special' },
    { id: 'sable', display_name: 'STUDIO BY SABLE', character_key: 'studio_by_sable', role_type: 'support' },
    { id: 'j1', display_name: 'Jade (Business Coach)', character_key: 'jade_coach', role_type: 'shadow' },
    { id: 'j2', display_name: 'Jade', character_key: 'jade', role_type: 'shadow' },
    { id: 'eva', display_name: 'Eva', character_key: 'eva', role_type: 'mirror' },
    { id: 'kim', display_name: 'Kim', character_key: 'kim', role_type: 'support' },
  ],
};
const CAST_PROFILES = [
  { id: 7, feed_layer: 'lalaverse', handle: 'studiobysable', display_name: 'STUDIO BY SABLE', society_archetype: 'the_peer', registry_character_id: 'sable' },
  { id: 8, feed_layer: 'lalaverse', handle: 'slowsift', display_name: 'slowsift', registry_character_id: null },
];
const CAST_REVIEW = {
  characters: [{ id: 'kim', cast_review: 'kept', feed_profile_id: null }, { id: 'eva', cast_review: null, feed_profile_id: null }],
  archived: [{ id: 'gone', display_name: 'Marcus Chen', role_type: 'special' }, { id: 'used', display_name: 'Nico', role_type: 'special' }],
  episode_counts: { sable: 1, eva: 0, used: 2, gone: 0 },
};

describe('CharacterRegistryPage: the cast', () => {
  let confirm;
  beforeEach(() => {
    rememberShow('show-b');
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: [CAST_REGISTRY] } };
      if (url.startsWith('/api/v1/social-profiles')) return { data: { profiles: CAST_PROFILES } };
      if (url.startsWith('/api/v1/cast/review')) return { data: { success: true, ...CAST_REVIEW } };
      return { data: {} };
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => confirm.mockRestore());

  const ready = async () => { renderAt(); await waitFor(() => expect(screen.getByRole('button', { name: 'Kept (1)' }).disabled).toBe(false)); };

  test('Lala, her world and the old system, each in its place, with episode counts', async () => {
    await ready();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/review?registry_id=reg-sal');
    expect(screen.getByTestId('cast-lala-role').textContent).toContain('Role says "Special"');
    expect(screen.getByTestId('cast-lala-role').textContent).toContain('that filter shows 0 today');
    const people = screen.getByTestId('cast-people');
    expect(people.textContent).toContain('@studiobysable');
    expect(people.textContent).toContain('The peer');
    expect(people.textContent).toContain('In 1 episode');
    expect(people.querySelector('a').getAttribute('href')).toBe('/character/sable');
    const old = screen.getByTestId('cast-old');
    expect(old.textContent).not.toContain('STUDIO BY SABLE');
    expect(old.textContent).not.toContain('Kim');
    expect(old.textContent.match(/Two "Jade"s/g)).toHaveLength(2);
    expect(old.textContent).toContain('No episodes');
    expect(screen.getByText('reviewed').previousSibling.textContent).toBe('3');
  });

  test('Keep moves a character to Kept; Back to review undoes it', async () => {
    await ready();
    fireEvent.click(within(screen.getByText('Eva').closest('li')).getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/eva/keep', { kept: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Kept (1)' }));
    const kept = screen.getByTestId('cast-kept');
    expect(kept.textContent).toContain('Kim');
    fireEvent.click(within(kept).getByRole('button', { name: 'Back to review' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/kim/keep', { kept: false }));
  });

  test('Match to feed person offers the feed people with no character and links the one chosen', async () => {
    await ready();
    fireEvent.click(within(screen.getByText('Eva').closest('li')).getByRole('button', { name: 'Match to feed person' }));
    const pick = screen.getByLabelText('Feed person for Eva');
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Choose a feed person…', 'slowsift (@slowsift)']);
    fireEvent.change(pick, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/cast/characters/eva/feed-profile', { feed_profile_id: 8 }));
  });

  test('Archived lists them; Bring back restores; Delete permanently asks, and is off while an episode uses one', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Archived (2)' }));
    const rows = screen.getByTestId('cast-archived');
    expect(rows.textContent).toContain('Marcus Chen');
    expect(within(screen.getByText('Nico').closest('li')).getByRole('button', { name: 'Delete permanently' }).disabled).toBe(true);
    expect(screen.getByText('Nico').closest('li').textContent).toContain('2 episodes');
    const marcus = screen.getByText('Marcus Chen').closest('li');
    fireEvent.click(within(marcus).getByRole('button', { name: 'Bring back' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/gone/restore'));
    const del = () => within(screen.getByText('Marcus Chen').closest('li')).getByRole('button', { name: 'Delete permanently' });
    await waitFor(() => expect(del().disabled).toBe(false));
    fireEvent.click(del());
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/cast/characters/gone/permanent'));
    expect(confirm.mock.calls.at(-1)[0]).toContain('cannot be undone');
  });

  test('Archive asks first, then soft-deletes; Archive selected sends the chosen ones; a no archives nothing', async () => {
    await ready();
    confirm.mockReturnValueOnce(false);
    fireEvent.click(within(screen.getByText('Jade').closest('li')).getByRole('button', { name: 'Archive' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByText('Jade').closest('li')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/character-registry/characters/j2'));
    expect(confirm.mock.calls.at(-1)[0]).toContain('Archive Jade?');
    fireEvent.click(screen.getByLabelText('Select Jade'));
    fireEvent.click(screen.getByLabelText('Select Jade (Business Coach)'));
    fireEvent.click(screen.getByRole('button', { name: 'Archive selected (2)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/characters/bulk-delete', { ids: ['j2', 'j1'] }));
  });
});
