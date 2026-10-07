/**
 * Episode Setup, step 1 (Evoni, 2026-10-03): "make every decision you
 * already made become memory for the next step". The Event Package says,
 * at the top, how much is ready and what comes next, and Continue opens
 * it; the story stakes are edited here, so their warning can be cleared
 * without the old editor; and the Money card shows Lala's balance, the
 * planned lines and the projection, not only warnings.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const PREVIEW_URL = '/api/v1/world/show-1/events/ev-1/money-preview';

// Every gate set; warnings (scene set, outfit, time, dress code, featured,
// stakes, money) open unless a test fills them.
const GATED_EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  event_type: 'invite',
  prestige: 6,
  category: 'arts_entertainment',
  format: 'gala',
  event_date: '2026-11-09',
  host_brand: 'Velour',
  venue_location_id: 'loc-1',
  invitation_asset_id: 'asset-inv-1',
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: {} },
};

const COMPLETE_EVENT = {
  ...GATED_EVENT,
  scene_set_id: 'set-1',
  outfit_set_id: 'outfit-1',
  event_time: '19:00',
  dress_code: 'Black tie',
  narrative_stakes: 'Her first red carpet',
  cost_coins: 250,
  canon_consequences: { automation: { guest_profiles: [{ id: 'g1', featured: true }] } },
};

let stored;
let preview;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  preview = null;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event: stored, sourceProfile: null, startedFromProfile: null,
        sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
      } };
    }
    if (url === PREVIEW_URL) return { data: { success: true, data: preview } };
    return { data: { success: true, deliverables: [], locked: false } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    stored = { ...stored, ...body, updated_at: '2026-09-25T10:05:00.000Z' };
    return { data: { success: true, event: stored } };
  });
});

describe('Continue → at the top of the Package', () => {
  test('a missing gate is named first, with how much is ready', async () => {
    stored = { ...GATED_EVENT, venue_location_id: null };
    renderPage();
    const bar = await screen.findByTestId('package-next');
    expect(bar.getAttribute('data-kind')).toBe('gate');
    expect(bar.textContent).toMatch(/Needed to start: Place: venue/);
    expect(within(bar).getByTestId('package-next-count').textContent).toMatch(/^\d+ of \d+ ready$/);
  });

  test('with the gates met, Continue opens the next warning: here, the story stakes', async () => {
    stored = { ...COMPLETE_EVENT, narrative_stakes: null };
    renderPage();
    const bar = await screen.findByTestId('package-next');
    expect(bar.getAttribute('data-kind')).toBe('warning');
    expect(bar.textContent).toMatch(/Recommended: Stakes: story stakes/);
    fireEvent.click(within(bar).getByTestId('package-continue'));
    expect(await screen.findByRole('dialog', { name: 'Edit stakes' })).toBeTruthy();
  });

  test('a complete Package offers Start Episode from the top', async () => {
    stored = { ...COMPLETE_EVENT };
    renderPage();
    const bar = await screen.findByTestId('package-next');
    expect(bar.getAttribute('data-kind')).toBe('ready');
    expect(within(bar).getByTestId('start-episode')).toBeTruthy();
    expect(within(bar).queryByTestId('package-continue')).toBeNull();
  });

  // Evoni's review, item 8: one primary action, in one place.
  test('while a gate is missing, Continue is the only action: no Start Episode anywhere', async () => {
    stored = { ...GATED_EVENT, venue_location_id: null };
    renderPage();
    const bar = await screen.findByTestId('package-next');
    expect(within(bar).getByTestId('package-continue').className).toContain('epp-btn-primary');
    expect(screen.queryByTestId('start-episode')).toBeNull();
  });

  test('with the gates met, Start Episode is the one primary; an open recommendation is a quiet Review', async () => {
    stored = { ...COMPLETE_EVENT, narrative_stakes: null };
    renderPage();
    const bar = await screen.findByTestId('package-next');
    expect(within(bar).getByTestId('start-episode').className).toContain('epp-btn-primary');
    expect(within(bar).getByTestId('package-continue').className).not.toContain('epp-btn-primary');
    expect(screen.getAllByTestId('start-episode')).toHaveLength(1);
  });

  // Item 4: the foot of the page lists what is missing in the strip tiles' own words.
  test('the foot lists each blocking section exactly as its strip tile reads, linking to it', async () => {
    stored = { ...GATED_EVENT, venue_location_id: null };
    renderPage();
    const foot = await screen.findByTestId('start-blocked');
    const tile = screen.getByTestId('strip-place');
    const link = within(foot).getByTestId('start-blocked-place');
    const [label, text] = [tile.querySelector('strong').textContent, tile.querySelector('span').textContent];
    expect(link.textContent).toBe(text === label ? label : `${label}: ${text}`);
    expect(link.getAttribute('href')).toBe(tile.getAttribute('href'));
    const blockingTiles = [...screen.getByTestId('readiness-strip').querySelectorAll('.epp-strip-tile[data-state="blocking"]')];
    expect(foot.querySelectorAll('a')).toHaveLength(blockingTiles.length);
  });

  test('a ready Package has no missing list at the foot, only the way back up', async () => {
    stored = { ...COMPLETE_EVENT };
    renderPage();
    await screen.findByTestId('package-next');
    expect(screen.queryByTestId('start-blocked')).toBeNull();
    expect(screen.getByTestId('package-foot-top').getAttribute('href')).toBe('#epp-readiness');
  });

  test('a used event shows no next step', async () => {
    stored = { ...COMPLETE_EVENT, used_in_episode_id: 'ep-1' };
    renderPage();
    await screen.findByTestId('terms-locked-banner');
    expect(screen.queryByTestId('package-next')).toBeNull();
  });
});

describe('story stakes are edited in the Package', () => {
  test('writing the stakes saves them and clears the warning', async () => {
    stored = { ...COMPLETE_EVENT, narrative_stakes: null };
    renderPage();
    fireEvent.click(await screen.findByTestId('stakes-edit'));
    fireEvent.change(screen.getByTestId('stakes-input-narrative_stakes'), { target: { value: '  Her first seat at the table.  ' } });
    fireEvent.change(screen.getByTestId('stakes-input-fail_consequence'), { target: { value: 'Velour never calls again.' } });
    fireEvent.click(screen.getByTestId('stakes-save'));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe(EVENT_URL);
    expect(body).toMatchObject({ narrative_stakes: 'Her first seat at the table.', fail_consequence: 'Velour never calls again.' });
    expect(body).not.toHaveProperty('cost_coins');

    await waitFor(() => expect(screen.getByTestId('package-next').getAttribute('data-kind')).toBe('ready'));
    expect(screen.getByTestId('stakes-summary').textContent).toMatch(/Her first seat at the table\./);
  });
});

describe('the Money card shows the numbers', () => {
  test("Lala's balance, the planned lines and the projection, with no warning", async () => {
    stored = { ...COMPLETE_EVENT };
    preview = {
      balance: 1200,
      lines: [
        { key: 'attendance:ev-1', label: 'Attendance', kind: 'expense', amount: 250, signed: -250 },
        { key: 'covered:ev-1', label: 'Travel', kind: 'expense', amount: 80, signed: -80, covered: true },
        { key: 'bonus:ev-1', label: 'Bonus if SLAY', kind: 'income', amount: 100, signed: 100, conditional: true },
      ],
      projection: { projected_balance: 950, conditional: [{ tier: 'slay', amount: 100, label: 'Bonus if SLAY' }] },
      warnings: [],
    };
    renderPage();
    const money = await screen.findByTestId('money-preview');
    expect(within(money).getByTestId('money-preview-balance').textContent).toBe('Lala has 1,200 coins.');
    expect(within(money).getByTestId('money-preview-line-attendance:ev-1').textContent).toMatch(/Attendance.*−250/);
    // Covered and conditional lines are not counted in the list.
    expect(within(money).queryByTestId('money-preview-line-covered:ev-1')).toBeNull();
    expect(within(money).queryByTestId('money-preview-line-bonus:ev-1')).toBeNull();
    expect(within(money).getByTestId('money-preview-after').textContent).toMatch(/950 coins/);
    expect(money.textContent).toMatch(/Plus up to 100 if she earns it \(Bonus if SLAY\)/);
    expect(screen.queryByTestId('money-warnings')).toBeNull();
  });
});
