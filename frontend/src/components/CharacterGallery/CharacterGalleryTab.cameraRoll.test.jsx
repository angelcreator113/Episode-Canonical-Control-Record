/**
 * The camera roll in the Gallery tab (Evoni, 2026-10-19: one official
 * headshot each; every other photo a moment from their life, with a reason).
 * GET /api/v1/camera-roll/characters/:id drives the Official Portrait row,
 * Recent Photos, the albums and the ADMIN's planner; without it the tab is
 * the gallery as before.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../PostMedia/NeedsPicture', () => ({ default: () => null }));

import api from '../../services/api';
import AuthContext from '../../contexts/AuthContext';
import CharacterGalleryTab from './CharacterGalleryTab';

const maren = { id: 'c-1', display_name: 'Maren' };
const ADMIN = { user: { email: 'evoni@x.dev', groups: ['ADMIN'] } };
const MEMBER = { user: { email: 'ed@x.dev', groups: ['editor'] } };

const gallery = (canEdit) => ({
  success: true, linked: true, can_edit: canEdit,
  groups: [
    { key: 'portraits', label: 'Portraits', items: [
      { id: 'portrait:0', url: 'https://img/head.png', caption: 'Their profile photo', source: 'profile_photo' },
      { id: 'portrait:1', url: 'https://img/p2.png', caption: 'A portrait from the look', source: 'portrait' },
    ] },
    { key: 'wardrobe', label: 'Wardrobe', items: [{ id: 'wardrobe:w1', url: 'https://img/w.png', caption: 'Silk slip dress', source: 'wardrobe' }] },
    { key: 'tagged', label: 'Tagged', items: [
      { id: 'lib:a1', url: 'https://img/bread.png', caption: 'First loaf', source: 'generated', asset: { id: 'a1', status: 'approved', visibility: 'private', tags: [] } },
    ] },
  ],
});

const photo = (n, album, extra = {}) => ({
  asset_id: `a${n}`, url: `https://img/roll${n}.png`, caption: `Moment ${n}`, album, purpose: 'private', taken_by: 'selfie',
  story_date: '2026-03-14', moment_id: `m${n}`, created_at: `2026-10-19T10:0${n}:00Z`, ...extra,
});

const roll = (over = {}) => ({
  data: {
    character: { id: 'c-1', name: 'Maren' }, eligible: true, target: 12,
    headshot: { asset_id: 'h1', url: 'https://img/head.png' },
    albums: [
      { key: 'everyday', label: 'Everyday Life', count: 2 }, { key: 'work', label: 'Work & Projects', count: 1 },
      { key: 'travel', label: 'Travel & Places', count: 0 }, { key: 'events', label: 'Events', count: 0 },
      { key: 'social', label: 'Social', count: 0 }, { key: 'fashion', label: 'Fashion & Wardrobe', count: 0 },
      { key: 'objects', label: 'Objects & Details', count: 1 },
    ],
    moments: [
      { id: 'm9', status: 'proposed', moment: 'Flour on her hands at 6am', purpose: 'posted', taken_by: 'friend', shows_face: false, outfit: 'work', album: 'work', place_text: 'The bakery on Radiance Row', story_date: '2026-03-15', people: [] },
      { id: 'm8', status: 'kept', moment: 'Mirror check before the gala', purpose: 'sent', taken_by: 'mirror', shows_face: true, outfit: 'going_out', album: 'fashion', place_text: 'Her flat', story_date: null, people: [] },
      { id: 'm7', status: 'dropped', moment: 'A dropped one', purpose: 'private', taken_by: 'selfie', shows_face: true, album: 'everyday', people: [] },
    ],
    photos: [photo(1, 'everyday'), photo(2, 'everyday', { url: 'https://img/bread.png', purpose: 'posted', taken_by: 'friend' }), photo(3, 'work'), photo(4, 'objects')],
    ...over,
  },
});

function mockGets({ canEdit = true, rollData = roll(), rollError = null } = {}) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url.startsWith('/api/v1/camera-roll/')) return rollError ? Promise.reject(rollError) : Promise.resolve({ data: rollData });
    return Promise.resolve({ data: gallery(canEdit) });
  });
}

const renderAs = (auth, props = {}) => render(
  <AuthContext.Provider value={auth}><CharacterGalleryTab character={maren} {...props} /></AuthContext.Provider>,
);

describe('CharacterGalleryTab — the camera roll', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the official headshot comes first with its badge; albums and their counts from the read', async () => {
    mockGets();
    renderAs(ADMIN);
    const official = await screen.findByTestId('gallery-official');
    const items = within(official).getAllByRole('listitem');
    expect(within(items[0]).getByText('Main headshot')).toBeTruthy();
    expect(within(items[0]).getByAltText("Maren's official headshot")).toBeTruthy();
    // The portrait that is the headshot is not shown twice.
    expect(items).toHaveLength(2);
    expect(api.get).toHaveBeenCalledWith('/api/v1/camera-roll/characters/c-1');

    const nav = screen.getByRole('navigation', { name: 'Albums' });
    expect(within(nav).getByRole('button', { name: /Everyday Life\s*2/ })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: /Objects & Details\s*1/ })).toBeTruthy();
    expect(within(screen.getByTestId('gallery-albums')).getByRole('button', { name: 'Work & Projects, 1 photo' })).toBeTruthy();
    // Recent Photos: the camera roll, newest first.
    expect(within(screen.getByTestId('gallery-recent')).getAllByRole('listitem')).toHaveLength(4);
    // A camera-roll photo the library also tags is not listed again under Tagged.
    expect(within(screen.getByTestId('gallery-tagged')).queryByAltText('First loaf')).toBeNull();
  });

  test('an album filters to its photos; a photo opens with its reason', async () => {
    mockGets();
    renderAs(ADMIN);
    const nav = await screen.findByRole('navigation', { name: 'Albums' });
    fireEvent.click(within(nav).getByRole('button', { name: /Everyday Life/ }));
    const view = screen.getByTestId('gallery-view');
    expect(within(view).getAllByRole('listitem')).toHaveLength(2);
    expect(within(view).queryByAltText('Moment 3')).toBeNull();

    fireEvent.click(within(view).getByRole('button', { name: 'Open: Moment 2' }));
    const reason = within(screen.getByRole('dialog')).getByTestId('photo-reason');
    expect(reason.textContent).toContain('Posted on The Pulse');
    expect(reason.textContent).toContain('Taken by a friend');
    expect(reason.textContent).toContain('14 Mar 2026');
    expect(reason.textContent).toContain('Everyday Life');
  });

  test('the planner: plan, keep, drop, make kept photos', async () => {
    mockGets();
    vi.mocked(api.post).mockResolvedValue({ data: { data: { moments: [{ id: 'n1' }], made: 1, failed: 0, stopped_for_budget: false } } });
    renderAs(ADMIN);
    const planner = await screen.findByTestId('camera-roll-planner');
    // Dropped moments are not shown; the open ones are.
    expect(within(planner).queryByText('A dropped one')).toBeNull();
    expect(within(planner).getByText('Flour on her hands at 6am')).toBeTruthy();

    fireEvent.change(within(planner).getByLabelText(/An idea/), { target: { value: 'her first week' } });
    // 12 wanted, 2 planned and not dropped: 10 more.
    fireEvent.click(within(planner).getByRole('button', { name: /Plan their camera roll \(10\)/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/characters/c-1/plan', { count: 10, idea: 'her first week' }));

    const proposed = await screen.findByTestId('moment-m9');
    await waitFor(() => expect(within(proposed).getByRole('button', { name: /Keep/ }).disabled).toBe(false));
    fireEvent.click(within(proposed).getByRole('button', { name: /Keep/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/moments/m9/keep'));
    await waitFor(() => expect(within(proposed).getByRole('button', { name: /Drop/ }).disabled).toBe(false));
    fireEvent.click(within(proposed).getByRole('button', { name: /Drop/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/moments/m9/drop'));

    await waitFor(() => expect(screen.getByRole('button', { name: /Make kept photos \(1\)/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /Make kept photos \(1\)/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/characters/c-1/make-kept'));
    expect(await screen.findByText('1 photo made.')).toBeTruthy();
  });

  test('an edit saves the moment through PATCH', async () => {
    mockGets();
    vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
    renderAs(ADMIN);
    const card = await screen.findByTestId('moment-m8');
    fireEvent.click(within(card).getByRole('button', { name: /Edit/ }));
    const form = within(card).getByRole('form', { name: 'Edit this moment' });
    fireEvent.change(within(form).getByLabelText('What is happening'), { target: { value: 'Mirror check before the Velour gala' } });
    fireEvent.change(within(form).getByLabelText('Why it exists'), { target: { value: 'posted' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/camera-roll/moments/m8', expect.objectContaining({
      moment: 'Mirror check before the Velour gala', purpose: 'posted', taken_by: 'mirror', album: 'fashion', story_date: null, shows_face: true,
    })));
  });

  test('set as headshot sends the portrait', async () => {
    mockGets();
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
    renderAs(ADMIN);
    const official = await screen.findByTestId('gallery-official');
    fireEvent.click(within(official).getByRole('button', { name: 'Set as headshot' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/camera-roll/characters/c-1/headshot', { url: 'https://img/p2.png' }));
  });

  test('a member sees the photos but no tools, no planner and no headshot control', async () => {
    mockGets({ canEdit: false });
    renderAs(MEMBER);
    expect(await screen.findByTestId('gallery-recent')).toBeTruthy();
    expect(screen.queryByTestId('gallery-tools')).toBeNull();
    expect(screen.queryByTestId('camera-roll-planner')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set as headshot' })).toBeNull();
    expect(screen.getByText(/Every photo has a reason/)).toBeTruthy();
  });

  test('not eligible: the reason is said plainly, and nothing can be planned', async () => {
    mockGets({ rollData: roll({ eligible: false, reason: 'Dr. Amara Sinclair is confidential: no photos are made of her.', moments: [], photos: [] }) });
    renderAs(ADMIN);
    expect((await screen.findByTestId('camera-roll-ineligible')).textContent).toContain('confidential');
    expect(screen.queryByTestId('camera-roll-planner')).toBeNull();
    expect(screen.queryByRole('button', { name: /Create New Photo/ })).toBeNull();
  });

  test('with no camera roll on the server, the gallery shows as before', async () => {
    mockGets({ rollError: Object.assign(new Error('Not found'), { response: { status: 404 } }) });
    renderAs(ADMIN);
    expect(await screen.findByText(/4 pictures of Maren/)).toBeTruthy();
    expect(screen.getByTestId('gallery-wardrobe')).toBeTruthy();
    expect(within(screen.getByTestId('gallery-tagged')).getByAltText('First loaf')).toBeTruthy();
    expect(screen.queryByTestId('gallery-albums')).toBeNull();
    expect(screen.queryByTestId('camera-roll-planner')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
