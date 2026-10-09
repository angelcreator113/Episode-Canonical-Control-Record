/**
 * Evoni, 2026-10-09 (Task #2795): "In beat mode in scripts I'm not able to
 * add new beats where I want them" — lines inside a beat, anywhere in it.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nMe: Hi besties.\nLala: Hey bestie.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
});

describe('Script tab: add a line anywhere in a beat', () => {
  test('a line for who you pick goes after the line you pick; the next one after it; Save keeps them', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    const adder = screen.getByTestId('script-line-adder');
    expect(within(adder).getByTestId('script-line-adder-add').disabled).toBe(true);
    const where = within(adder).getByTestId('script-line-adder-where');
    expect([...where.options].map((o) => o.textContent)).toEqual(['Prime: Hi besties.', 'Lala: Hey bestie.', 'The end of the beat']);

    fireEvent.change(where, { target: { value: '0' } });
    fireEvent.change(within(adder).getByTestId('script-line-adder-text'), { target: { value: '  Oh   my gosh! ' } });
    fireEvent.click(within(adder).getByTestId('script-line-adder-add'));
    // Open for the next one: an action, after the line just added.
    fireEvent.click(within(adder).getByRole('button', { name: 'Action' }));
    fireEvent.change(within(adder).getByTestId('script-line-adder-text'), { target: { value: 'She spins the chair' } });
    fireEvent.click(within(adder).getByTestId('script-line-adder-add'));
    fireEvent.click(within(adder).getByRole('button', { name: 'Prime' }));
    fireEvent.change(within(adder).getByTestId('script-line-adder-text'), { target: { value: 'Welcome back!' } });
    fireEvent.change(within(adder).getByTestId('script-line-adder-where'), { target: { value: 'end' } });
    fireEvent.click(within(adder).getByTestId('script-line-adder-add'));
    expect(within(adder).getByRole('status').textContent).toBe('3 lines added');
    fireEvent.click(within(adder).getByTestId('script-line-adder-done'));
    expect(screen.queryByTestId('script-line-adder')).toBeNull();
    expect(screen.getByTestId('script-dirty')).toBeTruthy();

    fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toBe(
      '## BEAT: 1 · Opening Ritual\nMe: Hi besties.\nLala: Oh my gosh!\n(She spins the chair)\nLala: Hey bestie.\nMe: Welcome back!\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.',
    );
  });

  test('a locked beat adds no lines', () => {
    renderTab([1]);
    expect(screen.queryByTestId('script-add-line-1')).toBeNull();
  });
});
