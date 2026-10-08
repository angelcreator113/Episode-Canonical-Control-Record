/**
 * The Archetypes sub-tab counts the LalaVerse Feed profiles that carry each
 * archetype (wiring map fix-list item 26; Evoni's ruling, 2026-10-08: "Feed
 * also uses your 15"), from the Feed's composition, by the list the page
 * shows, Evoni's edits included. Profiles made before have none, counted
 * apart.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import SocialSystems from './SocialSystems';

const COMPOSITION = '/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse';
const UP_TO_DATE = { state: 'up_to_date', pending: 0, new: [], changed: [], retiring: [], unchanged: [], legacy: 0, fingerprint: 'fp' };

function serve({ composition, page = {} }) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === COMPOSITION) {
      if (composition instanceof Error) throw composition;
      return { data: composition };
    }
    if (url.startsWith('/api/v1/page-content/influencer_systems')) return { data: page };
    return { data: {} };
  });
}

const card = (name) => screen.getByText(name, { selector: '.ss-card-title' }).closest('li');
const renderPage = () => render(<MemoryRouter><SocialSystems /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/social-systems');
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.post).mockResolvedValue({ data: { data: UP_TO_DATE } });
});

describe('the Archetypes sub-tab counts the LalaVerse Feed', () => {
  test('each card counts the profiles that have it; those made before and names off the list are said apart', async () => {
    serve({ composition: { society_archetypes: { 'The Trendsetter': 3, 'The Educator': 1, 'The Old Name': 2 }, society_archetype_unset: 40 } });
    renderPage();
    await waitFor(() => expect(within(card('The Trendsetter')).getByTestId('ss-arch-count').textContent).toBe('3 in the Feed'));
    expect(within(card('The Educator')).getByTestId('ss-arch-count').textContent).toBe('1 in the Feed');
    expect(within(card('The Rebel')).getByTestId('ss-arch-count').textContent).toBe('0 in the Feed');
    const note = screen.getByTestId('ss-arch-feed').textContent;
    expect(note).toContain('Each card counts the LalaVerse Feed profiles that have it.');
    expect(note).toContain('40 profiles have none yet: made before the Feed used these. Regenerating a profile gives it one.');
    expect(note).toContain('2 profiles carry an archetype no longer in this list.');
    expect(api.get).toHaveBeenCalledWith(COMPOSITION);
  });

  test('Evoni\'s saved list is the one counted', async () => {
    serve({
      composition: { society_archetypes: { 'The Night Owl': 5, 'The Trendsetter': 3 }, society_archetype_unset: 0 },
      page: { ARCHETYPES: [{ num: '01', name: 'The Night Owl', icon: '🦉', content: 'Posts at 3am' }] },
    });
    renderPage();
    await waitFor(() => expect(within(card('The Night Owl')).getByTestId('ss-arch-count').textContent).toBe('5 in the Feed'));
    expect(screen.queryByText('The Trendsetter', { selector: '.ss-card-title' })).toBeNull();
    const note = screen.getByTestId('ss-arch-feed').textContent;
    expect(note).toContain('3 profiles carry an archetype no longer in this list.');
    expect(note).not.toContain('none yet');
  });

  test('while counting, and when the Feed cannot be read, the cards carry no count', async () => {
    let finish;
    vi.mocked(api.get).mockImplementation((url) => (url === COMPOSITION ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve({ data: {} })));
    const { unmount } = renderPage();
    expect(screen.getByTestId('ss-arch-feed').textContent).toBe('Counting the LalaVerse Feed…');
    expect(screen.queryByTestId('ss-arch-count')).toBeNull();
    finish({ data: { society_archetypes: {} } });
    await waitFor(() => expect(screen.getAllByTestId('ss-arch-count')).toHaveLength(15));
    unmount();

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    serve({ composition: Object.assign(new Error('down'), { response: { status: 500 } }) });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ss-arch-feed').textContent).toBe('The LalaVerse Feed could not be counted just now.'));
    expect(screen.queryByTestId('ss-arch-count')).toBeNull();
    expect(spy).toHaveBeenCalledWith('[Society] the Feed profiles could not be counted:', 500);
    spy.mockRestore();
  });
});
