/**
 * Producer Mode → Overview, the current episode first (Evoni, 2026-11-12):
 * one identity for the episode in production, a primary button that names
 * the real next step, one list of what needs attention, the episode's own
 * money link, and the order of the page. Nothing here adds a tracker: the
 * next step is lib/episodeOverview nextStep and the production checklist.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn() }));
vi.mock('../Episodes/EpisodeProductionChecklist', async (orig) => ({ ...(await orig()), loadProductionChecks: vi.fn() }));

import api from '../../services/api';
import ShowOverview, { checklistSummary, episodeIdentity, orderAttention, primaryAction, episodesInProduction } from './ShowOverview';
import { CHECKLIST_SECTIONS, loadProductionChecks, checklistFixTarget } from '../Episodes/EpisodeProductionChecklist';

const LIVE = CHECKLIST_SECTIONS.filter((sec) => !sec.unavailableReason);
const allChecks = (value) => Object.fromEntries(LIVE.flatMap((sec) => sec.items.map((i) => [i.id, value])));
/** Every check done except the named section's. */
const doneExcept = (sectionId) => ({ ...allChecks(true), ...Object.fromEntries(LIVE.find((s) => s.id === sectionId).items.map((i) => [i.id, false])) });

const EP1 = { id: 'ep-1', episode_number: 1, season_number: 1, status: 'in_build', title: 'Wearable Experiments', script_content: 'INT. STUDIO', season_context: { label: 'S1 · E1', slot_number: 1 } };
const EP2 = { id: 'ep-2', episode_number: 2, season_number: 1, status: 'draft', title: 'Second Look', script_content: '' };
const EP0 = { id: 'ep-0', episode_number: 9, season_number: 1, status: 'published', title: 'Old One', script_content: 'x' };
// An event that still needs setup (no organizer).
const needs = (id, name) => ({ id, name, status: 'draft' });

const renderIt = (props = {}) => {
  const goTo = vi.fn();
  render(<MemoryRouter><ShowOverview showId="show-1" episodes={[EP1, EP2, EP0]} events={[]} goTo={goTo} {...props} /></MemoryRouter>);
  return goTo;
};

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockImplementation(async (url) => (url.endsWith('/season/roadmap') ? { data: { roadmap: null } } : { data: {} }));
  vi.mocked(loadProductionChecks).mockReset().mockResolvedValue({ checks: doneExcept('wardrobe'), linkedEvent: { id: 'ev-9', name: 'Studio Session' } });
});

describe('episodeIdentity: one name for the episode, for the header and the card', () => {
  test('the slot label and the title; the season and number when it has no slot; never an empty separator', () => {
    expect(episodeIdentity(EP1)).toBe('S1 · E1 · Wearable Experiments');
    expect(episodeIdentity(EP2)).toBe('S1 E2 · Second Look');
    expect(episodeIdentity({ id: 'x', episode_number: 3, season_number: 2, title: '  ' })).toBe('S2 E3');
    expect(episodeIdentity(null)).toBe('');
  });
});

describe('primaryAction: the next step, from what is already known', () => {
  const act = (over = {}) => primaryAction({ episode: EP1, showId: 'show-1', summary: checklistSummary(doneExcept('wardrobe')), producing: true, ...over });

  test('no script: Generate Script, on the Script tab, whatever the checklist says', () => {
    expect(act({ episode: EP2 })).toMatchObject({ key: 'script', label: 'Generate Script', href: '/episodes/ep-2?tab=scripts' });
    expect(act({ episode: { ...EP1, script_content: '   ' } }).key).toBe('script');
  });

  test('a script and open checks: the first open section, by name, at the place that fixes it', () => {
    const a = act();
    const wardrobe = LIVE.find((s) => s.id === 'wardrobe');
    const first = (wardrobe.items.filter((i) => i.required).length ? wardrobe.items.filter((i) => i.required) : wardrobe.items)[0];
    expect(a).toMatchObject({ key: 'production', section: 'wardrobe', label: `Continue: ${wardrobe.label}` });
    expect(a.href).toBe(checklistFixTarget(first.id, { episode: EP1, showId: 'show-1' })?.href || '/episodes/ep-1?tab=checklist');
    expect(a.why).toMatch(/production checks? left/);
  });

  test('sections are taken in the checklist\'s own order', () => {
    const none = primaryAction({ episode: EP1, showId: 'show-1', summary: checklistSummary(allChecks(false)), producing: true });
    expect(none.label).toBe(`Continue: ${LIVE[0].label}`);
  });

  test('every check done: Open Results', () => {
    expect(act({ summary: checklistSummary(allChecks(true)) })).toMatchObject({ key: 'results', label: 'Open Results', href: '/episodes/ep-1?tab=results' });
  });

  test('checks not known yet, or an episode that is not the one in production: the plain Open Episode, on its Overview', () => {
    expect(act({ summary: null })).toMatchObject({ key: 'open', label: 'Open Episode', href: '/episodes/ep-1?tab=overview', why: null });
    expect(act({ producing: false })).toMatchObject({ key: 'open', label: 'Open Episode', href: '/episodes/ep-1?tab=overview' });
  });

  test('it never says Continue Episode or Open Production, and never points at the bare Production tab', () => {
    const all = [act(), act({ episode: EP2 }), act({ summary: null }), act({ producing: false }), act({ summary: checklistSummary(allChecks(true)) })];
    for (const a of all) {
      expect(a.label).not.toMatch(/Continue Episode|Open Production/);
      expect(a.href).not.toMatch(/tab=production$/);
    }
  });
});

describe('the Now producing card', () => {
  test('it is the first thing in the main column, then what needs attention, then the assets', async () => {
    renderIt();
    const col = screen.getByTestId('show-overview').querySelector('.pov-col');
    expect([...col.children].map((el) => el.getAttribute('data-testid'))).toEqual(['sov-producing', 'sov-attention', 'sov-assets']);
    expect(screen.getByTestId('show-overview').querySelector('.pov-layout').firstElementChild).toBe(col);
  });

  test('it names the episode in production by code and title: the same two pieces the header chip joins', async () => {
    renderIt();
    const card = screen.getByTestId('sov-producing');
    expect(within(card).getByTestId('sov-producing-chip').textContent).toBe('Now producing');
    const code = within(card).getByTestId('sov-episode-code').textContent;
    const title = within(card).getByTestId('sov-episode-title').textContent;
    expect(`${code} · ${title}`).toBe(episodeIdentity(episodesInProduction([EP1, EP2, EP0])[0]));
    expect(within(card).queryByTestId('sov-back-to-producing')).toBeNull();
  });

  test('the primary button names the first open section once the checks answer, and says why', async () => {
    renderIt();
    const card = screen.getByTestId('sov-producing');
    const btn = within(card).getByTestId('sov-primary');
    await waitFor(() => expect(btn.textContent).toContain('Continue: Wardrobe'));
    expect(btn.getAttribute('data-step')).toBe('production');
    // It goes exactly where that section's own card goes: one destination for one fix.
    expect(btn.getAttribute('href')).toBe(within(card).getByTestId('sov-section-wardrobe').getAttribute('href'));
    expect(within(card).getByTestId('sov-primary-why').textContent).toMatch(/^Next: \d+ production checks? left/);
    expect(within(card).queryByText('Continue Episode')).toBeNull();
  });

  test('while the checks are loading, and when they fail, the button is the plain Open Episode', async () => {
    let finish;
    vi.mocked(loadProductionChecks).mockReturnValue(new Promise((r) => { finish = r; }));
    renderIt();
    const btn = screen.getByTestId('sov-primary');
    expect(btn.textContent).toContain('Open Episode');
    expect(btn.getAttribute('href')).toBe('/episodes/ep-1?tab=overview');
    finish({ checks: allChecks(true), linkedEvent: null });
    await waitFor(() => expect(btn.textContent).toContain('Open Results'));
  });

  test('another episode picked in the switcher is "Viewing", not "Now producing"; one press goes back', async () => {
    renderIt();
    const card = screen.getByTestId('sov-producing');
    fireEvent.change(within(card).getByLabelText('Episode'), { target: { value: 'ep-0' } });
    await waitFor(() => expect(within(card).getByTestId('sov-episode-title').textContent).toBe('Old One'));
    expect(within(card).getByTestId('sov-producing-chip').textContent).toBe('Viewing');
    expect(within(card).getByTestId('sov-primary').textContent).toContain('Open Episode');
    fireEvent.click(within(card).getByTestId('sov-back-to-producing'));
    await waitFor(() => expect(within(card).getByTestId('sov-episode-title').textContent).toBe('Wearable Experiments'));
    expect(within(card).getByTestId('sov-producing-chip').textContent).toBe('Now producing');
  });

  test('a later episode in production that is picked is still only viewed: the one in production is the first', async () => {
    renderIt();
    const card = screen.getByTestId('sov-producing');
    fireEvent.change(within(card).getByLabelText('Episode'), { target: { value: 'ep-2' } });
    await waitFor(() => expect(within(card).getByTestId('sov-episode-title').textContent).toBe('Second Look'));
    expect(within(card).getByTestId('sov-producing-chip').textContent).toBe('Viewing');
  });
});

describe('what needs attention: one list, nothing dropped', () => {
  const A = [needs('a', 'Alpha'), needs('b', 'Beta'), needs('ev-9', 'Studio Session'), needs('d', 'Delta'), needs('e', 'Echo')];

  test('orderAttention puts the current episode\'s event first and keeps every other warning in its order', () => {
    const rows = orderAttention(A.map((event) => ({ event, missing: ['Organizer'] })), 'ev-9');
    expect(rows.map((r) => r.event.id)).toEqual(['ev-9', 'a', 'b', 'd', 'e']);
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false, false]);
    expect(orderAttention(A.map((event) => ({ event, missing: [] })), null).every((r) => r.current === false)).toBe(true);
    expect(orderAttention(null)).toEqual([]);
  });

  test('the card: this episode\'s event first and marked, the true count, and the rest named as a count with a way to them', async () => {
    const goTo = renderIt({ events: A });
    const card = screen.getByTestId('sov-attention');
    await waitFor(() => expect(within(card).getByTestId('sov-attention-current').textContent).toBe('This episode'));
    expect(card.textContent).toContain('Needs Your Attention (5)');
    const names = [...card.querySelectorAll('.pov-attention li strong')].map((el) => el.firstChild.textContent);
    expect(names).toEqual(['Studio Session', 'Alpha', 'Beta']);
    expect(within(card).getByTestId('sov-attention-more').textContent).toContain('2 more events need setup.');
    fireEvent.click(within(card).getByRole('button', { name: 'See them in Events' }));
    expect(goTo).toHaveBeenCalledWith('events');
    expect(card.querySelector('.pov-attention a').getAttribute('href')).toBe('/shows/show-1/events/ev-9?from=producer');
  });

  test('three or fewer: no "more" line; none: it says so', async () => {
    renderIt({ events: A.slice(0, 3) });
    expect(screen.queryByTestId('sov-attention-more')).toBeNull();
    expect(screen.getByTestId('sov-attention').textContent).toContain('Needs Your Attention (3)');
  });
});

describe('links that say where they go', () => {
  test('the money card opens this episode\'s Money, not the show\'s finances', async () => {
    const goTo = renderIt();
    const money = await screen.findByTestId('sov-money');
    const link = within(money).getByTestId('sov-money-link');
    expect(link.textContent).toBe('Open episode money');
    expect(link.getAttribute('href')).toBe('/episodes/ep-1?tab=money');
    expect(within(money).queryByRole('button', { name: 'View Details' })).toBeNull();
    expect(goTo).not.toHaveBeenCalledWith('finances');
  });

  test('a ready event opens its package, and the button says so (Start Episode is pressed there)', async () => {
    const ready = { id: 'ev-r', name: 'Gala', status: 'ready', host: 'Sable', venue_name: 'Hall', dress_code: 'Black tie', prestige: 5, invitation_asset_id: 'inv-1', scene_set_id: 'set-1' };
    renderIt({ events: [ready] });
    const next = screen.getByTestId('sov-next-event');
    const link = within(next).queryByRole('link');
    if (link) {
      expect(link.textContent).toBe('Open event package');
      expect(link.getAttribute('href')).toBe('/shows/show-1/events/ev-r?from=producer');
    }
    expect(next.textContent).not.toContain('Start Episode');
  });

  test('the only links to the Season page are the next open slot (its own place on the Roadmap) and setting a season up', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/season/roadmap')
      ? { data: { roadmap: { next_slot_number: 4, phases: [{ phase: 1, slots: [{ slot_number: 4, label: 'S1 · E4' }] }] } } } : { data: {} }));
    renderIt();
    const slot = await screen.findByTestId('sov-next-slot-link');
    expect(slot.getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&slot=4');
    expect(slot.textContent).toContain('Next open slot: S1 · E4');
    const seasonLinks = [...screen.getByTestId('show-overview').querySelectorAll('a')].filter((a) => /\/season(\?|$)/.test(a.getAttribute('href')));
    expect(seasonLinks).toEqual([slot]);
  });

  test('the next open slot and the episode in production are named apart', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/season/roadmap')
      ? { data: { roadmap: { next_slot_number: 4, phases: [{ phase: 1, slots: [{ slot_number: 4, label: 'S1 · E4' }] }] } } } : { data: {} }));
    renderIt();
    await screen.findByTestId('sov-next-slot-link');
    expect(screen.getByTestId('sov-producing').textContent).toContain('S1 · E1');
    expect(screen.getByTestId('sov-producing').textContent).not.toContain('S1 · E4');
    expect(screen.getByTestId('sov-next').textContent).toContain('Next open slot');
    expect(screen.getByTestId('sov-next').textContent).not.toContain('Now producing');
  });
});

describe('at a phone width (the stylesheets\' rules)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'ShowOverview.css'), 'utf8');
  const wa = fs.readFileSync(path.resolve(__dirname, '../../pages/WorldAdmin.css'), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 640px)'));

  test('one column, and the primary button takes the full row', () => {
    expect(css).toMatch(/@media \(max-width: 1180px\) \{\s*\.pov-layout \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(phone).toMatch(/\.pov-actions \.pov-btn\.is-primary \{ flex: 1 1 100%; \}/);
    expect(phone).toMatch(/\.pov-now-body \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });

  test('long names wrap or shorten instead of widening the page', () => {
    expect(css).toMatch(/\.pov-btn\.is-primary \{ min-width: 0; text-align: center; overflow-wrap: anywhere; \}/);
    expect(css).toMatch(/\.pov-next-why \{[^}]*overflow-wrap: anywhere;/);
    expect(wa).toMatch(/\.wa-chip-producing \{ max-width: 100%; min-width: 0; \}/);
    expect(wa).toMatch(/\.wa-chip-producing \.wa-chip-text \{[^}]*text-overflow: ellipsis; white-space: nowrap; \}/);
    expect(wa).not.toMatch(/\.wa-chip-season:hover/);
  });
});

describe('Now producing and the episode last opened are two things (Evoni, 2026-11-17)', () => {
  // EP1 is the show's official production episode (the first unfinished in
  // story order); EP2 is a later unfinished one; EP0 is released.
  beforeEach(() => { localStorage.removeItem('working-episode-id'); });

  const card = () => screen.getByTestId('sov-producing');
  const title = () => within(card()).getByTestId('sov-episode-title').textContent;
  const chip = () => within(card()).getByTestId('sov-producing-chip').textContent;

  test('nothing remembered: the card is the production episode, with no Resume link', async () => {
    renderIt();
    expect(title()).toBe('Wearable Experiments');
    expect(chip()).toBe('Now producing');
    expect(screen.queryByTestId('sov-resume')).toBeNull();
  });

  test('EP1 in production, EP2 opened last: the card still opens on EP1 as "Now producing", and offers Resume for EP2', async () => {
    localStorage.setItem('working-episode-id', 'ep-2');
    renderIt();
    expect(title()).toBe('Wearable Experiments');
    expect(chip()).toBe('Now producing');
    const resume = within(card()).getByTestId('sov-resume');
    expect(resume.textContent).toBe('Resume S1 E2 (last opened)');
    expect(resume.getAttribute('href')).toBe('/episodes/ep-2');
    // The card's own button still belongs to the production episode.
    await waitFor(() => expect(within(card()).getByTestId('sov-primary').getAttribute('href')).not.toMatch(/ep-2/));
    expect(within(card()).getByTestId('sov-episode-code').textContent).toBe('S1 · E1');
    // Nothing calls the remembered episode "Now producing" or "in production".
    expect(resume.textContent).not.toMatch(/producing|in production/i);
  });

  test('the production episode itself was opened last: no Resume link', () => {
    localStorage.setItem('working-episode-id', 'ep-1');
    renderIt();
    expect(chip()).toBe('Now producing');
    expect(screen.queryByTestId('sov-resume')).toBeNull();
  });

  test('a remembered episode that is released, deleted, another show\'s, or not real: no Resume link, and the card is unchanged', () => {
    for (const id of ['ep-0', 'deleted-episode', 'other-show-ep', 'x', '']) {
      localStorage.setItem('working-episode-id', id);
      const { unmount } = render(<MemoryRouter><ShowOverview showId="show-1" episodes={[EP1, EP2, EP0]} events={[]} goTo={() => {}} /></MemoryRouter>);
      expect(title()).toBe('Wearable Experiments');
      expect(chip()).toBe('Now producing');
      expect(screen.queryByTestId('sov-resume')).toBeNull();
      unmount();
    }
  });

  test('the dropdown is a temporary viewing pick: it remembers nothing, and Back returns to the production episode even with EP2 remembered', async () => {
    localStorage.setItem('working-episode-id', 'ep-2');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    try {
      renderIt();
      fireEvent.change(within(card()).getByLabelText('Episode'), { target: { value: 'ep-0' } });
      await waitFor(() => expect(title()).toBe('Old One'));
      expect(chip()).toBe('Viewing');
      fireEvent.change(within(card()).getByLabelText('Episode'), { target: { value: 'ep-2' } });
      await waitFor(() => expect(title()).toBe('Second Look'));
      // A later unfinished episode that is picked, and remembered, is still only viewed.
      expect(chip()).toBe('Viewing');
      fireEvent.click(within(card()).getByTestId('sov-back-to-producing'));
      await waitFor(() => expect(title()).toBe('Wearable Experiments'));
      expect(chip()).toBe('Now producing');
      expect(set.mock.calls.filter(([k]) => String(k).startsWith('working-episode'))).toEqual([]);
    } finally { set.mockRestore(); }
    expect(localStorage.getItem('working-episode-id')).toBe('ep-2');
  });

  test('nothing unfinished: the card opens on the newest episode as "Viewing", as before, with no Resume link', () => {
    localStorage.setItem('working-episode-id', 'ep-0');
    renderIt({ episodes: [EP0, { ...EP0, id: 'ep-00', episode_number: 4, title: 'Older One' }] });
    expect(title()).toBe('Old One');
    expect(chip()).toBe('Viewing');
    expect(screen.queryByTestId('sov-resume')).toBeNull();
    expect(screen.queryByTestId('sov-back-to-producing')).toBeNull();
  });

  test('no episodes: "Nothing in production", and no Resume link', () => {
    localStorage.setItem('working-episode-id', 'ep-2');
    renderIt({ episodes: [] });
    expect(card().textContent).toContain('Nothing in production.');
    expect(screen.queryByTestId('sov-resume')).toBeNull();
  });

  test('several seasons: the production episode is the first unfinished by number, and a later season\'s episode opened last is only offered as Resume', () => {
    const S1 = { ...EP1, id: 's1e3', episode_number: 3, season_number: 1, title: 'Season one, three', season_context: null };
    const S2 = { ...EP2, id: 's2e25', episode_number: 25, season_number: 2, title: 'Season two, first', script_content: 'x' };
    localStorage.setItem('working-episode-id', 's2e25');
    renderIt({ episodes: [S2, S1, EP0] });
    expect(title()).toBe('Season one, three');
    expect(chip()).toBe('Now producing');
    expect(within(card()).getByTestId('sov-resume').getAttribute('href')).toBe('/episodes/s2e25');
    expect(within(card()).getByLabelText('Season').value).toBe('1');
  });

  test('storage that cannot be read: the card is the production episode and the page still renders', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderIt();
      expect(title()).toBe('Wearable Experiments');
      expect(chip()).toBe('Now producing');
      expect(screen.queryByTestId('sov-resume')).toBeNull();
    } finally { spy.mockRestore(); warn.mockRestore(); }
  });
});
