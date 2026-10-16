/**
 * Writing tools say on screen when something fails (Evoni, 2026-10-16):
 * Texture Review, Memory Bank, Story Evaluation's book and chapter pickers,
 * and Story Evaluation has a sidebar row.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni', email: 'e@x.dev' }, logout: vi.fn() }) }));

import apiClient from '../services/api';
import TextureReviewPage from './TextureReviewPage';
import MemoryBankView from '../components/MemoryBankView';
import Sidebar from '../components/layout/Sidebar';

const fail = (msg) => Object.assign(new Error('Request failed'), { response: { data: { error: msg } } });

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const renderTexture = () => render(
  <MemoryRouter initialEntries={['/texture/3?char=lala']}>
    <Routes><Route path="/texture/:storyNumber" element={<TextureReviewPage />} /></Routes>
  </MemoryRouter>);

describe('Texture Review', () => {
  test('a failed load says why instead of "No texture found"', async () => {
    apiClient.get.mockRejectedValue(fail('Not signed in'));
    renderTexture();
    expect((await screen.findByRole('alert')).textContent).toBe('Not signed in');
    expect(screen.queryByText(/No texture found/)).toBeNull();
  });

  test('a failed Confirm All shows an error', async () => {
    apiClient.get.mockResolvedValue({ data: { texture: { inner_thought_text: 'x', body_narrator_text: 'y' } } });
    apiClient.post.mockRejectedValue(fail('boom'));
    renderTexture();
    fireEvent.click(await screen.findByText('Confirm All'));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not confirm the layers.');
  });
});

describe('Memory Bank', () => {
  test('a failed load shows the error with Try again, which reloads', async () => {
    apiClient.get.mockResolvedValue({ data: { registries: [] } });
    apiClient.request.mockRejectedValueOnce(fail('Book not found'))
      .mockResolvedValueOnce({ data: { memories: [] } });
    render(<MemoryBankView bookId="b1" />);
    expect((await screen.findByRole('alert')).textContent).toBe('Book not found');
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('No memories yet')).toBeTruthy();
    expect(apiClient.request).toHaveBeenCalledTimes(2);
  });
});

describe('Sidebar', () => {
  test('Story Evaluation has a row under Stories', async () => {
    apiClient.get.mockResolvedValue({ data: { success: true, data: [] } });
    render(<MemoryRouter initialEntries={['/story-evaluation']}><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Stories'));
    await waitFor(() => expect(screen.getByText('Story Evaluation').closest('a').getAttribute('href')).toBe('/story-evaluation'));
  });
});
