/** The short story's beat 11 piece: cut it, edit it, keep it (Evoni, 2026-10-15). */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
import apiClient from '../services/api';
import Beat11Piece from './Beat11Piece';

beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

test('cuts the piece, then saves an edit', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { excerpt: null } });
  vi.mocked(apiClient.post).mockResolvedValue({ data: { excerpt: { text: 'The lights went out at nine.', why: 'Who took the necklace?' } } });
  vi.mocked(apiClient.put).mockImplementation(async (_u, { text }) => ({ data: { excerpt: { text, why: 'Who took the necklace?' } } }));
  render(<Beat11Piece storyId="st1" />);
  fireEvent.click(await screen.findByText('Cut the beat 11 piece'));
  const box = await screen.findByLabelText('Beat 11 piece');
  expect(box.value).toBe('The lights went out at nine.');
  expect(screen.getByText(/Leaves them asking: Who took the necklace\?/)).toBeTruthy();
  fireEvent.change(box, { target: { value: 'At nine, the lights went out.' } });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/book-from-show/stories/st1/beat11-excerpt', { text: 'At nine, the lights went out.' }));
});

test('a saved piece loads; a failed cut says so', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(apiClient.get).mockResolvedValue({ data: { excerpt: { text: 'Saved piece.' } } });
  vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { error: 'The short story has no text yet.' } } });
  render(<Beat11Piece storyId="st1" />);
  expect((await screen.findByLabelText('Beat 11 piece')).value).toBe('Saved piece.');
  fireEvent.click(screen.getByText('Cut again'));
  expect((await screen.findByRole('alert')).textContent).toBe('The short story has no text yet.');
});
