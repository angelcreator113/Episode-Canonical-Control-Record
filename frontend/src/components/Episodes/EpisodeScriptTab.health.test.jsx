/**
 * "Ready to film?" (Script tab audit, 2026-10-15): the script-wide checks in
 * one card at the top of the Script tab; a row a beat fixes opens that beat.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { scriptHealth } from '../../lib/scriptHealth';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n[UI:OPEN Nowhere]';
const renderTab = (script = SCRIPT, locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

describe('Ready to film?', () => {
  test('lists the missing canonical beats, the phone gaps by beat, approvals and saved state', () => {
    renderTab();
    expect(screen.getByTestId('script-health').textContent).toContain('Ready to film?');
    const beats = screen.getByTestId('script-health-beats');
    expect(beats.getAttribute('data-ok')).toBe('false');
    expect(beats.textContent).toContain('3 (Welcome)');
    expect(beats.textContent).toContain('14 (Cliffhanger)');
    expect(screen.getByTestId('script-health-phone-beat-2').textContent).toContain("Beat 2: Nowhere isn't made yet");
    expect(screen.getByTestId('script-health-approved').textContent).toBe('0 of 2 beats approved.');
    expect(screen.getByTestId('script-health-saved').getAttribute('data-ok')).toBe('true');
    expect(screen.getByTestId('script-health-sum').textContent).toBe('3 to check');
  });

  test("a row's Open beat opens that beat", () => {
    renderTab();
    expect(screen.getByTestId('script-beat-2').className).not.toContain('is-open');
    fireEvent.click(screen.getByTestId('script-health-open-phone-beat-2'));
    expect(screen.getByTestId('script-beat-2').className).toContain('is-open');
  });

  test('an edit shows as unsaved', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-down-1'));
    expect(screen.getByTestId('script-health-saved').textContent).toBe('Unsaved changes.');
  });

  test('closed stays closed for this viewer', () => {
    const { unmount } = renderTab();
    fireEvent.click(screen.getByTestId('script-health-toggle'));
    expect(screen.queryByTestId('script-health-beats')).toBeNull();
    expect(screen.getByTestId('script-health-toggle').getAttribute('aria-expanded')).toBe('false');
    unmount();
    renderTab();
    expect(screen.queryByTestId('script-health-beats')).toBeNull();
    fireEvent.click(screen.getByTestId('script-health-toggle'));
    expect(screen.getByTestId('script-health-beats')).toBeTruthy();
  });

  test('storage that throws still shows the card, open, and says why in the console', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTab();
    expect(screen.getByTestId('script-health-beats')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-health-toggle'));
    expect(screen.queryByTestId('script-health-beats')).toBeNull();
    expect(err).toHaveBeenCalled();
    get.mockRestore(); set.mockRestore(); err.mockRestore();
  });

  test('a look piece never put on is flagged at the getting-ready beat', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/wardrobe/outfit/ep-1'
      ? { data: { items: [{ id: 'w-1', name: 'Gold Heels' }] } } : { data: { data: [] } }));
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-health-uncued').textContent).toContain('Gold Heels'));
    expect(screen.getByTestId('script-health-open-uncued')).toBeTruthy();
  });
});

describe('scriptHealth', () => {
  const canonical = [{ number: 1, name: 'A' }, { number: 2, name: 'B' }];
  const beats = [{ id: 'beat-1', number: 1, lines: ['Lala: hi'], approved: true }, { id: 'beat-2', number: 2, lines: ['[DELIVER: nope]'], approved: true }];

  test('every check clear reads ok', () => {
    const rows = scriptHealth({ beats: beats.slice(0, 1), canonical: canonical.slice(0, 1), cover: [{ key: 'hook', label: 'x', source: 'Forward hook', beat: 1 }] });
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(rows.map((r) => r.key)).toEqual(['beats', 'cover', 'approved', 'saved']);
  });

  test('cover gaps, deal cues and an unsaved draft are flagged', () => {
    const rows = scriptHealth({ beats, canonical, cover: [{ key: 'goal-0', label: 'Meet Sable', source: 'Goal', beat: null }], unsaved: 'x' });
    expect(rows.find((r) => r.key === 'cover-goal-0').text).toBe('Goal not in the script yet: Meet Sable');
    const deal = rows.find((r) => r.key === 'deal-beat-2');
    expect(deal.beatId).toBe('beat-2');
    expect(deal.text).toBe('Beat 2: [DELIVER: nope] is not a deliverable of this event');
    expect(rows.find((r) => r.key === 'saved').text).toBe('Generated but not saved: Save keeps it.');
  });
});
