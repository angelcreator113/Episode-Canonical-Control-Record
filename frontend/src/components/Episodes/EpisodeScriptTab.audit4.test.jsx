/**
 * Script page audit 4 (2026-10-19): a beat can be dragged at every width
 * (a handle on the beat's own head, the pills as drop targets, a hint that
 * says so), and focus stays put on the Raw editor toggle, the previous /
 * next arrows and the beat row's ⋮ menu.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual', '(Morning light.)',
  '## BEAT: 2 · Login Sequence', '(She types.)',
  '## BEAT: 3 · Welcome', '(She spins.)',
].join('\n');
const renderTab = (locks = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locks }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const order = () => [...document.querySelectorAll('[data-testid^="script-row-"]')].map((r) => r.dataset.testid.replace('script-row-', ''));
const css = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
});

describe('Script page audit 4', () => {
  test("the open beat's head carries a drag handle; dropping it on a pill moves the beat", async () => {
    renderTab();
    const grip = await screen.findByTestId('script-drag-head-1');
    expect(grip.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(grip, { dataTransfer: { setData() {}, setDragImage() {} } });
    // jsdom's drag events carry no pointer position: the drop is "before".
    const pill = screen.getByTestId('script-pill-3');
    fireEvent.dragOver(pill);
    expect(pill.className).toContain('esp-pill-drop-before');
    fireEvent.drop(pill);
    await waitFor(() => expect(order()).toEqual(['2', '1', '3']));
    expect(screen.getByTestId('script-beat-1').className).toContain('is-open');
  });

  test('a locked beat has no head handle', async () => {
    renderTab([1]);
    await screen.findByTestId('script-beat-1');
    expect(screen.queryByTestId('script-drag-head-1')).toBeNull();
    expect(screen.getByTestId('script-drag-head-2')).toBeTruthy();
  });

  test('the head handle shows only where the beat list is hidden; the hint names Up and Down', async () => {
    renderTab();
    await screen.findByTestId('script-beat-1');
    expect(css).toMatch(/\.esp-head-grip\s*\{[^}]*display:\s*none/);
    const narrow = css.slice(css.indexOf('@media (max-width: 1100px)'));
    expect(narrow.slice(0, narrow.indexOf('\n}'))).toMatch(/\.esp-head-grip\s*\{[^}]*display:\s*inline-flex/);
    const hint = screen.getByTestId('script-order-hint');
    expect(within(hint).getByTestId('script-order-hint-list').textContent).toMatch(/beat list/);
    expect(within(hint).getByTestId('script-order-hint-pills').textContent).toMatch(/pill/);
    expect(hint.textContent).toMatch(/Up and Down/);
  });

  test('Raw editor and Beat view keep focus on the toggle', async () => {
    renderTab();
    await screen.findByTestId('script-beat-1');
    // On the script's bar (Evoni, 2026-10-22 layout list).
    const raw = within(screen.getByTestId('script-tools')).getByRole('button', { name: 'Raw editor' });
    raw.focus(); fireEvent.click(raw);
    await screen.findByLabelText('Raw script');
    expect(document.activeElement.textContent).toBe('Beat view');
    fireEvent.click(document.activeElement);
    await screen.findByTestId('script-beat-1');
    expect(document.activeElement.textContent).toBe('Raw editor');
  });

  test("the arrows keep focus: on the new beat's same arrow, else its head", async () => {
    renderTab();
    await screen.findByTestId('script-beat-1');
    fireEvent.click(screen.getByTestId('script-beat-next'));
    expect(document.activeElement).toBe(within(screen.getByTestId('script-beat-2')).getByTestId('script-beat-next'));
    fireEvent.click(document.activeElement);
    // Beat 3 is the last: its Next is disabled, so its head takes focus.
    expect(document.activeElement).toBe(screen.getByTestId('script-beat-3').querySelector('.esp-beat-head'));
  });

  test("the row menu gives focus back to its ⋮ after Move", async () => {
    renderTab();
    const row = await screen.findByTestId('script-row-1');
    const det = row.querySelector('details');
    det.open = true; fireEvent(det, new Event('toggle'));
    const down = await within(row).findByRole('button', { name: 'Move down' });
    down.focus(); fireEvent.click(down);
    await waitFor(() => expect(order()).toEqual(['2', '1', '3']));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-row-1').querySelector('summary')));
  });
});
