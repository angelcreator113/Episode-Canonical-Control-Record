/**
 * Template Studio › Style sheets (Evoni, 2026-10-22): the Style Page's
 * designs as templates, each previewed and switched on or off for a show.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import StyleSheetsLibrary from './StyleSheetsLibrary';

const design = (key, name, number) => ({ key, name, number, background: '#FFF9F5', elements: [] });
const DESIGNS = [design('episode_look', 'The Episode Look', '01'), design('style_diary', 'The Style Diary', '02'), design('runway', 'Runway to Reality', '03')];
const SIZES = [{ key: 'pinterest', label: 'Pinterest', width: 1000, height: 1500 }];
const SHOWS = [{ id: 's1', name: 'Styling Adventures with Lala' }, { id: 's2', name: 'Before Lala' }];
const lib = (off = []) => ({ designs: DESIGNS, sizes: SIZES, off });

function routes({ off = { s1: ['runway'], s2: [] } } = {}) {
  api.get.mockImplementation(async (url) => {
    if (url === '/api/v1/shows') return { data: { data: SHOWS } };
    const m = url.match(/^\/api\/v1\/shows\/(s\d)\/style-designs$/);
    if (m) return { data: { data: lib(off[m[1]]) } };
    return { data: {} };
  });
}
const card = (key) => within(screen.getByTestId(`ssl-design-${key}`));

beforeEach(() => { vi.clearAllMocks(); });

describe('Template Studio › Style sheets', () => {
  test("each design previewed with its on/off switch for the show; the count says how many are on", async () => {
    routes();
    render(<StyleSheetsLibrary />);
    await screen.findByTestId('ssl');
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/s1/style-designs');
    expect(screen.getByTestId('ssl-count').textContent).toBe('2 of 3 on for Styling Adventures with Lala');
    expect(card('episode_look').getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(card('runway').getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('ssl-design-runway').className).toContain('is-off');
    expect(card('style_diary').getByTestId('style-design-style_diary')).toBeTruthy();
  });

  test('a switch saves the show\'s off list; a refused save puts it back and says why', async () => {
    routes();
    const say = vi.fn();
    render(<StyleSheetsLibrary say={say} />);
    await screen.findByTestId('ssl');
    api.put.mockResolvedValueOnce({ data: { data: lib([]) } });
    fireEvent.click(card('runway').getByRole('switch'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/s1/style-designs', { off: [] }));
    await waitFor(() => expect(card('runway').getByRole('switch').getAttribute('aria-checked')).toBe('true'));
    expect(say).toHaveBeenCalledWith('ok', 'Runway to Reality is on for this show.');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.put.mockRejectedValueOnce({ response: { data: { error: 'Show not found' } } });
    fireEvent.click(card('style_diary').getByRole('switch'));
    expect(api.put).toHaveBeenLastCalledWith('/api/v1/shows/s1/style-designs', { off: ['style_diary'] });
    await waitFor(() => expect(say).toHaveBeenCalledWith('error', 'Show not found'));
    expect(card('style_diary').getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  test('another show is picked from the list and shows its own choice', async () => {
    routes();
    render(<StyleSheetsLibrary />);
    await screen.findByTestId('ssl');
    fireEvent.change(screen.getByTestId('ssl-show'), { target: { value: 's2' } });
    await waitFor(() => expect(screen.getByTestId('ssl-count').textContent).toBe('3 of 3 on for Before Lala'));
  });

  test('a failed read shows its message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.get.mockRejectedValue({ response: { data: { error: 'Not signed in' } } });
    render(<StyleSheetsLibrary />);
    expect((await screen.findByRole('alert')).textContent).toBe('Not signed in');
  });

  test('its stylesheet is tokens only', () => {
    const css = readFileSync(resolve(__dirname, 'StyleSheetsLibrary.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
  });
});
