/**
 * Someone's profile on The Pulse (Evoni, 2026-10-19): who they are, their
 * audience number, how they and Lala follow each other, their posts; an
 * ADMIN gets the two follow switches and the full character page link.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../services/api';
import PulsePerson, { followBadges } from './PulsePerson';

const SHOW = { id: 'show-1' };
const PROFILE = { id: 7, handle: 'maren', display_name: 'Maren', bio: 'baker and early riser', city: 'echo_park', portrait_url: null };
let relation;
const renderIt = (props = {}) => render(
  <MemoryRouter><PulsePerson show={SHOW} handle="@maren" viewAt="present" {...props} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  relation = { follows_lala: true, lala_follows: false, friends: false };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/pulse-follows/profile/maren')) {
      return { data: { data: { profile: PROFILE, is_lala: false, followers: { count: 1200, tier: null, estimated: false }, relation, character_id: 'char-7' } } };
    }
    if (url.startsWith('/api/v1/feed-posts?')) {
      return { data: { data: [
        { id: 'a', content_text: 'Dough at 5am', image_url: 'https://cdn/dough.jpg' },
        { id: 'b', content_text: 'Quiet morning' },
      ] } };
    }
    return { data: {} };
  });
});

describe('followBadges', () => {
  test('one way each side; Friends when both', () => {
    expect(followBadges({ follows_lala: true, lala_follows: false }).map((b) => b.text)).toEqual(['Follows Lala']);
    expect(followBadges({ follows_lala: false, lala_follows: true }).map((b) => b.text)).toEqual(['Lala follows']);
    expect(followBadges({ follows_lala: true, lala_follows: true, friends: true }).map((b) => b.text)).toEqual(['Friends']);
    expect(followBadges(null)).toEqual([]);
  });
});

describe('PulsePerson', () => {
  test('the profile: name, handle and city, bio, audience number, badge and a grid of posts; reads at the story moment', async () => {
    renderIt();
    expect(await screen.findByRole('heading', { name: 'Maren' })).toBeTruthy();
    expect(screen.getByText('@maren · Echo Park')).toBeTruthy();
    expect(screen.getByTestId('pp-bio').textContent).toBe('baker and early riser');
    expect(screen.getByTestId('pp-followers').textContent).toMatch(/^1,200 followers/);
    expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Follows Lala']);
    const tiles = await screen.findAllByTestId('pp-post');
    expect(tiles).toHaveLength(2);
    expect(tiles[0].querySelector('img').getAttribute('src')).toBe('https://cdn/dough.jpg');
    expect(tiles[1].textContent).toBe('Quiet morning');
    expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/api/v1/pulse-follows/profile/maren?show_id=show-1&at=present');
    expect(vi.mocked(api.get).mock.calls[1][0]).toContain('profile_id=7');
    expect(screen.queryByTestId('pp-admin')).toBeNull();
  });

  test('an admin flips "Lala follows them" on and "Follows Lala" off; Friends shows when both', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { follows_lala: true, lala_follows: true, friends: true } } });
    vi.mocked(api.delete).mockResolvedValue({ data: { data: { follows_lala: false, lala_follows: true, friends: false } } });
    renderIt({ admin: true });
    const lalaFollows = await screen.findByTestId('pp-lala-follows');
    expect(lalaFollows.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('pp-character-link').getAttribute('href')).toBe('/character/char-7');

    fireEvent.click(lalaFollows);
    await waitFor(() => expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Friends']));
    expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-follows/7/lala-follows');
    expect(screen.getByTestId('pp-lala-follows').getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByTestId('pp-follows-lala'));
    await waitFor(() => expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Lala follows']));
    expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-follows/7/follows-lala');
  });

  test('a refused change is said plainly and changes nothing', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 403, data: { error: 'Admins only.' } } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt({ admin: true });
    fireEvent.click(await screen.findByTestId('pp-lala-follows'));
    expect((await screen.findByRole('alert')).textContent).toBe('Admins only.');
    expect(screen.getAllByTestId('pp-badge').map((b) => b.textContent.trim())).toEqual(['Follows Lala']);
    err.mockRestore();
  });

  test('nobody with that handle: said, with a way back', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onBack = vi.fn();
    renderIt({ onBack });
    expect((await screen.findByRole('alert')).textContent).toBe('That profile could not be found.');
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(onBack).toHaveBeenCalled();
    err.mockRestore();
  });
});
