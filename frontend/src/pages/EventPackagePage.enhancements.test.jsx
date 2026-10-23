/**
 * Event Package enhancements (Evoni, 2026-10-23: "I want them all and show
 * me first"): one sticky readiness bar with Lala's balance; finished
 * sections folded to one line, remembered per event; Basics edited in their
 * rows; Undo on the toast for the page's one-tap changes; keyboard
 * shortcuts; the deal's deliverable and cost prices holding the gate; and
 * hasOutfit passed to the look recommendations.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

// The Terms section reports its deliverable and cost rows to the page
// (onPriceInputsChange); stood in for here so the test sets what it reports.
let reportedPrices = null;
vi.mock('../components/EventPackage/EventTermsSection', () => ({
  default: function TermsStub({ onPriceInputsChange }) {
    useEffect(() => { if (reportedPrices) onPriceInputsChange?.(reportedPrices); }, [onPriceInputsChange]);
    return <div data-testid="terms-stub" />;
  },
}));
const lookProps = [];
vi.mock('../components/EventPackage/EventLookRecommendations', () => ({
  default: function LooksStub(props) { lookProps.push(props); return <div data-testid="looks-stub" />; },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const PREVIEW_URL = '/api/v1/world/show-1/events/ev-1/money-preview';

const COMPLETE_EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6,
  category: 'arts_entertainment', format: 'gala', event_date: '2026-11-09', event_time: '19:00',
  host_brand: 'Velour', venue_location_id: 'loc-1', invitation_asset_id: 'asset-inv-1',
  scene_set_id: 'set-1', outfit_set_id: 'outfit-1', dress_code: 'Black tie',
  narrative_stakes: 'Her first red carpet', cost_coins: 250, description: 'A luxury night.', updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: { guest_profiles: [
    { profile_id: 'g1', display_name: 'Marisol', featured: true, story_role: 'rival' },
    { profile_id: 'g2', display_name: 'Dree', featured: false },
  ] } },
};
// No category, format, time or dress code: The Event is still to do.
const OPEN_EVENT = { ...COMPLETE_EVENT, category: null, format: null, event_time: null, dress_code: null };

let stored;
let preview;
let previewGet;
let extra; // extra payload keys (sourceProfile, startedFromProfile)

function renderPage(entry = '/shows/show-1/events/ev-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  stored = { ...COMPLETE_EVENT };
  preview = { balance: 1240, lines: [], projection: { projected_balance: 980, conditional: [] }, warnings: [] };
  previewGet = null;
  reportedPrices = null;
  lookProps.length = 0;
  extra = {};
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event: stored, sourceProfile: null, startedFromProfile: null,
        sceneSet: stored.scene_set_id ? { id: stored.scene_set_id, name: 'Glasshouse Hall' } : null,
        venueLocation: null, invitationAsset: null, usedInEpisode: null, ...extra,
      } };
    }
    if (url === PREVIEW_URL) return previewGet ? previewGet() : { data: { success: true, data: preview } };
    return { data: { success: true, deliverables: [], locked: false } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    const merged = { ...stored, ...body, updated_at: new Date().toISOString() };
    if (body.canon_consequences) {
      merged.canon_consequences = {
        ...(stored.canon_consequences || {}), ...body.canon_consequences,
        automation: { ...(stored.canon_consequences?.automation || {}), ...(body.canon_consequences.automation || {}) },
      };
    }
    stored = merged;
    return { data: { success: true, event: stored } };
  });
});

afterEach(() => { vi.useRealTimers(); });

describe('one sticky readiness bar', () => {
  test('N of M ready opens the list of sections; a section link opens and lands on its section', async () => {
    stored = { ...COMPLETE_EVENT, venue_location_id: null };
    renderPage();
    const bar = await screen.findByTestId('readiness-strip');
    const count = within(bar).getByTestId('package-next-count');
    expect(count.textContent).toMatch(/^\d+ of \d+ ready$/);
    expect(count.getAttribute('aria-controls')).toBe('epp-bar-panel');
    expect(screen.getByTestId('readiness-panel').hidden).toBe(true);
    fireEvent.click(count);
    expect(screen.getByTestId('readiness-panel').hidden).toBe(false);

    // Lala's look is complete, so folded; its link in the list opens it.
    expect(screen.getByTestId('fold-look').getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByTestId('strip-look'));
    expect(screen.getByTestId('fold-look').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('readiness-panel').hidden).toBe(true);
  });

  test('Escape in the open list closes it and returns to the count', async () => {
    renderPage();
    const count = await screen.findByTestId('package-next-count');
    fireEvent.click(count);
    const link = screen.getByTestId('strip-place');
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(screen.getByTestId('readiness-panel').hidden).toBe(true);
    expect(document.activeElement).toBe(count);
  });

  test('no footer action bar: Start Episode is only in the bar', async () => {
    renderPage();
    await screen.findByTestId('start-episode');
    expect(screen.getAllByTestId('start-episode')).toHaveLength(1);
    expect(within(screen.getByTestId('package-next')).getByTestId('start-episode')).toBeTruthy();
    expect(screen.queryByTestId('package-foot')).toBeNull();
  });
});

describe("Lala's balance chip in the bar", () => {
  test('the balance, and after the episode when projected', async () => {
    renderPage();
    const chip = await screen.findByTestId('balance-chip');
    await waitFor(() => expect(chip.textContent.trim()).toBe('Lala: 1,240 coins · after: 980'));
    expect(chip.getAttribute('data-tone')).toBe('ok');
  });

  test('amber when a money warning exists', async () => {
    preview = { ...preview, warnings: [{ code: 'PROJECTED_BELOW_ZERO', message: 'Below zero.' }] };
    renderPage();
    await waitFor(() => expect(screen.getByTestId('balance-chip').getAttribute('data-tone')).toBe('warn'));
  });

  test('checking… while loading, couldn’t check when the check fails', async () => {
    let fail;
    previewGet = () => new Promise((_, reject) => { fail = () => reject(new Error('down')); });
    renderPage();
    const chip = await screen.findByTestId('balance-chip');
    expect(chip.textContent.trim()).toBe('Lala: checking…');
    expect(screen.getByTestId('start-episode').textContent).toContain('Checking money');
    await act(async () => { fail(); });
    await waitFor(() => expect(screen.getByTestId('balance-chip').textContent.trim()).toBe('Lala: couldn’t check'));
  });
});

describe('finished sections fold to one line', () => {
  test('a complete section starts folded with its summary; Edit opens it; one still to do stays open', async () => {
    stored = { ...OPEN_EVENT };
    renderPage();
    const people = await screen.findByTestId('fold-people');
    expect(people.getAttribute('aria-expanded')).toBe('false');
    expect(people.getAttribute('aria-label')).toBe('Edit People');
    expect(screen.getByTestId('fold-summary-people').textContent).toMatch(/Velour.*1 featured/);
    expect(document.getElementById('epp-body-people').hidden).toBe(true);
    // The Event still has gates to fill: open.
    expect(screen.getByTestId('fold-identity').getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('fold-summary-identity')).toBeNull();

    fireEvent.click(people);
    expect(document.getElementById('epp-body-people').hidden).toBe(false);
    expect(screen.getByTestId('fold-people').getAttribute('aria-label')).toBe('Collapse People');
  });

  test('open/closed is remembered per event', async () => {
    const first = renderPage();
    fireEvent.click(await screen.findByTestId('fold-stakes'));
    expect(JSON.parse(window.localStorage.getItem('epp-sections:ev-1'))).toEqual({ stakes: true });
    first.unmount();
    renderPage();
    expect((await screen.findByTestId('fold-stakes')).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('fold-place').getAttribute('aria-expanded')).toBe('false');
  });

  test('storage that throws still renders with the defaults', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      renderPage();
      expect((await screen.findByTestId('fold-stakes')).getAttribute('aria-expanded')).toBe('false');
      expect(err).toHaveBeenCalledWith('[EventPackage] section folds read failed:', expect.any(Error));
    } finally { spy.mockRestore(); err.mockRestore(); }
  });

  test('a hash link opens the folded section it lands on', async () => {
    const had = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView() {};
    try {
      renderPage('/shows/show-1/events/ev-1#epp-sec-place');
      await waitFor(() => expect(screen.getByTestId('fold-place').getAttribute('aria-expanded')).toBe('true'));
      expect(screen.getByTestId('fold-look').getAttribute('aria-expanded')).toBe('false');
    } finally { Element.prototype.scrollIntoView = had; }
  });
});

describe('Basics are edited in their row', () => {
  test('tapping a value opens its editor in the row; Escape cancels without saving', async () => {
    stored = { ...OPEN_EVENT };
    renderPage();
    const row = await screen.findByTestId('basics-description');
    fireEvent.click(within(row).getByTitle('Edit description'));
    const editor = within(screen.getByTestId('basics-description')).getByRole('group', { name: 'Description' });
    expect(screen.queryByRole('dialog')).toBeNull();
    const box = within(editor).getByRole('textbox', { name: 'Description' });
    fireEvent.change(box, { target: { value: 'Changed' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Description' })).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('Enter saves a one-line field through the event PUT', async () => {
    stored = { ...OPEN_EVENT, description: 'A night.' };
    renderPage();
    const row = await screen.findByTestId('basics-date');
    fireEvent.click(within(row).getByTitle('Edit date'));
    const input = within(screen.getByRole('group', { name: 'Event date' })).getByLabelText('Event date');
    fireEvent.change(input, { target: { value: '2026-12-02' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(EVENT_URL, expect.objectContaining({ event_date: '2026-12-02' })));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Event date' })).toBeNull());
  });

  test('Continue on a Basics item opens that field in its row', async () => {
    stored = { ...COMPLETE_EVENT, category: null };
    renderPage();
    fireEvent.click(await screen.findByTestId('package-continue'));
    expect(await screen.findByRole('group', { name: 'Category' })).toBeTruthy();
    expect(screen.getByTestId('fold-identity').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Undo on the toast', () => {
  test('unfeaturing a guest offers Undo, which restores the list in one save', async () => {
    stored = { ...OPEN_EVENT };
    renderPage();
    fireEvent.click(await screen.findByTestId('fold-people'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Featured' }));
    const undo = await screen.findByTestId('toast-undo');
    expect(screen.getByTestId('page-toast').textContent).toContain('Removed Marisol from Featured');
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(stored.canon_consequences.automation.guest_profiles[0].featured).toBe(false);
    await waitFor(() => expect(screen.getByTestId('toast-undo')).toBeTruthy());

    fireEvent.click(screen.getByTestId('toast-undo'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(stored.canon_consequences.automation.guest_profiles[0]).toMatchObject({ profile_id: 'g1', featured: true, story_role: 'rival' });
    await waitFor(() => expect(screen.getByTestId('page-toast').textContent).toContain('Undone'));
    expect(undo.tagName).toBe('BUTTON');
  });

  test("changing a guest's story role can be undone", async () => {
    stored = { ...OPEN_EVENT };
    renderPage();
    fireEvent.click(await screen.findByTestId('fold-people'));
    fireEvent.change(screen.getByLabelText('Story role for Marisol'), { target: { value: 'mentor' } });
    await screen.findByTestId('toast-undo');
    expect(stored.canon_consequences.automation.guest_profiles[0].story_role).toBe('mentor');
    fireEvent.click(screen.getByTestId('toast-undo'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[1][1].canon_consequences.automation.guest_profiles[0].story_role).toBe('rival');
  });

  test('choosing the organizer can be undone: the columns and automation keys go back', async () => {
    stored = { ...OPEN_EVENT, host_brand: null, source_profile_id: null, host: null };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) return { data: { success: true, event: stored, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null } };
      if (url.startsWith('/api/v1/social-profiles')) return { data: { profiles: [{ id: 'sp-9', handle: 'kai', display_name: 'Kai' }] } };
      if (url === PREVIEW_URL) return { data: { success: true, data: preview } };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('change-organizer'));
    const dialog = await screen.findByRole('dialog', { name: 'Change Organizer' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Kai/ })).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(within(dialog).getByRole('button', { name: /Kai/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    await screen.findByTestId('toast-undo');
    expect(stored.source_profile_id).toBe('sp-9');
    fireEvent.click(screen.getByTestId('toast-undo'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    const { expected_updated_at: _version, ...undoBody } = vi.mocked(api.put).mock.calls[1][1];
    expect(undoBody).toEqual({ source_profile_id: null, host: null });
  });

  test('the Undo lasts about 8 seconds', async () => {
    stored = { ...OPEN_EVENT };
    renderPage();
    fireEvent.click(await screen.findByTestId('fold-people'));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Featured' }));
    await screen.findByTestId('toast-undo');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('toast-undo')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3500); });
    expect(screen.queryByTestId('toast-undo')).toBeNull();
  });
});

describe('keyboard shortcuts (desktop)', () => {
  test('? shows the help; g then 2 opens People; keys typed in a field are ignored', async () => {
    renderPage();
    await screen.findByTestId('package-next');
    fireEvent.keyDown(document.body, { key: '?' });
    expect(screen.getByTestId('shortcuts-help')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: '?' });
    expect(screen.queryByTestId('shortcuts-help')).toBeNull();
    fireEvent.keyDown(document.body, { key: '?' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('shortcuts-help')).toBeNull();

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: '2' });
    expect(screen.getByTestId('fold-people').getAttribute('aria-expanded')).toBe('true');

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '?' });
    expect(screen.queryByTestId('shortcuts-help')).toBeNull();
    input.remove();
  });

  test('s saves the open Basics field when focus is outside it', async () => {
    stored = { ...OPEN_EVENT };
    renderPage();
    const row = await screen.findByTestId('basics-date');
    fireEvent.click(within(row).getByTitle('Edit date'));
    fireEvent.change(screen.getByTestId('basics-input-date'), { target: { value: '2026-12-03' } });
    fireEvent.keyDown(document.body, { key: 's' });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(EVENT_URL, expect.objectContaining({ event_date: '2026-12-03' })));
  });

  test('nothing fires while a dialog is open', async () => {
    renderPage();
    await screen.findByTestId('package-next');
    fireEvent.click(screen.getAllByRole('button', { name: /change venue|choose venue/i })[0]);
    await screen.findByRole('dialog', { name: 'Choose venue' });
    fireEvent.keyDown(document.body, { key: '?' });
    expect(screen.queryByTestId('shortcuts-help')).toBeNull();
  });
});

describe('deal prices from the Terms hold the bar', () => {
  const DEAL = { ...COMPLETE_EVENT, deal_components: ['paid_for_content'] };
  test('a deliverable with no fee is a gate: no Start Episode, Needs Setup', async () => {
    stored = { ...DEAL };
    reportedPrices = { deliverables: [{ id: 'd1', description: 'Reel', fee: null }], costs: [] };
    renderPage();
    await waitFor(() => expect(screen.getByTestId('package-next').getAttribute('data-kind')).toBe('gate'));
    expect(screen.getByTestId('package-next').textContent).toMatch(/deal prices/i);
    expect(screen.queryByTestId('start-episode')).toBeNull();
    expect(screen.getByTestId('package-status').textContent).toBe('Needs Setup');
  });

  test('with every price set, Start Episode opens', async () => {
    stored = { ...DEAL };
    reportedPrices = { deliverables: [{ id: 'd1', description: 'Reel', fee: 300 }], costs: [] };
    renderPage();
    expect(await screen.findByTestId('start-episode')).toBeTruthy();
  });
});

describe('the look recommendations know about a chosen outfit', () => {
  test('hasOutfit is true when the event has an outfit set but no pieces', async () => {
    stored = { ...OPEN_EVENT, outfit_set_id: 'outfit-1', outfit_pieces: [] };
    renderPage();
    await screen.findByTestId('looks-stub');
    expect(lookProps[lookProps.length - 1].hasOutfit).toBe(true);
  });

  test('hasOutfit is false with no outfit at all', async () => {
    stored = { ...OPEN_EVENT, outfit_set_id: null, outfit_pieces: [] };
    renderPage();
    await screen.findByTestId('looks-stub');
    expect(lookProps[lookProps.length - 1].hasOutfit).toBe(false);
  });
});

describe('phone hero on one line', () => {
  test('the hero carries the date for the phone row; at 600px the tiles hide and the title cuts with …', async () => {
    renderPage();
    expect((await screen.findByTestId('hero-date')).textContent).toBe('Mon, Nov 9');
    const css = readFileSync(resolve(__dirname, 'EventPackagePage.css'), 'utf8');
    const phone = css.slice(css.lastIndexOf('@media (max-width: 600px)'));
    expect(phone).toMatch(/grid-template-areas: "back back back" "eye eye eye" "title date badge"/);
    expect(phone).toMatch(/\.epp-hero-summary, \.epp-hero-tiles \{ display: none; \}/);
    expect(phone).toMatch(/text-overflow: ellipsis/);
  });
});
