// The Export menu (Script tab audit 6, 2026-10-24): fixed under its button so
// the header's scrolling row does not clip it at 760px and under; Escape and
// a click outside close it; files named ep-<n>-…; blob URLs revoked a second
// after the click (Safari).
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScriptReadActions, { menuPlace, REVOKE_AFTER_MS, downloadText } from './ScriptReadActions';
import { scriptFileName } from '../../lib/scriptExport';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nMe: "Hi."';
const renderIt = (props = {}) => render(<MemoryRouter><ScriptReadActions scriptText={SCRIPT} title="The Gala" {...props} /></MemoryRouter>);
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; vi.useRealTimers(); });

const openMenu = () => {
  const details = screen.getByTestId('script-export');
  details.open = true;
  fireEvent(details, new Event('toggle'));
  return details;
};

test('open, the menu is fixed under its button, inside the window', () => {
  expect(menuPlace({ right: 300, bottom: 40 }, 375)).toEqual({ position: 'fixed', top: 44, left: 100, right: 'auto' });
  // Near the left edge it stays 8px in; near the right, inside the window.
  expect(menuPlace({ right: 60, bottom: 40 }, 375).left).toBe(8);
  expect(menuPlace({ right: 600, bottom: 40 }, 375).left).toBe(167);
  renderIt();
  openMenu();
  const menu = screen.getByTestId('script-export-menu');
  expect(menu.className).toContain('is-fixed');
  expect(menu.style.position).toBe('fixed');
});

test('Escape and a click outside close it', () => {
  renderIt();
  const details = openMenu();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(details.open).toBe(false);
  expect(screen.getByTestId('script-export-menu').className).not.toContain('is-fixed');
  openMenu();
  fireEvent.mouseDown(document.body);
  expect(details.open).toBe(false);
});

test('files are named ep-<n>-<title>, untitled ep-<n>-script', () => {
  expect(scriptFileName('The Gala', 3)).toBe('ep-3-the-gala');
  expect(scriptFileName('', 3)).toBe('ep-3-script');
  expect(scriptFileName('Episode 3', null)).toBe('ep-3-script');
  expect(scriptFileName('Ep 3: The Gala!', 3)).toBe('ep-3-the-gala');
  expect(scriptFileName('The Gala', null)).toBe('the-gala');
  const names = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function c() { names.push(this.download); });
  renderIt({ episodeNumber: 7 });
  fireEvent.click(screen.getByTestId('script-export-text'));
  fireEvent.click(screen.getByTestId('script-export-fountain'));
  expect(names).toEqual(['ep-7-the-gala.txt', 'ep-7-the-gala.fountain']);
  click.mockRestore();
});

test('the blob URL is revoked a second after the click', () => {
  vi.useFakeTimers();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  downloadText('x', 'x.txt');
  vi.advanceTimersByTime(REVOKE_AFTER_MS - 1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  click.mockRestore();
});
