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
    expect(apiClient.put).toHaveBeenCalledWith(expect.stringContaining('/cast/characters/c1/content-type'), { name: 'The Entertainer' });
    expect(screen.getByText('The Entertainer')).toBeTruthy();
  });

  test('changes to another from the list', async () => {
    apiClient.get.mockResolvedValue({ data: { ...base, current: LIST[0] } });
    apiClient.put.mockResolvedValue({ data: { ...base, current: LIST[1] } });
    render(<KnownFor characterId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Content type'), { target: { value: 'The Educator' } });
    expect(screen.getByText('Tutorials, explainers')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(expect.any(String), { name: 'The Educator' }));
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
