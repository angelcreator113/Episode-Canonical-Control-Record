/**
 * Edit show (Evoni, 2026-10-07: "i cant edit the show something is wrong
 * with that page and also it needs redesign").
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import api from '../services/api';
import EditShow from './EditShow';

// A show with no category and no tagline: the old page showed "Lifestyle"
// and refused to save it ("Category is required").
const SHOW = { id: 'show-1', name: 'Styling Adventures with Lala', description: '', genre: null, status: 'in_development', icon: '👗', color: '#5B4B8A', metadata: { required_slots: ['body', 'shoes'] } };

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/edit']}>
    <Routes>
      <Route path="/shows/:id/edit" element={<EditShow />} />
      <Route path="/shows" element={<div>All shows</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { status: 'SUCCESS', data: SHOW } });
});

describe('EditShow', () => {
  test('a show with no category or description saves; the body has only the show\'s fields and keeps its settings', async () => {
    api.put.mockImplementation(async (_url, body) => ({ data: { status: 'SUCCESS', data: { ...SHOW, ...body } } }));
    renderPage();
    const name = await screen.findByLabelText('Name *');
    expect(name.value).toBe('Styling Adventures with Lala');
    expect(screen.getByRole('radio', { name: /In development/ }).checked).toBe(true);
    expect(screen.getByTestId('edit-show-save').disabled).toBe(true); // nothing changed yet

    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Every event, a look' } });
    fireEvent.click(screen.getByRole('radio', { name: /Active/ }));
    expect(screen.getByTestId('edit-show-state').textContent).toBe('Unsaved changes');
    fireEvent.click(screen.getByTestId('edit-show-save'));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe('/api/v1/shows/show-1');
    expect(body).toEqual({
      name: 'Styling Adventures with Lala', description: null, genre: null, status: 'active', icon: '👗', color: '#5B4B8A',
      metadata: { required_slots: ['body', 'shoes'], tagline: 'Every event, a look' },
    });
    expect(await screen.findByText('Show saved')).toBeTruthy();
    expect(screen.getByTestId('edit-show-state').textContent).toBe('All changes saved');
  });

  test('an empty name is marked and not sent; a server error stays on the page with the changes kept', async () => {
    renderPage();
    const name = await screen.findByLabelText('Name *');
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('edit-show-save'));
    expect(await screen.findByText('The show needs a name.')).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();

    api.put.mockRejectedValue({ response: { status: 500, data: { error: 'Failed to update show', message: 'name must be unique' } } });
    fireEvent.change(name, { target: { value: 'Taken Name' } });
    fireEvent.click(screen.getByTestId('edit-show-save'));
    await waitFor(() => expect(screen.getByTestId('edit-show-state').textContent).toBe('Another show already has that name.'));
    expect(screen.getByLabelText('Name *').value).toBe('Taken Name');
  });

  test('the cover saves as soon as it is chosen', async () => {
    api.post.mockResolvedValue({ data: { status: 'SUCCESS', data: { coverImageUrl: 'https://img/cover.jpg' } } });
    renderPage();
    await screen.findByLabelText('Name *');
    const file = new File(['x'], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('edit-show-cover-file'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/shows/show-1/cover-image');
    expect(api.post.mock.calls[0][1].get('image')).toBeTruthy();
    expect(await screen.findByRole('img', { name: "The show's cover" })).toBeTruthy();
  });

  test('delete needs the show\'s name typed', async () => {
    api.delete.mockResolvedValue({ data: { status: 'SUCCESS' } });
    renderPage();
    await screen.findByLabelText('Name *');
    const del = screen.getByTestId('edit-show-delete');
    expect(del.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("The show's name, to delete it"), { target: { value: 'Styling Adventures with Lala' } });
    expect(del.disabled).toBe(false);
    fireEvent.click(del);
    expect(await screen.findByText('All shows')).toBeTruthy();
    expect(api.delete).toHaveBeenCalledWith('/api/v1/shows/show-1');
  });

  test('a show that is not found says so', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect((await screen.findByTestId('edit-show-load-error')).textContent).toBe('This show was not found.');
  });
});
