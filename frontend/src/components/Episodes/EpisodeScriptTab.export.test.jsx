// Export from the Script tab (Script tab audit, 2026-10-15): the script on
// the page, saved or not, downloads as Fountain and prints as the table read.
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = ['## BEAT: 1 · Opening Ritual', 'Lala: "Hi."', '[STAT: coins 5]', '## BEAT: 5 · Reveal', '[UI:OPEN closet]'].join('\n');

const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', title: 'The Gala: Part 1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

let created;
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  Element.prototype.scrollIntoView = vi.fn();
  created = [];
  URL.createObjectURL = vi.fn((blob) => { created.push(blob); return 'blob:script'; });
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; });

const blobText = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });

test('Download .fountain saves the Fountain text under the episode title', async () => {
  const clicks = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function c() { clicks.push(this.download); });
  renderTab();
  fireEvent.click(screen.getByTestId('script-export-fountain'));
  expect(created).toHaveLength(1);
  const text = await blobText(created[0]);
  expect(text).toContain('Title: The Gala: Part 1');
  expect(text).toContain('# 1 · Opening Ritual\n\nLALA\nHi.');
  expect(text).toContain('Lala opens the Closet');
  expect(clicks).toEqual(['the-gala-part-1.fountain']);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:script'));
  click.mockRestore();
});

test('unsaved changes go into the export, and the buttons say so', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  renderTab();
  expect(screen.getByTestId('script-export-fountain').title).not.toContain('unsaved');
  fireEvent.click(screen.getByText('Raw editor'));
  fireEvent.change(screen.getByLabelText('Raw script'), { target: { value: `${SCRIPT}\nKelli: "New line."` } });
  expect(screen.getByTestId('script-export-fountain').title).toContain('includes unsaved changes');
  expect(screen.getByTestId('script-table-read').title).toContain('includes unsaved changes');
  fireEvent.click(screen.getByTestId('script-export-fountain'));
  expect(await blobText(created[0])).toContain('KELLI\nNew line.');
  click.mockRestore();
});

test('Print / PDF opens the table read for print and calls window.print', () => {
  const print = vi.fn();
  window.print = print;
  renderTab();
  fireEvent.click(screen.getByTestId('script-export-print'));
  expect(print).toHaveBeenCalledTimes(1);
  const dialog = screen.getByRole('dialog');
  expect(dialog.className).toContain('is-print');
  expect(dialog.textContent).toContain('Hi.');
  window.dispatchEvent(new Event('afterprint'));
  return waitFor(() => expect(screen.queryByTestId('table-read')).toBeNull());
});

test('Table read opens from the header and closes on Escape', () => {
  renderTab();
  const open = screen.getByTestId('script-table-read');
  open.focus();
  fireEvent.click(open);
  const dialog = screen.getByRole('dialog');
  expect(dialog.textContent).toContain('1 · Opening Ritual');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(open);
});

test('no script, no Table read or Export', () => {
  renderTab('');
  expect(screen.queryByTestId('script-table-read')).toBeNull();
  expect(screen.queryByTestId('script-export')).toBeNull();
});
