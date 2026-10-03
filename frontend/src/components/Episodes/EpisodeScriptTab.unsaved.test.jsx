/**
 * Generated but not saved (audit GATE-03, 2026-10-03): the server saves as
 * part of success; a script it could not save stays on the page as a draft
 * with the reason, and Save keeps it without another generation.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n';
const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: '' }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('EpisodeScriptTab: generated but not saved', () => {
  test('the draft stays with its reason; Save now saves it and clears the notice, without regenerating', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {
      success: false, saved: false, code: 'SCRIPT_GENERATED_NOT_SAVED',
      error: 'The script was generated but could not be saved: disk full', script: SCRIPT,
    } });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Generate Script/ }));
    const notice = await screen.findByTestId('script-unsaved');
    expect(notice.textContent).toContain('Not saved.');
    expect(notice.textContent).toContain('could not be saved: disk full');
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('script-unsaved-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1', { script_content: SCRIPT }));
    await waitFor(() => expect(screen.queryByTestId('script-unsaved')).toBeNull());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('a saved script shows no notice and is not saved a second time from here', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, saved: true, script: SCRIPT } });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Generate Script/ }));
    await screen.findByText(/Script generated!/);
    expect(screen.queryByTestId('script-unsaved')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });
});
