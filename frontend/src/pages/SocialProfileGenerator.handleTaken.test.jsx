/**
 * SocialProfileGenerator — taken-handle flag (Task #1886).
 *
 * Renders the page with the API client mocked and drives the Manual Spark
 * form: an Autofill draft flagged handleTaken disables Create, editing the
 * handle re-enables it, and a 409 from /generate sets the same flag with the
 * server's message.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

vi.mock('../components/FeedBulkImport', () => ({ default: () => null }));
vi.mock('./feed/ProfileCard', () => ({ default: () => null }));
vi.mock('./feed/ProfileDetailPanel', () => ({
  DetailPanel: () => null,
  FeedStatePicker: () => null,
}));
vi.mock('./feed/FeedEnhancements', () => ({
  ProfileComparison: () => null,
  LalaReactions: () => null,
  FeedTimeline: () => null,
  RelationshipWeb: () => null,
}));
vi.mock('./feed/FeedViews', () => ({ default: () => null }));

import apiClient from '../services/api';
import SocialProfileGenerator from './SocialProfileGenerator';

const TAKEN_MSG = '@studiobysable is already taken — change the handle before creating.';

function renderPage() {
  render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Manual Spark/ }));
}

const handleInput = () => screen.getByPlaceholderText('@username');
const vibeInput = () => screen.getByPlaceholderText('One sentence — who is this creator?');
const createButton = () => screen.getByRole('button', { name: /^Generate$/ });

describe('SocialProfileGenerator — taken handle (Task #1886)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
  });

  test('an Autofill draft flagged handleTaken disables Create; editing the handle re-enables it', async () => {
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url.endsWith('/autofill-draft')) {
        return Promise.resolve({ data: { handle: '@studiobysable', platform: 'instagram', vibe: 'Studio owner.', handleTaken: true } });
      }
      return Promise.resolve({ data: {} });
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Autofill/ }));

    await screen.findByText(TAKEN_MSG);
    expect(handleInput().value).toBe('@studiobysable');
    expect(vibeInput().value).toBe('Studio owner.');
    expect(createButton().disabled).toBe(true);
    expect(handleInput().getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(handleInput(), { target: { value: '@studiobysable2' } });

    expect(screen.queryByText(TAKEN_MSG)).toBeNull();
    expect(createButton().disabled).toBe(false);
  });

  test('a 409 from /generate sets the flag with the server message and disables Create', async () => {
    const serverMsg = '@studiobysable belongs to a deleted creator (id 7) — restore or purge it to reuse the handle.';
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url.endsWith('/generate')) {
        const err = new Error('Request failed with status code 409');
        err.response = { status: 409, data: { error: serverMsg, handleTaken: true } };
        return Promise.reject(err);
      }
      return Promise.resolve({ data: {} });
    });
    renderPage();

    fireEvent.change(handleInput(), { target: { value: '@studiobysable' } });
    fireEvent.change(vibeInput(), { target: { value: 'Studio owner.' } });
    expect(createButton().disabled).toBe(false);

    fireEvent.click(createButton());

    await screen.findByText(serverMsg);
    await waitFor(() => expect(createButton().disabled).toBe(true));
    const generateCalls = vi.mocked(apiClient.post).mock.calls.filter(([u]) => u.endsWith('/generate'));
    expect(generateCalls).toHaveLength(1);

    fireEvent.change(handleInput(), { target: { value: '@sable_studio' } });
    expect(screen.queryByText(serverMsg)).toBeNull();
    expect(createButton().disabled).toBe(false);
  });
});
