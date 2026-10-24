/**
 * TemplateStudio on the page (Evoni, 2026-10-21: fix the Templates page;
 * rename templates): Rename in place, Lock and Unlock, and the Yes / No row
 * and message line that replace confirm() and alert().
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

vi.mock('../lib/picturePreview', () => ({ usePreview: (url) => url, previewUrl: (url) => Promise.resolve(url), previewWidth: () => 800 }));

import apiClient from '../services/api';
import TemplateStudio from './TemplateStudio';

const template = (over = {}) => ({
  id: 't-1', name: 'Glam Look', version: 1, status: 'DRAFT', locked: false,
  canvas_config: { width: 1280, height: 720 }, role_slots: [], formats_supported: ['YOUTUBE'],
  created_at: '2026-10-21T00:00:00Z', ...over,
});

const show = async (list) => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: list } });
  // The layouts are the third tab (2026-10-22); ?view=layouts opens them.
  render(<MemoryRouter initialEntries={['/template-studio?view=layouts']}><TemplateStudio /></MemoryRouter>);
  await screen.findByRole('heading', { level: 2, name: list[0].name });
};

describe('TemplateStudio page', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(window, 'alert').mockImplementation(() => { throw new Error('alert() is not used'); });
    vi.spyOn(window, 'confirm').mockImplementation(() => { throw new Error('confirm() is not used'); });
  });

  test('Rename: type a new name, Save; the page says so and lists again', async () => {
    await show([template(), template({ id: 't-2', version: 2 })]);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    // The box shows after the click; on a busy runner that can take a moment.
    const box = await screen.findByRole('textbox', { name: 'Template name' }, { timeout: 3000 });
    expect(screen.getByText('All 2 versions take the new name.')).toBeTruthy();
    fireEvent.change(box, { target: { value: '  Cozy Glam  ' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { name: 'Cozy Glam' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/template-studio/t-1/name', { name: 'Cozy Glam' }));
    expect((await screen.findByRole('status', {}, { timeout: 3000 })).textContent).toContain('Renamed to "Cozy Glam".');
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });

  test('Rename: Escape cancels; a taken name shows the server\'s reason', async () => {
    await show([template()]);
    fireEvent.doubleClick(screen.getByRole('heading', { level: 2, name: 'Glam Look' }));
    fireEvent.keyDown(await screen.findByRole('textbox', { name: 'Template name' }, { timeout: 3000 }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Template name' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Template name' }, { timeout: 3000 }), { target: { value: 'Haul' } });
    vi.mocked(apiClient.patch).mockRejectedValue({ response: { status: 409, data: { message: 'That name is taken' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('That name is taken');
    expect(screen.getByRole('textbox', { name: 'Template name' }).value).toBe('Haul');
  });

  test('Lock asks first; Yes locks. A locked template unlocks without asking', async () => {
    await show([template()]);
    fireEvent.click(screen.getByRole('button', { name: /^lock$/i }));
    expect(screen.getByText(/cannot be edited, renamed or deleted/)).toBeTruthy();
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/t-1/lock'));
    expect((await screen.findByRole('status')).textContent).toContain('"Glam Look" is locked.');
  });

  test('a locked draft: Edit, Delete and Rename are off; Unlock unlocks', async () => {
    await show([template({ locked: true })]);
    expect(screen.getByRole('button', { name: /edit/i }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /delete/i }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /rename/i }).disabled).toBe(true);
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/template-studio/t-1/unlock'));
  });

  test('Delete asks on the page; No leaves it, Yes deletes', async () => {
    await show([template()]);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(apiClient.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/template-studio/t-1'));
    expect((await screen.findByRole('status')).textContent).toContain('"Glam Look" v1 is deleted.');
  });

  test('a failed action shows its reason in the message line', async () => {
    await show([template({ status: 'PUBLISHED' })]);
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }));
    vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { message: 'Template is already archived' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Template is already archived');
  });

  test('YouTube thumbnails opens first: every show\'s templates as picture cards; Open, Rename, Make default and Delete behind ⋯', async () => {
    const groups = [{ show: { id: 's-1', name: 'Styling Adventures' }, templates: [
      { id: 't-1', name: 'Come Style Me', isDefault: true, previewUrl: 'https://b.s3.amazonaws.com/t1.jpg' },
      { id: 't-2', name: 'Haul', isDefault: false, previewUrl: null },
    ] }];
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      data: { data: String(url).includes('youtube-thumbnails/templates') ? groups : [template()] },
    }));
    render(<MemoryRouter><TemplateStudio /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 2, name: 'Styling Adventures' })).toBeTruthy();
    expect(screen.getByTestId('ts-show-templates-btn').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { level: 1, name: 'Template Studio' })).toBeTruthy();
    const first = screen.getByTestId('ts-show-template-t-1');
    expect(first.querySelector('img').getAttribute('src')).toBe('https://b.s3.amazonaws.com/t1.jpg');
    expect(within(first).getByText('Default')).toBeTruthy();
    expect(within(first).getByRole('link', { name: 'Come Style Me' }).getAttribute('href')).toBe('/template-studio/youtube?show=s-1&template=t-1');
    fireEvent.click(within(first).getByRole('button', { name: 'Come Style Me options' }));
    expect(within(first).getByRole('link', { name: 'Open' }).getAttribute('href'))
      .toBe('/template-studio/youtube?show=s-1&template=t-1');
    // The default is already the default.
    expect(within(first).queryByRole('button', { name: 'Make default' })).toBeNull();
    expect(screen.getByTestId('ts-show-new').getAttribute('href')).toBe('/template-studio/youtube');
    const haul = screen.getByTestId('ts-show-template-t-2');
    fireEvent.click(within(haul).getByRole('button', { name: 'Haul options' }));
    fireEvent.click(within(haul).getByRole('button', { name: 'Rename' }));
    fireEvent.change(within(haul).getByRole('textbox', { name: 'New name for Haul' }), { target: { value: 'Big Haul' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: {} } });
    fireEvent.click(within(haul).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/youtube-thumbnails/shows/s-1/templates/t-2', { name: 'Big Haul' }, expect.anything()));
    expect((await screen.findByRole('status')).textContent).toContain('Renamed to "Big Haul".');
  });
  test('Layouts: status chips replace the side menu; tapping a card opens its preview sheet (phone), Close shuts it', async () => {
    await show([template(), template({ id: 't-2', name: 'Big Haul', status: 'PUBLISHED' })]);
    expect(screen.getByTestId('ts-layouts-btn').getAttribute('aria-selected')).toBe('true');
    const chips = within(screen.getByRole('group', { name: 'Status' }));
    expect(chips.getByRole('button', { name: /Published 1/ })).toBeTruthy();
    fireEvent.click(chips.getByRole('button', { name: /Published/ }));
    expect(screen.queryByRole('button', { name: /Glam Look/ })).toBeNull();
    fireEvent.click(chips.getByRole('button', { name: /All Templates/ }));
    const panel = () => screen.getByRole('region', { name: /^Preview:/ });
    expect(panel().className).not.toContain('is-open');
    fireEvent.click(screen.getByRole('button', { name: /Big Haul/ }));
    expect(panel().className).toContain('is-open');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Close the preview' }));
    expect(panel().className).not.toContain('is-open');
  });

  test('Make default and Delete (asked first) from a thumbnail template\'s ⋯', async () => {
    const groups = [{ show: { id: 's-1', name: 'Styling Adventures' }, templates: [
      { id: 't-1', name: 'Come Style Me', isDefault: true, previewUrl: null },
      { id: 't-2', name: 'Haul', isDefault: false, previewUrl: null },
    ] }];
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: { data: String(url).includes('youtube-thumbnails/templates') ? groups : [] } }));
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: {} } });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { data: {} } });
    render(<MemoryRouter><TemplateStudio /></MemoryRouter>);
    const haul = await screen.findByTestId('ts-show-template-t-2');
    fireEvent.click(within(haul).getByRole('button', { name: 'Haul options' }));
    fireEvent.click(within(haul).getByRole('button', { name: 'Make default' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/youtube-thumbnails/shows/s-1/templates/t-2', { isDefault: true }, expect.anything()));
    fireEvent.click(within(screen.getByTestId('ts-show-template-t-2')).getByRole('button', { name: 'Haul options' }));
    fireEvent.click(within(screen.getByTestId('ts-show-template-t-2')).getByRole('button', { name: 'Delete' }));
    expect(apiClient.delete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByTestId('ts-show-template-t-2')).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/youtube-thumbnails/shows/s-1/templates/t-2'));
  });

  test('Style sheets in the rail, and ?view=style opens it: the Style Page designs, on or off for the show', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { data: [{ id: 's-1', name: 'Styling Adventures with Lala' }] } };
      if (url === '/api/v1/shows/s-1/style-designs') {
        return { data: { data: { designs: [{ key: 'runway', name: 'Runway to Reality', number: '03', background: '#FFF9F5', elements: [] }], sizes: [], off: [] } } };
      }
      return { data: { data: [] } };
    });
    render(<MemoryRouter initialEntries={['/template-studio?view=style']}><TemplateStudio /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 2, name: 'Style sheets' })).toBeTruthy();
    expect(screen.getByTestId('ts-style-sheets-btn').getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByTestId('ssl-design-runway')).toBeTruthy();
  });
});
