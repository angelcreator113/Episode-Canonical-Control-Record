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
import EpisodeOverlaysTab from './EpisodeOverlaysTab';
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
    key: 'shopping_list_doc', label: 'Shopping list', status: 'approved', image_url: 'https://img/shop.png', asset_id: 'sl',
    beat: null, document: { type: 'shopping_list', status: 'approved', version: 2 },
    cost: { free: 'Drawn when the document is approved; costs nothing.' },
  },
  {
    key: 'career_plan_doc', label: 'Career plan', status: 'not_made', image_url: null, asset_id: null,
    beat: null, document: { type: 'career_plan', status: null, version: null },
    cost: { free: 'Drawn when the document is approved; costs nothing.' },
  },
];
const OVERLAYS = {
  episode_id: 'ep-1', show_id: 'sh-1', title: { text: 'Gala Night', approved: true }, pieces: PIECES, title_chip: { status: 'approved', piece: 'title_overlay' },
  event: { id: 'ev-1', show_id: 'sh-1', name: 'Velvet Gala' },
};

// The show's overlays (GET /ui-overlays/:showId): only ready production
// ones are listed in the library.
const SHOW_LIBRARY = [
  { id: 'show_title', name: 'Show Title', category: 'production', description: 'Opens every episode', generated: true, url: 'https://img/title.png', asset_id: 'st1' },
  { id: 'lower_third', name: 'Lower Third', category: 'production', generated: true, url: 'https://img/lower.png', asset_id: 'lt1' },
  { id: 'exit_button', name: 'Exit Button', category: 'production', generated: false, url: null, asset_id: null },
];
const SHOW_WIDE = [
  { id: 'MailPanel', name: 'Mail Panel', generated: true, is_episode_override: false, url: 'https://img/mail.png', asset_id: 'm1' },
  { id: 'HomeScreen', name: 'Home Screen', generated: true, is_episode_override: true, url: 'https://img/home-ep.png', asset_id: 'h1' },
  { id: 'Shop', name: 'Shop', generated: false, is_episode_override: false, url: null, asset_id: null },
  { id: 'InviteLetterOverlay', name: 'Invite', generated: true, is_episode_override: true, is_episode_invitation: true, url: 'x', asset_id: 'i1' },
];

function routeGet(url) {
  if (url === '/api/v1/episodes/ep-1/overlays') return ok(OVERLAYS);
  if (url.startsWith('/api/v1/ui-overlays/sh-1')) return ok([...SHOW_WIDE.map((o) => ({ ...o, category: 'phone' })), ...SHOW_LIBRARY]);
  if (url === '/api/v1/world/sh-1/events/ev-1/documents') return ok({ shopping_list: null, career_plan: null });
  if (url === '/api/v1/episodes/ep-1/title-card') {
    return ok({ title: 'Gala Night', approved: true, card: { asset_id: 'card', outdated: true, designed_for: 'Old Title', image_url: 'https://img/card.png' },
      offer: { offered: true, kind: 'redesign', requires_approval: false, estimate: EST(0.04) },
      overlay: null, overlay_offer: { offered: false } });
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

  test('lists every piece with its preview, status and cost, and no beat (kept off beats for now)', async () => {
    renderTab();
    const overlay = await screen.findByTestId('eot-piece-title_overlay');
    expect(within(overlay).getByRole('img', { name: 'Title overlay preview' })).toBeTruthy();
    expect(screen.getByTestId('eot-status-title_overlay').textContent).toBe('Approved');
    expect(screen.getByTestId('eot-status-framed_card').textContent).toBe('Outdated');
    expect(screen.getByTestId('eot-status-invitation').textContent).toBe('Approved');
    // The AI task-list overlay is retired (Evoni, 2026-10-07).
    expect(screen.queryByTestId('eot-piece-task_list')).toBeNull();
    expect(screen.queryByText(/Task-list overlay|Design task-list overlay/)).toBeNull();

    // The invitation is among the in-world documents (Evoni's mock, 2026-10-07).
    expect(within(screen.getByTestId('eot-docs')).getByTestId('eot-doc-invitation')).toBeTruthy();
    // Evoni, 2026-10-07: "none of the overlays should be beats for now".
    expect(screen.queryByText(/Beat \d/)).toBeNull();
    expect(screen.queryByTestId('eot-beat-invitation')).toBeNull();

    expect(screen.getByTestId('eot-cost-title_overlay').textContent).toBe('Decorative flourish — est. $0.04');
    expect(screen.getByTestId('eot-cost-invitation').textContent).toBe('Regenerate the invitation — est. $0.08');
    expect(screen.getByText('Lettering styles and the backing band cost nothing.')).toBeTruthy();
    expect(screen.getByText('Made for “Old Title”.')).toBeTruthy();
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

  // Evoni, 2026-10-07: the show's overlays are ready for every episode;
  // none is put on a beat for now.
  test('the show library: the ready show overlays, read-only, with a link to the show\'s Overlays', async () => {
    renderTab();
    const lib = await screen.findByTestId('eot-library');
    const title = await within(lib).findByTestId('eot-lib-show_title');
    expect(within(title).getByText('Opens every episode')).toBeTruthy();
    expect(within(lib).getByTestId('eot-lib-lower_third')).toBeTruthy();
    expect(within(lib).queryByTestId('eot-lib-exit_button')).toBeNull();
    expect(within(lib).queryByTestId('eot-lib-MailPanel')).toBeNull();
    expect(within(lib).queryByRole('combobox')).toBeNull();
    expect(within(lib).queryByRole('button')).toBeNull();
    expect(screen.getByTestId('eot-library-link').getAttribute('href')).toBe('/shows/sh-1/world?tab=production-overlays');
  });

  test('the in-world documents: the invitation first, then the event\'s documents; none without an event', async () => {
    renderTab();
    const docs = await screen.findByTestId('eot-docs');
    expect(await within(docs).findByTestId('evd-shopping_list')).toBeTruthy();
    expect(within(docs).getByTestId('evd-career_plan')).toBeTruthy();
    const cards = [...docs.querySelectorAll('article')].map((a) => a.getAttribute('data-testid'));
    expect(cards).toEqual(['eot-doc-invitation', 'evd-shopping_list', 'evd-career_plan']);
  });

  test('without an event: no documents, the invitation says so', async () => {
    vi.mocked(api.get).mockImplementation((url) => (url === '/api/v1/episodes/ep-1/overlays'
      ? ok({ ...OVERLAYS, event: null, pieces: PIECES.map((p) => (p.key === 'invitation' ? { ...p, event: null } : p)) })
      : routeGet(url)));
    renderTab();
    expect(await screen.findByTestId('eot-docs-none')).toBeTruthy();
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

// Evoni's Episode mock (2026-10-06): a preview with Add an overlay, then
// the episode's overlays (no beats for now, 2026-10-07).
describe('EpisodeOverlaysTab — the mock\'s preview and the episode\'s overlays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(routeGet);
  });

  test('a row per piece with its kind and action, no beat; the rows still needed are counted and dashed', async () => {
    renderTab();
    const card = await screen.findByTestId('eot-bybeat');
    expect(within(card).getByRole('heading', { name: "This episode's overlays" })).toBeTruthy();
    const rows = [...card.querySelectorAll('li')].map((li) => li.getAttribute('data-testid'));
    expect(rows).toEqual(['eot-row-title_overlay', 'eot-row-framed_card', 'eot-row-invitation', 'eot-row-shopping_list_doc', 'eot-row-career_plan_doc']);
    expect(within(card).queryByText(/Beat/)).toBeNull();
    const invite = screen.getByTestId('eot-row-invitation');
    expect(within(invite).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(screen.getByTestId('eot-row-framed_card')).getByRole('button', { name: 'Update' })).toBeTruthy();
    // The documents (Evoni, 2026-10-07): the approved shopping list, the career plan still to make.
    expect(within(screen.getByTestId('eot-row-shopping_list_doc')).getByText('Shopping list')).toBeTruthy();
    expect(within(screen.getByTestId('eot-row-shopping_list_doc')).getByRole('button', { name: 'Edit' })).toBeTruthy();
    const plan = screen.getByTestId('eot-row-career_plan_doc');
    expect(plan.className).toContain('is-needed');
    expect(within(plan).getByText('Career plan (not made yet)')).toBeTruthy();
    expect(within(plan).getByText('Document')).toBeTruthy();
    expect(within(plan).getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(screen.getByTestId('eot-still-needed').textContent).toBe('2 still needed');
  });

  test('the preview shows a made piece; a row picks what it shows', async () => {
    renderTab();
    const preview = await screen.findByTestId('eot-stage-preview');
    expect(within(preview).getByRole('img').getAttribute('alt')).toBe('Preview: Title overlay');
    fireEvent.click(within(screen.getByTestId('eot-row-invitation')).getByRole('button', { name: 'Edit' }));
    expect(within(preview).getByRole('img').getAttribute('alt')).toBe('Preview: Invitation');
    expect(screen.getByTestId('eot-stage-tag').textContent).toBe('Preview · Invitation');
    // A document row shows its drawn overlay.
    fireEvent.click(within(screen.getByTestId('eot-row-shopping_list_doc')).getByRole('button', { name: 'Edit' }));
    expect(within(preview).getByRole('img').getAttribute('alt')).toBe('Preview: Shopping list');
  });

  test('Add an overlay: from a document, from Lala\'s Feed, a notification or stat pop', async () => {
    renderTab();
    await screen.findByTestId('eot-stage-preview');
    expect(screen.getByRole('heading', { level: 2, name: 'Add an overlay' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /From a document/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /From Lala's Feed/ }).getAttribute('href')).toBe('/shows/sh-1/world?tab=feed');
    expect(screen.getByRole('link', { name: /Notification or stat pop/ }).getAttribute('href')).toBe('/shows/sh-1/world?tab=overlays-tab');
  });
});

