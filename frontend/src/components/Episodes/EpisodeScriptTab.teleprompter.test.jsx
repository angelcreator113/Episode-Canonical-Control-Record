// The Script tab's Teleprompter button (Evoni, 2026-10-20): a link to the
// Teleprompter page on this episode and the open beat.
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = ['## BEAT: 1 · Opening Ritual', 'Lala: "Hi."', '## BEAT: 8 · Transformation Loop', 'Me: "This one."'].join('\n');

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
const renderTab = () => render(
  <MemoryRouter initialEntries={['/episodes/ep-1']}>
    <Routes>
      <Route path="/episodes/:id" element={<EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', title: 'The Gala', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} />} />
      <Route path="/teleprompter" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  Element.prototype.scrollIntoView = vi.fn();
});

test('Teleprompter sits beside Table read and opens the page on this episode', () => {
  renderTab();
  const link = screen.getByTestId('script-teleprompter');
  expect(link.previousElementSibling.getAttribute('data-testid')).toBe('script-table-read');
  expect(link.getAttribute('href')).toMatch(/^\/teleprompter\?episode=ep-1/);
  fireEvent.click(link);
  expect(screen.getByTestId('where').textContent).toMatch(/^\/teleprompter\?episode=ep-1/);
});

test('with a beat open, it opens on that beat; unsaved changes ask first', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderTab();
  fireEvent.click(screen.getByText('Raw editor'));
  fireEvent.change(screen.getByLabelText('Raw script'), { target: { value: `${SCRIPT}\nKelli: "New."` } });
  const link = screen.getByTestId('script-teleprompter');
  expect(link.title).toContain('unsaved changes are not in it');
  fireEvent.click(link);
  expect(confirm).toHaveBeenCalled();
  expect(screen.queryByTestId('where')).toBeNull();
  confirm.mockRestore();
});
