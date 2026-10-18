/**
 * Known for on The Pulse (services/characterContentType): shown next to
 * their job; Suggest proposes one with why (and the job-vs-content gap);
 * nothing is saved until Save.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import apiClient from '../../services/api';
import KnownFor from './KnownFor';

const LIST = [
  { name: 'The Entertainer', content: 'Comedy, skits, memes' },
  { name: 'The Educator', content: 'Tutorials, explainers' },
];
const base = { list: LIST, occupation: 'ICU nurse', profile: { id: 'p1', handle: '@dana', display_name: 'Dana' } };

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
});

describe('KnownFor', () => {
  test('shows none yet next to their job, suggests one, and saves only on Save', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, current: null } });
    apiClient.post.mockResolvedValue({ data: { suggestion: { name: 'The Entertainer', why: 'Her persona is comedy.', differs_from_job: true, tension: 'She jokes about the job wearing her down.' } } });
    apiClient.put.mockResolvedValue({ data: { ...base, current: LIST[0] } });
    render(<KnownFor characterId="c1" />);
    expect(await screen.findByText('Not set')).toBeTruthy();
    expect(screen.getByText(/Their job is ICU nurse/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Suggest what they’re known for' }));
    await screen.findByText('Job vs content: She jokes about the job wearing her down.');
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Content type').value).toBe('The Entertainer');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(apiClient.put).toHaveBeenCalledWith(expect.stringContaining('/cast/characters/c1/content-type'), { name: 'The Entertainer', gap: 'She jokes about the job wearing her down.' });
    expect(screen.getByText('The Entertainer')).toBeTruthy();
  });

  test('changes to another from the list', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, current: LIST[0] } });
    apiClient.put.mockResolvedValue({ data: { ...base, current: LIST[1] } });
    render(<KnownFor characterId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Content type'), { target: { value: 'The Educator' } });
    expect(screen.getByText('Tutorials, explainers')).toBeTruthy();
    // A change asks rebrand or correction; a correction is the default.
    expect(screen.getByTestId('kf-change').textContent).toContain('From The Entertainer to The Educator');
    expect(screen.getByLabelText(/A correction: they were always this/).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(expect.any(String), { name: 'The Educator', gap: null, rebrand: false, reason: null }));
    expect(await screen.findByText('Saved as a correction.')).toBeTruthy();
  });

  // Idea 2 (2026-10-18): a content type that changes over time.
  test('a rebrand is saved with why; it happens now in the story', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, current: LIST[0] } });
    apiClient.put.mockResolvedValue({ data: { ...base, current: LIST[1] } });
    render(<KnownFor characterId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Content type'), { target: { value: 'The Educator' } });
    fireEvent.click(screen.getByLabelText(/A rebrand: they change now, in the story/));
    expect(screen.getByLabelText(/A rebrand/).textContent || screen.getByTestId('kf-change').textContent).toContain('Their earlier posts stay The Entertainer');
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: ' After the burnout post went viral, she started teaching. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(expect.any(String), {
      name: 'The Educator', gap: null, rebrand: true, reason: 'After the burnout post went viral, she started teaching.',
    }));
    expect(await screen.findByText('Saved as a rebrand at this point in the story.')).toBeTruthy();
  });

  test('keeping the same type asks nothing about a change', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, current: LIST[0] } });
    render(<KnownFor characterId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    expect(screen.queryByTestId('kf-change')).toBeNull();
  });

  test('shows the job-vs-content gap, and edits it with the type (a story hook for the writers)', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, current: LIST[0], gap: 'Jokes so nobody asks.' } });
    apiClient.put.mockResolvedValue({ data: { ...base, current: LIST[0], gap: 'Jokes so nobody asks how she is.' } });
    render(<KnownFor characterId="c1" />);
    expect((await screen.findByTestId('kf-gap')).textContent).toBe('Job vs content: Jokes so nobody asks.');
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const box = screen.getByLabelText(/Job vs content: what the gap says about them/);
    expect(box.value).toBe('Jokes so nobody asks.');
    fireEvent.change(box, { target: { value: 'Jokes so nobody asks how she is.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(expect.any(String), { name: 'The Entertainer', gap: 'Jokes so nobody asks how she is.' }));
    expect((await screen.findByTestId('kf-gap')).textContent).toBe('Job vs content: Jokes so nobody asks how she is.');
  });

  test('shows nothing for a character with no feed profile, and says why a suggestion failed', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, profile: null, current: null } });
    const { container } = render(<KnownFor characterId="c1" />);
    await waitFor(() => expect(container.textContent).toBe(''));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.get.mockResolvedValue({ data: { ...base, current: null } });
    apiClient.post.mockRejectedValue({ response: { data: { error: 'There is nothing written about them yet.' } } });
    render(<KnownFor characterId="c2" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suggest what they’re known for' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    spy.mockRestore();
  });
});
