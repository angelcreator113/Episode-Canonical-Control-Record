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
const auth = { user: { groups: ['admin'] } };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

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

describe('CharacterRegistryPage: Lala in another registry', () => {
  test('her card shows though her row is not in the registry in view, and opens her', async () => {
    rememberShow('show-b');
    const lalaElsewhere = [
      { ...REGISTRIES[0], characters: [...REGISTRIES[0].characters, { id: 'lala-1', display_name: 'Lala', character_key: 'lala', role_type: 'special' }] },
      REGISTRIES[1],
    ];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: lalaElsewhere } };
      return { data: {} };
    });
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia']));
    const card = screen.getByTestId('cast-lala');
    expect(card.textContent).toContain('Lala');
    expect(screen.queryByTestId('cast-lala-missing')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: /Open Lala/ }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/character/lala-1'));
  });

  test('with no Lala anywhere the page says so', async () => {
    rememberShow('show-b');
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia']));
    expect(screen.queryByTestId('cast-lala')).toBeNull();
    expect(screen.getByTestId('cast-lala-missing').textContent).toContain('Lala has no character');
  });
});

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

  // Ready once the episode counts are in (the gold stat stops reading "–").
  const ready = async () => { renderAt(); await waitFor(() => expect(screen.getByText('in an episode').previousSibling.textContent).toBe('1')); };

  test('Lala and her world, with episode counts', async () => {
    await ready();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/review?registry_id=reg-sal');
    // Lala is the Protagonist though her stored role is 'special' (Task 3199): no warning.
    expect(screen.getByTestId('cast-lala').textContent).toContain('Protagonist');
    expect(screen.queryByTestId('cast-other-protagonists')).toBeNull();
    const people = screen.getByTestId('cast-people');
    expect(people.textContent).toContain('@studiobysable');
    expect(people.textContent).toContain('The peer');
    expect(people.textContent).toContain('In 1 episode');
    expect(people.querySelector('a').getAttribute('href')).toBe('/character/sable');
    expect(screen.getByText('in her world').previousSibling.textContent).toBe('2');
    expect(screen.getByText('with a character').previousSibling.textContent).toBe('1');
  });

  // Evoni, 2026-10-16: "get rid of the old system stuff". The section is off
  // the page; its characters are not deleted, and nothing here archives.
  test('the old system is off the page: no section, no old characters, no review or archive actions', async () => {
    await ready();
    expect(screen.queryByText('From the old system')).toBeNull();
    expect(screen.queryByTestId('cast-old')).toBeNull();
    expect(screen.queryByTestId('cast-archived')).toBeNull();
    // Archived ones are nowhere; live ones no feed profile names are listed plainly.
    for (const name of ['Marcus Chen', 'Nico']) expect(screen.queryByText(name)).toBeNull();
    const more = screen.getByTestId('cast-more');
    expect(more.textContent).toContain('Eva');
    expect(more.textContent).toContain('Kim');
    expect(more.textContent).not.toContain('STUDIO BY SABLE');
    expect(more.textContent).not.toContain('Lala');
    expect(more.querySelector('a').getAttribute('href')).toMatch(/^\/character\//);
    for (const label of ['Keep', 'Archive', 'Match to feed person', 'Bring back', 'Delete permanently']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('"Create character" shows only on a feed person with none, crosses them for the active show, and the chip clears (Task 3201)', async () => {
    let profiles = CAST_PROFILES;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: [CAST_REGISTRY] } };
      if (url.startsWith('/api/v1/social-profiles')) return { data: { profiles } };
      if (url.startsWith('/api/v1/cast/review')) return { data: { success: true, ...CAST_REVIEW } };
      return { data: {} };
    });
    vi.mocked(api.post).mockImplementation(async () => {
      profiles = CAST_PROFILES.map((p) => (p.id === 8 ? { ...p, registry_character_id: 'kim' } : p));
      return { data: { crossed: true, registry_character: { id: 'kim' }, registry_note: null } };
    });
    await ready();
    const buttons = screen.getAllByTestId('cast-create-character');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('li').textContent).toContain('slowsift');
    expect(screen.getByTestId('cast-people').textContent).toContain('No character yet');
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/social-profiles/8/cross', { show_id: 'show-b' }));
    await waitFor(() => expect(screen.queryByTestId('cast-create-character')).toBeNull());
    expect(screen.getByTestId('cast-people').textContent).not.toContain('No character yet');
    expect(screen.getByText('Character created for slowsift')).toBeTruthy();
  });

  test('"Create character" shows the route\'s reason when no character is made', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { crossed: true, registry_character: null, registry_note: 'No character registry to add this profile to yet.' } });
    await ready();
    fireEvent.click(screen.getByTestId('cast-create-character'));
    expect(await screen.findByText('No character registry to add this profile to yet.')).toBeTruthy();
  });

  test('another character tagged Protagonist is flagged on Lala\'s card (Task 3199)', async () => {
    const withJaw = { ...CAST_REGISTRY, characters: [...CAST_REGISTRY.characters, { id: 'jaw', display_name: 'JustAWoman', character_key: 'justawoman', role_type: 'protagonist' }] };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: [withJaw] } };
      if (url.startsWith('/api/v1/social-profiles')) return { data: { profiles: CAST_PROFILES } };
      if (url.startsWith('/api/v1/cast/review')) return { data: { success: true, ...CAST_REVIEW } };
      return { data: {} };
    });
    renderAt();
    const flag = await screen.findByTestId('cast-other-protagonists');
    expect(flag.textContent).toBe("Lala is the show's one Protagonist. Also tagged Protagonist: JustAWoman.");
  });
});

describe('CharacterRegistryPage: every feed person, none archived', () => {
  beforeEach(() => rememberShow('show-b'));

  test('feed people past the first 100 are loaded, and an archived one is left out', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i, feed_layer: 'lalaverse', handle: `p${i}`, display_name: `Person ${i}` }));
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: [CAST_REGISTRY] } };
      if (url.includes('/api/v1/social-profiles') && url.includes('page=1')) return { data: { profiles: page1 } };
      if (url.includes('/api/v1/social-profiles') && url.includes('page=2')) {
        return { data: { profiles: [
          { id: 8, feed_layer: 'lalaverse', handle: 'slowsift', display_name: 'slowsift' },
          { id: 9, feed_layer: 'lalaverse', handle: 'oldone', display_name: 'Archived One', status: 'archived' },
        ] } };
      }
      if (url.startsWith('/api/v1/cast/review')) return { data: { success: true, ...CAST_REVIEW } };
      return { data: {} };
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('cast-people').textContent).toContain('@slowsift'));
    expect(screen.getByTestId('cast-people').textContent).not.toContain('Archived One');
  });

  test('"All registries" counts the review of every registry', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/character-registry/registries')) return { data: { success: true, registries: [CAST_REGISTRY, REGISTRIES[0]] } };
      if (url.startsWith('/api/v1/social-profiles')) return { data: { profiles: CAST_PROFILES } };
      if (url.startsWith('/api/v1/cast/review')) return { data: { success: true, ...CAST_REVIEW } };
      return { data: {} };
    });
    renderAt('/character-registry');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/cast/review?registry_id=reg-sal'));
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/cast/review?registry_id=reg-other'));
  });
});


describe('CharacterRegistryPage: Make one for me (Evoni, 2026-10-19)', () => {
  test('opens the panel for the registry in view; Edit opens New character prefilled and saves through the form', async () => {
    rememberShow('show-b');
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/character-generation/cast/propose') {
        return { data: { success: true, proposals: [{ display_name: 'Sienna Vale', selected_name: 'Sienna Okafor-Vale', role_type: 'shadow', icon: '🦹', description: 'A rival stylist.', world: 'lalaverse', pulse: { handle: 'sienna_vale' } }] } };
      }
      return { data: { success: true } };
    });
    renderAt();
    await waitFor(() => expect(cardNames()).toEqual(['Marcus', 'Nadia']));
    fireEvent.click(screen.getByTestId('make-for-me'));
    fireEvent.click(screen.getByTestId('cmfm-make-1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/character-generation/cast/propose', { registry_id: 'reg-sal', idea: '', count: 1 }));
    fireEvent.click(await screen.findByTestId('cmfm-edit'));
    expect(screen.queryByTestId('cmfm')).toBeNull();
    expect(screen.getByTestId('create-title').textContent).toBe('New Character in SAL Cast');
    expect(screen.getByLabelText('Name').value).toBe('Sienna Vale');
    fireEvent.click(screen.getByTestId('create-submit'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/registries/reg-sal/characters', expect.objectContaining({
      display_name: 'Sienna Vale', selected_name: 'Sienna Okafor-Vale', role_type: 'shadow', description: 'A rival stylist.', character_key: 'sienna_vale',
    })));
    const sent = api.post.mock.calls.find((c) => c[0].endsWith('/characters'))[1];
    expect(sent.pulse).toBeUndefined();
  });

  test('a signed-in non-admin does not see the button', async () => {
    auth.user = { groups: ['user'] };
    try {
      renderAt();
      await waitFor(() => expect(cardNames().length).toBeGreaterThan(0));
      expect(screen.getByTestId('new-character')).toBeTruthy();
      expect(screen.queryByTestId('make-for-me')).toBeNull();
    } finally {
      auth.user = { groups: ['admin'] };
    }
  });
});
