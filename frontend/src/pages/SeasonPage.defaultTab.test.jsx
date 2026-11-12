/**
 * The Season page's default tab, its two slot indicators, a started slot's
 * links and the corrected labels (Evoni, 2026-11-12). Everything is read
 * from what the page already loads: the roadmap's slots and
 * next_slot_number, the show's episodes, the slot's own episode and event.
 * Nothing here writes: the last test asserts that.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../services/api';
import SeasonPage from './SeasonPage';
import { defaultSeasonTab, tabForAddress, seasonPageHref, SEASON_TABS } from '../lib/seasonPage';

const slot = (n, phase, over = {}) => ({ id: `slot-${n}`, slot_number: n, phase, label: `S1 · E${n}`, state: 'needs_event', locked: false, intention: {}, episode: null, event: null, ...over });
const phases = (slots) => [1, 2, 3].map((p) => ({ phase: p, title: ['Foundation', 'Ascension', 'Legacy'][p - 1], episode_start: (p - 1) * 2 + 1, episode_end: p * 2, slots: slots.filter((s) => s.phase === p) }));
const ARC = { id: 'arc-1', season_number: 1, title: 'Soft Luxury Ascension', current_phase: 1, phases: [1, 2, 3].map((p) => ({ phase: p, title: ['Foundation', 'Ascension', 'Legacy'][p - 1], episode_start: (p - 1) * 2 + 1, episode_end: p * 2 })) };

// E1 started with NO event recorded on its slot (the real Episode 1); E2 started with its event; E3 pencilled; the rest open.
const UNDER_WAY = [
  slot(1, 1, { state: 'in_production', locked: true, episode: { id: 'ep-1', title: 'Wearable Experiments' } }),
  slot(2, 1, { state: 'in_production', locked: true, episode: { id: 'ep-2', title: 'Second Look' }, event: { id: 'ev-2', name: 'Atelier Visit' } }),
  slot(3, 2, { state: 'event_ready', event: { id: 'ev-3', name: 'Charity Gala' } }),
  slot(4, 2), slot(5, 3), slot(6, 3),
];
const EMPTY = [1, 2, 3, 4, 5, 6].map((n) => slot(n, Math.ceil(n / 2)));
const EPISODES = [
  { id: 'ep-1', episode_number: 1, season_number: 1, status: 'in_build', title: 'Wearable Experiments' },
  { id: 'ep-2', episode_number: 2, season_number: 1, status: 'draft', title: 'Second Look' },
];

let slots = UNDER_WAY;
let nextSlotNumber = 3;
let episodes = EPISODES;
let hasArc = true;
function mockGets() {
  vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
    if (url.includes('/season/roadmap')) return { data: { roadmap: hasArc ? { season_number: 1, slot_count: slots.length, next_slot_number: nextSlotNumber, counts: {}, phases: phases(slots), two_parters: [], specials: [] } : null } };
    if (/\/world\/show-1\/arc(\?|$)/.test(url)) return { data: { arc: hasArc ? ARC : null } };
    if (url.includes('/episodes')) return { data: { data: episodes, pagination: { total: episodes.length } } };
    if (url === '/api/v1/world/show-1/events') return { data: { events: [{ id: 'ev-2', name: 'Atelier Visit' }, { id: 'ev-3', name: 'Charity Gala' }] } };
    if (url === '/api/v1/shows/show-1') return { data: { data: { name: 'Styling Adventures' } } };
    return { data: {} };
  });
}

function Where() {
  const l = useLocation();
  const nav = useNavigate();
  return (<><span data-testid="where">{l.pathname}{l.search}</span><button type="button" data-testid="go-back" onClick={() => nav(-1)}>back</button></>);
}
const renderAt = (address) => render(
  <MemoryRouter initialEntries={[address]}>
    <Routes>
      <Route path="/shows/:showId/season" element={<><SeasonPage /><Where /></>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const openTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.querySelector('.szn-tab-label')?.textContent;

beforeEach(() => {
  slots = UNDER_WAY; nextSlotNumber = 3; episodes = EPISODES; hasArc = true;
  for (const m of ['post', 'put', 'patch', 'delete']) vi.mocked(api[m]).mockReset().mockResolvedValue({ data: {} });
  mockGets();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('defaultSeasonTab', () => {
  test('the Roadmap once any slot is pencilled, in production or done; else the Overview', () => {
    expect(defaultSeasonTab({ phases: phases(EMPTY) })).toBe('overview');
    expect(defaultSeasonTab({ phases: phases([slot(1, 1, { state: 'event_ready' }), slot(2, 1)]) })).toBe('roadmap');
    expect(defaultSeasonTab({ phases: phases([slot(1, 1, { state: 'in_production' })]) })).toBe('roadmap');
    expect(defaultSeasonTab({ phases: phases([slot(1, 1, { state: 'done' })]) })).toBe('roadmap');
    expect(defaultSeasonTab(null)).toBe('overview');
    expect(defaultSeasonTab({})).toBe('overview');
    expect(defaultSeasonTab({ phases: [{ slots: [{ state: 'something_new' }, null] }] })).toBe('overview');
  });

  test('a tab named in the address always wins; an unknown one is the Overview, as before', () => {
    const under = { phases: phases(UNDER_WAY) };
    expect(tabForAddress(null, under)).toBe('roadmap');
    expect(tabForAddress('', under)).toBe('roadmap');
    for (const t of SEASON_TABS) expect(tabForAddress(t.key, under)).toBe(t.key);
    expect(tabForAddress('overview', under)).toBe('overview');
    expect(tabForAddress('production', under)).toBe('episodes');
    expect(tabForAddress('nonsense', under)).toBe('overview');
  });

  test('every link the app builds to the Overview names it', () => {
    expect(seasonPageHref('show-1', 'overview')).toBe('/shows/show-1/season?tab=overview');
    expect(seasonPageHref('show-1', 'overview', { season: 2 })).toBe('/shows/show-1/season?tab=overview&season=2');
  });
});

describe('the Season page with no tab in its address', () => {
  test('a season with planned or started slots opens on the Roadmap, and the address is left alone', async () => {
    renderAt('/shows/show-1/season');
    expect(await screen.findByTestId('szn-roadmap')).toBeTruthy();
    expect(openTab()).toBe('Roadmap');
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season');
  });

  test('a season with every slot open opens on the Overview', async () => {
    slots = EMPTY; nextSlotNumber = 1; episodes = [];
    renderAt('/shows/show-1/season');
    expect(await screen.findByTestId('szn-panel-overview')).toBeTruthy();
    expect(openTab()).toBe('Overview');
    expect(screen.queryByTestId('szn-roadmap')).toBeNull();
  });

  test('no season at all: the setup, not a roadmap', async () => {
    hasArc = false; episodes = [];
    renderAt('/shows/show-1/season');
    await waitFor(() => expect(screen.queryByText('Loading the season…')).toBeNull());
    expect(screen.queryByTestId('szn-roadmap')).toBeNull();
    expect(document.body.textContent).toMatch(/three phases/);
  });

  test('other values in the address (a season, a filter) do not count as choosing a tab', async () => {
    renderAt('/shows/show-1/season?view=grid');
    expect(await screen.findByTestId('szn-roadmap')).toBeTruthy();
  });
});

describe('a tab named in the address', () => {
  test('?tab=overview opens the Overview even when the season is under way', async () => {
    renderAt('/shows/show-1/season?tab=overview');
    expect(await screen.findByTestId('szn-panel-overview')).toBeTruthy();
    expect(openTab()).toBe('Overview');
  });

  test.each(['roadmap', 'episodes', 'events', 'story', 'cast', 'plants', 'goals', 'results'])('?tab=%s opens that tab', async (key) => {
    renderAt(`/shows/show-1/season?tab=${key}`);
    const label = SEASON_TABS.find((t) => t.key === key).label;
    await waitFor(() => expect(openTab()).toBe(label));
  });

  test('the Overview tab\'s own link names it, so a click from the default Roadmap really leaves the Roadmap', async () => {
    renderAt('/shows/show-1/season');
    await screen.findByTestId('szn-roadmap');
    const overview = screen.getAllByRole('tab').find((t) => t.querySelector('.szn-tab-label').textContent === 'Overview');
    fireEvent.click(overview);
    expect(await screen.findByTestId('szn-panel-overview')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=overview');
  });

  test('browser Back returns through the tabs that were open, ending on the default', async () => {
    renderAt('/shows/show-1/season');
    await screen.findByTestId('szn-roadmap');
    const tabNamed = (name) => screen.getAllByRole('tab').find((t) => t.querySelector('.szn-tab-label').textContent === name);
    fireEvent.click(tabNamed('Overview'));
    await screen.findByTestId('szn-panel-overview');
    fireEvent.click(tabNamed('Goals'));
    await waitFor(() => expect(openTab()).toBe('Goals'));
    fireEvent.click(screen.getByTestId('go-back'));
    await waitFor(() => expect(openTab()).toBe('Overview'));
    fireEvent.click(screen.getByTestId('go-back'));
    await waitFor(() => expect(openTab()).toBe('Roadmap'));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season');
  });

  test('a deep link to a slot opens the Roadmap with that slot\'s panel', async () => {
    renderAt('/shows/show-1/season?tab=roadmap&slot=2');
    await screen.findByTestId('szn-roadmap');
    await waitFor(() => expect(screen.getByTestId('where').textContent).not.toContain('slot='));
    expect(screen.getByTestId('where').textContent).toContain('tab=roadmap');
    await waitFor(() => expect(screen.getByTestId('season-slot-package-2')).toBeTruthy());
  });
});

describe('Now producing and Next open slot', () => {
  test('Now producing is on the slot of the show\'s episode in production; Next open slot is the roadmap\'s next_slot_number; never the same slot', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    const e1 = await screen.findByTestId('szn-slot-1');
    await waitFor(() => expect(within(e1).getByTestId('szn-slot-now-1').textContent).toBe('Now producing'));
    expect(screen.getAllByText('Now producing')).toHaveLength(1);
    // E2 is in production too, but the episode in production is the first (Producer Mode's rule).
    expect(screen.queryByTestId('szn-slot-now-2')).toBeNull();
    expect(within(screen.getByTestId('szn-slot-3')).getByTestId('szn-slot-next-3').textContent).toBe('Next open slot');
    expect(screen.getAllByText('Next open slot')).toHaveLength(1);
    expect(within(e1).queryByText('Next open slot')).toBeNull();
    expect(within(screen.getByTestId('szn-slot-3')).queryByText('Now producing')).toBeNull();
  });

  test('a roadmap whose next_slot_number names a started slot shows no Next open slot there', async () => {
    nextSlotNumber = 2;
    renderAt('/shows/show-1/season?tab=roadmap');
    await screen.findByTestId('szn-slot-2');
    expect(screen.queryByText('Next open slot')).toBeNull();
  });

  test('no episode in production: no Now producing; no next_slot_number: no Next open slot', async () => {
    episodes = [{ ...EPISODES[0], status: 'published' }, { ...EPISODES[1], status: 'published' }];
    nextSlotNumber = null;
    renderAt('/shows/show-1/season?tab=roadmap');
    await screen.findByTestId('szn-slot-1');
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([u]) => u.includes('/episodes'))).toBe(true));
    expect(screen.queryByText('Now producing')).toBeNull();
    expect(screen.queryByText('Next open slot')).toBeNull();
  });

  test('when the episodes cannot be read, Now producing is not shown (unknown is not guessed)', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('/episodes')) throw new Error('boom');
      if (url.includes('/season/roadmap')) return { data: { roadmap: { season_number: 1, slot_count: 6, next_slot_number: 3, counts: {}, phases: phases(UNDER_WAY), two_parters: [], specials: [] } } };
      if (/\/world\/show-1\/arc(\?|$)/.test(url)) return { data: { arc: ARC } };
      return { data: {} };
    });
    renderAt('/shows/show-1/season?tab=roadmap');
    await screen.findByTestId('szn-slot-1');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Now producing')).toBeNull();
    expect(screen.getByTestId('szn-slot-next-3')).toBeTruthy();
  });
});

describe('a started slot\'s links', () => {
  const openMenu = async (n) => { fireEvent.click(await screen.findByTestId(`szn-slot-menu-${n}`)); return screen.getByRole('menu'); };

  test('with its event: the episode and the event package, both', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    const menu = await openMenu(2);
    expect(within(menu).getByRole('menuitem', { name: 'Open the episode' }).getAttribute('href')).toBe('/episodes/ep-2');
    const pkg = within(menu).getByTestId('szn-slot-package-2');
    expect(pkg.textContent).toBe('Open the event package');
    expect(pkg.getAttribute('href')).toMatch(/^\/shows\/show-1\/events\/ev-2\?/);
    expect(within(menu).queryByTestId('szn-slot-no-event-2')).toBeNull();
  });

  test('the event is not linked to the slot (Episode 1): it says exactly that and points at the episode\'s own events; no package link is made up', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    const menu = await openMenu(1);
    expect(within(menu).getByRole('menuitem', { name: 'Open the episode' }).getAttribute('href')).toBe('/episodes/ep-1');
    const none = within(menu).getByTestId('szn-slot-no-event-1');
    expect(none.textContent).toBe("Event not linked to this season slot. View the episode's events.");
    // It is the slot's link that is missing: nothing may say the event or its package does not exist.
    expect(menu.textContent).not.toMatch(/no event|no package|none pencilled/i);
    expect(none.getAttribute('href')).toBe('/episodes/ep-1?tab=overview');
    expect(within(menu).queryByText('Open the event package')).toBeNull();
    expect([...menu.querySelectorAll('a')].some((a) => /\/events\//.test(a.getAttribute('href')))).toBe(false);
  });

  test('the slot panel says the same: package link with an event, the plain statement without', async () => {
    renderAt('/shows/show-1/season?tab=roadmap&slot=1');
    const none = await screen.findByTestId('season-slot-no-event-1');
    expect(none.textContent).toBe("Event not linked to this season slot. View the episode's events.");
    expect(none.textContent).not.toMatch(/no event|no package/i);
    // The panel's Event line agrees: not "None pencilled", which is for a slot nothing has started in.
    expect(screen.getByTestId('season-slot-event-1').textContent).toBe('Not linked to this slot');
    expect(document.querySelector('.szn-drawer, [data-testid="szn-roadmap"]').textContent).not.toMatch(/E1[^E]*None pencilled/);
    expect(within(none).getByRole('link', { name: "View the episode's events." }).getAttribute('href')).toBe('/episodes/ep-1?tab=overview');
    expect(screen.queryByTestId('season-slot-package-1')).toBeNull();
  });

  test('an open slot still says None pencilled, and a slot with its event names it', async () => {
    renderAt('/shows/show-1/season?tab=roadmap&slot=4');
    await waitFor(() => expect(screen.getByTestId('season-slot-event-4').textContent).toBe('None pencilled'));
  });

  test('a started slot with its event names the event', async () => {
    renderAt('/shows/show-1/season?tab=roadmap&slot=2');
    await waitFor(() => expect(screen.getByTestId('season-slot-event-2').textContent).toBe('Atelier Visit'));
  });

  test('a pencilled slot keeps its one package link; an open slot has neither', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    let menu = await openMenu(3);
    expect(within(menu).getByTestId('szn-slot-package-3').getAttribute('href')).toMatch(/\/events\/ev-3\?/);
    expect(within(menu).queryByText('Open the episode')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    menu = await openMenu(4);
    expect(within(menu).queryByText('Open the event package')).toBeNull();
    expect(within(menu).queryByTestId('szn-slot-no-event-4')).toBeNull();
  });
});

describe('labels that say what they do', () => {
  test('the Overview\'s buttons that only open another tab are named for that tab', async () => {
    renderAt('/shows/show-1/season?tab=overview');
    await screen.findByTestId('szn-panel-overview');
    const text = document.body.textContent;
    for (const gone of ['Pencil an event', 'New Thread', 'Add Reveal', 'Add Goal']) expect(text).not.toContain(gone);
    fireEvent.click(await screen.findByTestId('szn-add-goal'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('tab=goals'));
  });

  test('Phase, not Part, on the Roadmap; the address still says part=', async () => {
    renderAt('/shows/show-1/season?tab=roadmap&view=grid');
    await screen.findByTestId('szn-roadmap-grid');
    expect(screen.getByRole('region', { name: 'Phase 1: Foundation' })).toBeTruthy();
    expect(screen.getByLabelText('Phase')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\bPart \d/);
    expect(document.body.textContent).not.toMatch(/Add Episode to/);
    fireEvent.change(screen.getByTestId('szn-filter-part'), { target: { value: '2' } });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('part=2'));
  });
});

describe('at a phone width (the stylesheet\'s rules)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'SeasonPage.css'), 'utf8');
  test('the two tags stay on one line each and the number row wraps, so a narrow card grows down, not sideways', () => {
    expect(css).toMatch(/\.szn-slot-now \{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.szn-slot-next \{ white-space: nowrap; \}/);
    expect(css).toMatch(/\.szn-slot-num \{ flex-wrap: wrap; \}/);
  });
});

describe('nothing is written', () => {
  test('opening the page, the Roadmap, a started slot\'s menu and its panel sends no write for any slot, Episode 1 included', async () => {
    renderAt('/shows/show-1/season');
    await screen.findByTestId('szn-roadmap');
    fireEvent.click(await screen.findByTestId('szn-slot-menu-1'));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Open the slot' }));
    await screen.findByTestId('season-slot-no-event-1');
    for (const m of ['post', 'put', 'patch', 'delete']) expect(vi.mocked(api[m])).not.toHaveBeenCalled();
    expect(vi.mocked(api.get).mock.calls.every(([u]) => typeof u === 'string')).toBe(true);
  });
});
