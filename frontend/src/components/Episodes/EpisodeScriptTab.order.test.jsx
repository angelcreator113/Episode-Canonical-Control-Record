/**
 * Reordering the script (Evoni, 2026-10-08: "drag and drop to the script
 * sequence"). A beat moves with its number and name; lines move inside
 * their beat; approved (locked) beats don't move and their lines don't.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '[EVENT: name="Gala"]\n\n## BEAT: 1 · Opening Ritual\nLala: One.\n\n## BEAT: 2 · Login Sequence\nLala: Two a.\nLala: Two b.\n\n## BEAT: 3 · Welcome\nLala: Three.';
const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const order = () => screen.getAllByTestId(/^script-beat-\d+$/).map((el) => el.getAttribute('data-testid').replace('script-beat-', ''));
const saveBody = async () => {
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
  fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
  await vi.waitFor(() => expect(api.put).toHaveBeenCalled());
  return vi.mocked(api.put).mock.calls[0][1].script_content;
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('Script reordering', () => {
  test('dragging a beat by its handle moves it, with its number and name, and marks the script unsaved', async () => {
    renderTab();
    expect(screen.queryByTestId('script-dirty')).toBeNull();
    fireEvent.dragStart(screen.getByTestId('script-drag-3'));
    fireEvent.dragOver(screen.getByTestId('script-beat-1'));
    fireEvent.drop(screen.getByTestId('script-beat-1'));
    expect(order()).toEqual(['3', '1', '2']);
    expect(screen.getByTestId('script-dirty').textContent).toContain('Unsaved changes');
    expect(await saveBody()).toBe('[EVENT: name="Gala"]\n\n## BEAT: 3 · Welcome\nLala: Three.\n\n## BEAT: 1 · Opening Ritual\nLala: One.\n\n## BEAT: 2 · Login Sequence\nLala: Two a.\nLala: Two b.');
  });

  test('Up and Down move a beat without dragging, and the moved beat stays open', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-down-1'));
    expect(order()).toEqual(['2', '1', '3']);
    expect(screen.getByTestId('script-beat-up-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-beat-up-1'));
    expect(order()).toEqual(['1', '2', '3']);
    expect(screen.getByTestId('script-beat-up-1').disabled).toBe(true);
  });

  test('a line moves inside its beat by dragging, and by Up/Down while editing', async () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-2')).getByText('Login Sequence'));
    const lines = () => within(screen.getByTestId('script-beat-2')).getAllByTestId('script-line');
    fireEvent.dragStart(lines()[1]);
    fireEvent.dragOver(lines()[0]);
    fireEvent.drop(lines()[0]);
    expect(lines().map((l) => l.textContent)).toEqual(['Lala"Two b."✦ Rewrite', 'Lala"Two a."✦ Rewrite']);
    fireEvent.click(lines()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Move line down' }));
    expect(lines().map((l) => l.textContent)).toEqual(['Lala"Two a."✦ Rewrite', 'Lala"Two b."✦ Rewrite']);
  });

  test("a line can't be dropped into another beat", () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-2')).getByText('Login Sequence'));
    const line = within(screen.getByTestId('script-beat-2')).getAllByTestId('script-line')[0];
    fireEvent.dragStart(line);
    fireEvent.drop(screen.getByTestId('script-beat-1'));
    expect(order()).toEqual(['1', '2', '3']);
    expect(screen.queryByTestId('script-dirty')).toBeNull();
  });

  test('an approved beat has no handle and no Up/Down, and its lines do not drag', () => {
    renderTab([1]);
    expect(screen.queryByTestId('script-drag-1')).toBeNull();
    expect(screen.queryByTestId('script-beat-down-1')).toBeNull();
    expect(within(screen.getByTestId('script-beat-1')).getAllByTestId('script-line')[0].getAttribute('draggable')).toBe('false');
    expect(screen.getByTestId('script-drag-2')).toBeTruthy();
  });
});
