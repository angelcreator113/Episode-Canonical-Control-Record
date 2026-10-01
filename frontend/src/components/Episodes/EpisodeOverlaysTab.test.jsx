/**
 * Production → Overlays and the banner's title chip (P15, Evoni 2026-09-30).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeOverlaysTab, { beatText, showWideOverlays } from './EpisodeOverlaysTab';
import EpisodeTitleChip from './EpisodeTitleChip';

const EST = (usd) => ({ usd, priced: true, unit: 'image', units: 1, model: 'm' });
const ok = (data) => Promise.resolve({ data: { success: true, data } });

const PIECES = [
  {
    key: 'title_overlay', label: 'Title overlay', status: 'approved', image_url: 'https://img/ov.png', asset_id: 'ov',
    made_for: 'Gala Night', beat: null, needs_title_approval: false,
    cost: { free: 'Lettering styles and the backing band cost nothing.', paid: { action: 'Decorative flourish', estimate: EST(0.04) } },
  },
  {
    key: 'framed_card', label: 'Full-screen framed card', status: 'outdated', image_url: 'https://img/card.png', asset_id: 'card',
    made_for: 'Old Title', beat: null, needs_title_approval: false,
    cost: { paid: { action: 'Redesign the card', estimate: EST(0.04) } },
  },
  {
    key: 'invitation', label: 'Invitation', status: 'approved', image_url: 'https://img/inv.png', asset_id: 'inv',
    beat: { number: 5, name: 'Reveal', anchor: 'beat' }, expected_beat: { number: 5, name: 'Reveal' },
    event: { id: 'ev-1', show_id: 'sh-1', name: 'Velvet Gala' },
    cost: { paid: { action: 'Regenerate the invitation', estimate: EST(0.08) } },
  },
  {
    key: 'task_list', label: 'Task-list overlay', status: 'not_made', image_url: null, asset_id: null,
    beat: null, expected_beat: { number: 9, name: 'Reminder/Deadline' }, task_count: 3, list_approved: false,
    cost: { paid: { action: 'Design the overlay', estimate: EST(0.08) } },
  },
];
const OVERLAYS = { episode_id: 'ep-1', show_id: 'sh-1', title: { text: 'Gala Night', approved: true }, pieces: PIECES, title_chip: { status: 'approved', piece: 'title_overlay' } };

const SHOW_WIDE = [
  { id: 'MailPanel', name: 'Mail Panel', generated: true, is_episode_override: false, url: 'https://img/mail.png', asset_id: 'm1' },
  { id: 'HomeScreen', name: 'Home Screen', generated: true, is_episode_override: true, url: 'https://img/home-ep.png', asset_id: 'h1' },
  { id: 'Shop', name: 'Shop', generated: false, is_episode_override: false, url: null, asset_id: null },
  { id: 'InviteLetterOverlay', name: 'Invite', generated: true, is_episode_override: true, is_episode_invitation: true, url: 'x', asset_id: 'i1' },
];

function routeGet(url) {
  if (url === '/api/v1/episodes/ep-1/overlays') return ok(OVERLAYS);
  if (url.startsWith('/api/v1/ui-overlays/sh-1')) return ok(SHOW_WIDE);
  if (url === '/api/v1/episodes/ep-1/title-card') {
    return ok({ title: 'Gala Night', approved: true, card: { asset_id: 'card', outdated: true, designed_for: 'Old Title', image_url: 'https://img/card.png' },
      offer: { offered: true, kind: 'redesign', requires_approval: false, estimate: EST(0.04) },
      overlay: null, overlay_offer: { offered: false } });
  }
  if (url === '/api/v1/episodes/ep-1/task-list-overlay') {
    return ok({ exists: true, task_count: 3, hash: 'h', approved: false, overlay: null, offer: { offered: false } });
  }
  return Promise.reject(new Error(`unexpected GET ${url}`));
}

const renderTab = (props = {}) => render(
  <MemoryRouter>
    <EpisodeOverlaysTab episode={{ id: 'ep-1', title: 'Gala Night' }} showId="sh-1" {...props} />
  </MemoryRouter>,
);

describe('EpisodeOverlaysTab (P15)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockImplementation(routeGet);
  });

  test('lists every piece with its preview, status, placed beat and cost', async () => {
    renderTab();
    const overlay = await screen.findByTestId('eot-piece-title_overlay');
    expect(within(overlay).getByRole('img', { name: 'Title overlay preview' })).toBeTruthy();
    expect(screen.getByTestId('eot-status-title_overlay').textContent).toBe('Approved');
    expect(screen.getByTestId('eot-status-framed_card').textContent).toBe('Outdated');
    expect(screen.getByTestId('eot-status-invitation').textContent).toBe('Approved');
    expect(screen.getByTestId('eot-status-task_list').textContent).toBe('Not made');

    expect(screen.getByTestId('eot-beat-invitation').textContent).toBe('Placed on Beat 5: Reveal');
    expect(screen.getByTestId('eot-beat-task_list').textContent).toBe('Not placed (goes on Beat 9: Reminder/Deadline)');
    expect(screen.getByTestId('eot-beat-title_overlay').textContent).toBe('Not placed');

    expect(screen.getByTestId('eot-cost-title_overlay').textContent).toBe('Decorative flourish — est. $0.04');
    expect(screen.getByTestId('eot-cost-invitation').textContent).toBe('Regenerate the invitation — est. $0.08');
    expect(screen.getByText('Lettering styles and the backing band cost nothing.')).toBeTruthy();
    expect(screen.getByText('Made for “Old Title”.')).toBeTruthy();

    // The task list has no preview yet.
    expect(within(screen.getByTestId('eot-piece-task_list')).getByText('No preview')).toBeTruthy();
  });

  test('actions: the title panel (with costs) and the invitation\'s Event Package link', async () => {
    renderTab();
    await screen.findByTestId('eot-piece-title_overlay');
    // The title panel's paid action, with its cost; the card image is not repeated.
    expect(await screen.findByRole('button', { name: /Redesign title card \(est\. \$0\.04\)/ })).toBeTruthy();
    expect(screen.queryByTestId('etc-thumb')).toBeNull();
    const link = screen.getByTestId('eot-invitation-link');
    expect(link.getAttribute('href')).toBe('/shows/sh-1/events/ev-1');
    expect(link.textContent).toMatch(/Change it in the Event Package \(Velvet Gala\)/);
  });

  test('show-wide overlays: read-only, only the show\'s own, with a Phone Hub link', async () => {
    renderTab();
    const items = await screen.findAllByTestId('eot-show-wide-item');
    expect(items.map((li) => li.textContent)).toEqual(['Mail Panel']);
    expect(within(screen.getByTestId('eot-show-wide')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('eot-phone-hub-link').getAttribute('href')).toBe('/shows/sh-1/world?tab=overlays-tab');
  });

  test('an action in a piece\'s panel reloads the tab and tells the page', async () => {
    const onChanged = vi.fn();
    vi.mocked(api.post).mockReturnValue(ok({ state: null }));
    renderTab({ onChanged });
    fireEvent.click(await screen.findByRole('button', { name: /Redesign title card/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const calls = vi.mocked(api.get).mock.calls.filter(([u]) => u === '/api/v1/episodes/ep-1/overlays');
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test('helpers', () => {
    expect(beatText(null)).toBeNull();
    expect(beatText({ number: 5, name: 'Reveal' })).toBe('Beat 5: Reveal');
    expect(beatText({ number: 9 })).toBe('Beat 9');
    expect(showWideOverlays(SHOW_WIDE).map((o) => o.id)).toEqual(['MailPanel']);
  });
});

describe('EpisodeTitleChip (P15)', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); });

  test('shows the title status and opens the tab', async () => {
    vi.mocked(api.get).mockReturnValue(ok({ ...OVERLAYS, title_chip: { status: 'outdated', piece: 'title_overlay' } }));
    const onOpen = vi.fn();
    render(<EpisodeTitleChip episodeId="ep-1" title="Gala Night" onOpen={onOpen} />);
    const chip = await screen.findByTestId('ed-title-chip');
    expect(chip.textContent).toBe('Title · Outdated');
    expect(chip.className).toContain('ed-title-chip-outdated');
    fireEvent.click(chip);
    expect(onOpen).toHaveBeenCalled();
  });

  test('reloads when the tab changes a piece', async () => {
    vi.mocked(api.get).mockReturnValue(ok(OVERLAYS));
    const { rerender } = render(<EpisodeTitleChip episodeId="ep-1" title="Gala Night" version={0} onOpen={() => {}} />);
    expect((await screen.findByTestId('ed-title-chip')).textContent).toBe('Title · Approved');
    vi.mocked(api.get).mockReturnValue(ok({ ...OVERLAYS, title_chip: { status: 'not_made', piece: 'title_overlay' } }));
    rerender(<EpisodeTitleChip episodeId="ep-1" title="Gala Night" version={1} onOpen={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('ed-title-chip').textContent).toBe('Title · Not made'));
  });
});
