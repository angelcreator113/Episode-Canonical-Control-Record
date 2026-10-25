/**
 * The Event Package loads through one request (Task #54): the combined GET
 * /events/:eventId/package answers the event, the season context, the money
 * preview and the deal's deliverables, costs and documents, so the page and
 * its sections make none of those reads themselves on first load. A part
 * that failed shows its own "Failed to load …" while the rest render; a
 * combined GET that fails as a whole falls back to the reads one by one.
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
const PACKAGE_URL = `${EVENT_URL}/package`;
// The reads the combined GET replaces.
const REPLACED = [
  EVENT_URL,
  '/api/v1/world/show-1/season/event/ev-1',
  `${EVENT_URL}/money-preview`,
  `${EVENT_URL}/deliverables`,
  `${EVENT_URL}/costs`,
  `${EVENT_URL}/documents`,
];

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Studio Session', event_type: 'brand_deal', prestige: 6,
  deal_type: 'brand_partnership', deal_components: ['paid_for_content', 'partnership_base'],
  event_date: '2026-11-12', host_brand: 'Studio by Sable', updated_at: '2026-10-20T10:00:00.000Z',
  canon_consequences: { automation: {} },
};
const PAYLOAD = {
  event: EVENT, episodeLook: null, placeLocked: false, sourceProfile: null, startedFromProfile: null,
  sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null, termsLockedBy: null, termsReopen: null,
};
const CONTEXT = { in_slot: true, season_number: 1, label: 'S1 · E5', phase: { number: 1, title: 'Foundation' }, story_purposes: [{ text: 'Lala proves her eye.', primary: true }] };
const PREVIEW = { balance: 1900, warnings: [], lines: [{ key: 'fee', label: 'Content fee', signed: 600 }], projection: { projected_balance: 2500 } };
const DELIVERABLES = [{ id: 'd1', description: 'Live styling reel', deliverable_type: 'post', due_date: null, required: true, status: 'pending' }];
const COSTS = [{ id: 'c1', kind: 'extras', label: 'Valet', amount: 70, paid_by: 'lala' }];
const DOCS = { shopping_list: { type: 'shopping_list', status: 'draft', version: 1, source: 'draft', history: [], items: [{ slot: 'dress', label: 'Find a statement piece' }] }, offer_letter: null };

let pkg;
function packageBody(overrides = {}) {
  return {
    success: true, eventPayload: PAYLOAD, moneyPreview: PREVIEW, seasonContext: CONTEXT,
    deliverables: { deliverables: DELIVERABLES, locked: false }, costs: { costs: COSTS, drafted: {}, deal: true, locked: false },
    documents: DOCS, termsLock: { locked: false, episode: null, reopen: null }, readiness: null, ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

const getUrls = () => vi.mocked(api.get).mock.calls.map(([url]) => url);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  pkg = packageBody();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === PACKAGE_URL) return { data: pkg };
    if (url === EVENT_URL) return { data: { success: true, ...PAYLOAD } };
    if (url === `${EVENT_URL}/deliverables`) return { data: { success: true, deliverables: DELIVERABLES, locked: false } };
    return { data: { success: true } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { success: true, event: { ...EVENT, ...body } } }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Event Package: one combined GET', () => {
  test('first load reads the package once and none of the reads it replaces', async () => {
    renderPage();
    await screen.findByTestId('package-hero');
    // Each section shows what the package answered for it.
    await waitFor(() => expect(within(screen.getByTestId('terms-deliverables')).getByText('Live styling reel')).toBeTruthy());
    expect(within(screen.getByTestId('terms-costs')).getByText('Valet')).toBeTruthy();
    expect(within(screen.getByTestId('documents-section')).getByText(/Find a statement piece/)).toBeTruthy();
    expect(screen.getByTestId('season-context').textContent).toContain('S1 · E5');
    expect(screen.getByTestId('money-preview-balance').textContent).toBe('Lala has 1,900 coins.');

    expect(getUrls().filter((u) => u === PACKAGE_URL)).toHaveLength(1);
    for (const url of REPLACED) expect(api.get).not.toHaveBeenCalledWith(url);
  });

  test('a part that failed shows its own load failure and the rest render', async () => {
    pkg = packageBody({ deliverables: null, errors: { deliverables: 'relation "event_deliverables" does not exist' } });
    renderPage();
    await screen.findByTestId('package-hero');
    const deliverables = screen.getByTestId('terms-deliverables');
    await waitFor(() => expect(within(deliverables).getByText('Failed to load deliverables')).toBeTruthy());
    // Not read again on its own, and the other parts still show.
    expect(api.get).not.toHaveBeenCalledWith(`${EVENT_URL}/deliverables`);
    expect(within(screen.getByTestId('terms-costs')).getByText('Valet')).toBeTruthy();
    expect(within(screen.getByTestId('documents-section')).getByText(/Find a statement piece/)).toBeTruthy();
    expect(screen.getByTestId('season-context')).toBeTruthy();
    expect(screen.getByTestId('money-preview')).toBeTruthy();
  });

  test('a failed money preview part is the money warning, as a failed check was', async () => {
    pkg = packageBody({ moneyPreview: null, errors: { moneyPreview: 'ledger down' } });
    renderPage();
    await screen.findByTestId('package-hero');
    expect(api.get).not.toHaveBeenCalledWith(`${EVENT_URL}/money-preview`);
    expect(screen.queryByTestId('money-preview')).toBeNull();
    expect(within(screen.getByTestId('documents-section')).getByText(/Find a statement piece/)).toBeTruthy();
  });

  test('a save reloads through the package again, not the single-event read', async () => {
    renderPage();
    await screen.findByTestId('package-hero');
    fireEvent.click(screen.getByTestId('stakes-edit'));
    fireEvent.change(screen.getByTestId('stakes-input-prestige'), { target: { value: '8' } });
    pkg = packageBody({ eventPayload: { ...PAYLOAD, event: { ...EVENT, prestige: 8, updated_at: '2026-10-20T11:00:00.000Z' } } });
    fireEvent.click(screen.getByTestId('stakes-save'));
    await waitFor(() => expect(getUrls().filter((u) => u === PACKAGE_URL)).toHaveLength(2));
    expect(api.get).not.toHaveBeenCalledWith(EVENT_URL);
    // The reloaded Terms start from the new package answer too.
    await waitFor(() => expect(within(screen.getByTestId('terms-deliverables')).getByText('Live styling reel')).toBeTruthy());
    expect(api.get).not.toHaveBeenCalledWith(`${EVENT_URL}/deliverables`);
  });

  test('a combined GET that fails as a whole falls back to the reads one by one', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === PACKAGE_URL) throw Object.assign(new Error('boom'), { response: { status: 500, data: { success: false } } });
      if (url === EVENT_URL) return { data: { success: true, ...PAYLOAD } };
      if (url === `${EVENT_URL}/deliverables`) return { data: { success: true, deliverables: DELIVERABLES, locked: false } };
      if (url === `${EVENT_URL}/money-preview`) return { data: { success: true, data: PREVIEW } };
      return { data: { success: true } };
    });
    renderPage();
    await screen.findByTestId('package-hero');
    await waitFor(() => expect(within(screen.getByTestId('terms-deliverables')).getByText('Live styling reel')).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith(EVENT_URL);
    expect(api.get).toHaveBeenCalledWith(`${EVENT_URL}/deliverables`);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`${EVENT_URL}/money-preview`));
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/event/ev-1');
  });
});
