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
  render(<MemoryRouter><TemplateStudio /></MemoryRouter>);
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
    const box = screen.getByRole('textbox', { name: 'Template name' });
    expect(screen.getByText('All 2 versions take the new name.')).toBeTruthy();
    fireEvent.change(box, { target: { value: '  Cozy Glam  ' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { name: 'Cozy Glam' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/template-studio/t-1/name', { name: 'Cozy Glam' }));
    expect((await screen.findByRole('status')).textContent).toContain('Renamed to "Cozy Glam".');
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  test('Rename: Escape cancels; a taken name shows the server\'s reason', async () => {
    await show([template()]);
    fireEvent.doubleClick(screen.getByRole('heading', { level: 2, name: 'Glam Look' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Template name' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Template name' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Template name' }), { target: { value: 'Haul' } });
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

  test('Show templates: every show\'s, with pictures; Open goes to the Studio on that template; rename here', async () => {
    const groups = [{ show: { id: 's-1', name: 'Styling Adventures' }, templates: [
      { id: 't-1', name: 'Come Style Me', isDefault: true, previewUrl: 'https://b.s3.amazonaws.com/t1.jpg' },
      { id: 't-2', name: 'Haul', isDefault: false, previewUrl: null },
    ] }];
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      data: { data: String(url).includes('youtube-thumbnails/templates') ? groups : [template()] },
    }));
    render(<MemoryRouter><TemplateStudio /></MemoryRouter>);
    await screen.findByRole('heading', { level: 2, name: 'Glam Look' });
    fireEvent.click(screen.getByTestId('ts-show-templates-btn'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Styling Adventures' })).toBeTruthy();
    const first = screen.getByTestId('ts-show-template-t-1');
    expect(first.querySelector('img').getAttribute('src')).toBe('https://b.s3.amazonaws.com/t1.jpg');
    expect(within(first).getByRole('link', { name: 'Open' }).getAttribute('href'))
      .toBe('/template-studio/youtube?show=s-1&template=t-1');
    const haul = screen.getByTestId('ts-show-template-t-2');
    fireEvent.click(within(haul).getByRole('button', { name: 'Rename' }));
    fireEvent.change(within(haul).getByRole('textbox', { name: 'New name for Haul' }), { target: { value: 'Big Haul' } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: {} } });
    fireEvent.click(within(haul).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/youtube-thumbnails/shows/s-1/templates/t-2', { name: 'Big Haul' }, expect.anything()));
    expect((await screen.findByRole('status')).textContent).toContain('Renamed to "Big Haul".');
  });
});
