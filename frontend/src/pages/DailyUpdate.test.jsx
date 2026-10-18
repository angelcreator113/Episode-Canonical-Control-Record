/**
 * The daily update page (route /today; Evoni, 2026-10-18, automation step 2):
 * since yesterday, waiting for her (decided through each item's own
 * endpoint, one at a time or all at once, with Undo where the feature has
 * one), coming up (move or hold a scheduled post) and today's cost.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import DailyUpdate from './DailyUpdate';

const update = () => ({
  success: true,
  since: '2026-10-17T09:00:00.000Z',
  now: '2026-10-18T09:00:00.000Z',
  since_yesterday: {
    went_live: { total: 2, auto: 1, items: [{ id: 'p-live', handle: '@maren', text: 'Studio day.', auto: true }] },
    scheduled: { total: 1, items: [] },
    new_characters: { total: 1, items: [{ id: 'c-new', name: 'Renata Voss' }] },
    automatic: { facts: [{ id: 'f1', character_id: 'c-1', name: 'Maren', fact: 'occupation', from: null, to: 'Designer', reason: 'Suggested' }], voices_built: [], findings_resolved: { fixed: 3 } },
  },
  waiting: [
    { key: 'drafts', label: 'Pulse drafts', total: 1, link: '/admin?tab=pulse&sub=review', items: [{ id: 'd-1', handle: '@sable', text: 'New collection.', show: 'Styling Adventures' }] },
    { key: 'voices', label: 'Voices', total: 2, link: '/admin?tab=pulse&sub=voices', items: [{ id: 'v-1', character_id: 'c-1', name: 'Maren' }, { id: 'v-2', character_id: 'c-2', name: 'Sable' }] },
    { key: 'secrets', label: 'Secrets', total: 1, link: null, items: [{ id: 's-1', character_id: 'c-1', name: 'Maren', text: 'She rehearses.' }] },
    { key: 'deals', label: 'Brand deals', total: 1, link: null, items: [{ id: 'o-1', show_id: 'show-1', name: 'Velour cover', brand: 'Velour', amount: 1200 }] },
    { key: 'findings', label: 'Findings to fix', total: 12, link: '/character-registry', read_only: true, items: [{ id: 'c-3', character_id: 'c-3', name: 'Sable', open: 12 }] },
  ],
  coming_up: {
    until: '2026-10-21T09:00:00.000Z',
    posts: [{ id: 'p-sched', handle: '@maren', text: 'Fitting tomorrow.', release_at: '2026-10-19T15:00:00.000Z' }],
    episodes: [{ id: 'e-1', number: 4, title: 'The Gala', air_date: '2026-10-20T00:00:00.000Z' }],
    events: [{ id: 'ev-1', name: 'Velour gala', episode_number: 4 }],
    deals: [{ id: 'o-2', brand: 'Aura', dates: [{ kind: 'Shoot', date: '2026-10-19' }] }],
    slots: [{ profile_id: 7, character_id: 'c-1', name: 'Maren', at: '2026-10-19T09:00:00.000Z', schedule: 'Mon–Fri mornings' }],
  },
  cost: { spent_usd: 4.5, budget_usd: 50, left_usd: 45.5, share: 0.09, features: [{ feature: 'pulse-drafter', usd: 3.2, calls: 12 }] },
});

const renderPage = () => render(<MemoryRouter><DailyUpdate /></MemoryRouter>);

describe('DailyUpdate', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockResolvedValue({ data: update() });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
  });

  test('the four sections, in order, from one read of the last day', async () => {
    renderPage();
    await screen.findByTestId('du-since');
    expect(api.get.mock.calls[0][0]).toMatch(/^\/api\/v1\/daily-update\?since=/);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toContain('Since yesterday');
    expect(headings[1]).toContain('Waiting for you');
    expect(headings[2]).toContain('Coming up');
    expect(headings[3]).toContain('Cost today');
    const since = screen.getByTestId('du-since').textContent;
    expect(since).toContain('2 went live');
    expect(since).toContain('1 on their own');
    expect(since).toContain('3 findings resolved');
    expect(screen.getByText(/5 waiting for you/)).toBeTruthy();
    expect(screen.getByTestId('du-cost').textContent).toContain('$4.50 of $50.00');
  });

  test('a voice is approved through its own endpoint, and Undo withdraws it', async () => {
    renderPage();
    const voices = await screen.findByTestId('du-waiting-voices');
    fireEvent.click(within(screen.getByTestId('du-item-v-1')).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/v-1/approve'));
    expect((await within(voices).findByTestId('du-item-v-1')).textContent).toContain('Approved');
    fireEvent.click(within(screen.getByTestId('du-item-v-1')).getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/v-1/unapprove'));
    expect(await within(screen.getByTestId('du-item-v-1')).findByRole('button', { name: 'Approve' })).toBeTruthy();
  });

  test('Approve all goes item by item and says how many were done; a failure stays on its item', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { success: true } })
      .mockRejectedValueOnce({ response: { data: { error: 'Voice not found' } } });
    renderPage();
    const voices = await screen.findByTestId('du-waiting-voices');
    fireEvent.click(within(voices).getByRole('button', { name: /Approve all 2/ }));
    expect(await within(voices).findByText('1 of 2 done. The rest say why.')).toBeTruthy();
    expect(api.post.mock.calls.map((c) => c[0])).toEqual(['/api/v1/pulse-voices/v-1/approve', '/api/v1/pulse-voices/v-2/approve']);
    expect(within(screen.getByTestId('du-item-v-2')).getByRole('alert').textContent).toBe('Voice not found');
  });

  test('drafts publish or delete (Undo restores); secrets keep or discard; deals consider or decline', async () => {
    renderPage();
    await screen.findByTestId('du-waiting-drafts');
    fireEvent.click(within(screen.getByTestId('du-item-d-1')).getByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/feed-posts/d-1'));
    fireEvent.click(await within(screen.getByTestId('du-item-d-1')).findByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/d-1/restore'));
    fireEvent.click(await within(screen.getByTestId('du-item-d-1')).findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d-1', { status: 'live' }));

    fireEvent.click(within(screen.getByTestId('du-item-s-1')).getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/secrets/s-1', { status: 'confirmed' }));

    fireEvent.click(within(screen.getByTestId('du-item-o-1')).getByRole('button', { name: /Decline/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/opportunities/show-1/o-1/advance', { to_status: 'declined' }));
  });

  test('findings are read here and fixed on the character', async () => {
    renderPage();
    const findings = await screen.findByTestId('du-waiting-findings');
    expect(within(findings).queryByRole('button')).toBeNull();
    expect(within(findings).getByRole('link', { name: 'Fix them' }).getAttribute('href')).toBe('/character/c-3');
    expect(findings.textContent).toContain('12 open findings');
  });

  test('a scheduled post can be held; a time that breaks the story order asks first', async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 409, data: { error: 'This time breaks the story order.', problems: ['It would come before the episode airs.'] } } });
    renderPage();
    const post = await screen.findByTestId('du-post-p-sched');
    fireEvent.click(within(post).getByRole('button', { name: /Move/ }));
    fireEvent.change(within(post).getByLabelText('New time'), { target: { value: '2026-10-19T08:00' } });
    fireEvent.click(within(post).getByRole('button', { name: 'Move' }));
    expect(await within(post).findByText('It would come before the episode airs.')).toBeTruthy();
    fireEvent.click(within(post).getByRole('button', { name: 'Move anyway' }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/api/v1/feed-posts/p-sched/release-time', expect.objectContaining({ mode: 'schedule', anyway: true })));
    fireEvent.click(await within(post).findByRole('button', { name: /Hold/ }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/api/v1/feed-posts/p-sched/release-time', expect.objectContaining({ mode: 'hold' })));
    expect(await within(post).findByText(/Held until you release it/)).toBeTruthy();
  });

  test('coming up lists the episode airing, its event and a deal date', async () => {
    renderPage();
    const coming = (await screen.findByTestId('du-coming')).textContent;
    expect(coming).toContain('Episode 4');
    expect(coming).toContain('Velour gala');
    expect(coming).toContain('Aura: Shoot');
  });

  test('coming up shows each posting schedule\'s next open time', async () => {
    renderPage();
    const slots = (await screen.findByTestId('du-slots')).textContent;
    expect(slots).toContain('Maren');
    expect(slots).toContain('Mon–Fri mornings');
  });

  test('when the update cannot load it says so', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { data: { error: 'Forbidden' } } });
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toBe('Forbidden');
  });
});
