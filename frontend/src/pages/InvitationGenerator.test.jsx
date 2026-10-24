/**
 * InvitationButton (2026-10-24, the invitation versions rework): Generate
 * opens options with the look and cost before anything is spent; the slow
 * actions run as a job followed on its stream; several variants are offered
 * to choose from; an edit is saved as a new version and says when its words
 * no longer state the terms; a failed reject is shown, not swallowed.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const streams = [];
vi.mock('../utils/authedEventStream', () => ({
  openAuthedEventStream: vi.fn((url, opts) => {
    const s = { url, opts, close: vi.fn() };
    streams.push(s);
    return s;
  }),
}));

import api from '../services/api';
import { InvitationButton, moneyNote, versionNote } from './InvitationGenerator';

const EVENT = { id: 'evt-1', name: 'Golden Hour Gala', host_brand: 'Lumi', invitation_asset_id: null, invitation_url: null };
const ESTIMATE = {
  variants: 2, imagesUsd: 0.1, brandReference: true, brandReferenceAvailable: true, provider: { ready: true },
  direction: { theme: 'honey luxe', themeSource: 'manual', palette: ['gold'] }, style: { theme: 'honey luxe' },
};
const frame = (data) => ({ data: JSON.stringify(data) });

beforeEach(() => {
  vi.clearAllMocks();
  streams.length = 0;
  api.post.mockImplementation((url) => {
    if (url.endsWith('/invitation-estimate')) return Promise.resolve({ data: { data: ESTIMATE } });
    if (url.endsWith('/generate-invitation')) return Promise.resolve({ data: { jobId: 'job-1' } });
    return Promise.resolve({ data: {} });
  });
});

describe('InvitationButton', () => {
  test('generate: options show the look and cost, the job streams progress, variants are offered, approve sends the picked one', async () => {
    const onGenerated = vi.fn();
    render(<InvitationButton event={EVENT} showId="show-1" mode="inline" onGenerated={onGenerated} />);

    fireEvent.click(screen.getByText(/Generate Invitation/));
    await waitFor(() => expect(screen.getByTestId('invitation-estimate').textContent).toContain('About $0.10'));
    expect(screen.getByTestId('invitation-estimate').textContent).toContain('honey luxe');
    expect(screen.getByText(/Match Lumi's house style/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByTestId('invitation-generate-go'));

    await waitFor(() => expect(streams).toHaveLength(1));
    const genCall = api.post.mock.calls.find(([u]) => u.endsWith('/generate-invitation'));
    expect(genCall[1]).toMatchObject({ async: true, variants: 2, useBrandStyle: true });
    expect(streams[0].url).toBe('/api/v1/world/show-1/invitation-jobs/job-1/stream');

    streams[0].opts.handlers.progress(frame({ step: 'background', message: 'Designing background 1 of 2' }));
    await waitFor(() => expect(screen.getAllByText(/Designing background 1 of 2/).length).toBeGreaterThan(0));

    streams[0].opts.handlers.done(frame({ status: 'done', result: { versions: [
      { assetId: 'a1', imageUrl: 'https://x/a1.png', moneyCheck: { ok: true, missing: [], invented: [] } },
      { assetId: 'a2', imageUrl: 'https://x/a2.png', moneyCheck: { ok: true, missing: [], invented: [] } },
    ] } }));
    await waitFor(() => expect(screen.getByTestId('invitation-choices')).toBeTruthy());
    expect(streams[0].close).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Variant 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events/evt-1/approve-invitation', { assetId: 'a2' }));
    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('https://x/a2.png', 'a2', expect.any(Object)));
  });

  test('a failed job shows its error with a Retry', async () => {
    render(<InvitationButton event={EVENT} showId="show-1" mode="inline" />);
    fireEvent.click(screen.getByText(/Generate Invitation/));
    fireEvent.click(await screen.findByTestId('invitation-generate-go'));
    await waitFor(() => expect(streams).toHaveLength(1));
    streams[0].opts.handlers.failed(frame({ status: 'failed', error: "Today's image budget is used up", errorStatus: 429 }));
    await waitFor(() => expect(screen.getByText(/image budget is used up/)).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  test('edit text saves a new version and says when the words drop an amount', async () => {
    api.get.mockResolvedValue({ data: { invitation_text: { opening: 'Hi', body: 'B', closing: 'C' } } });
    api.post.mockImplementation((url) => {
      if (url.endsWith('/edit-invitation-text')) {
        return Promise.resolve({ data: { assetId: 'a9', imageUrl: 'https://x/a9.png', moneyCheck: { ok: false, missing: [500], invented: [] } } });
      }
      return Promise.resolve({ data: {} });
    });
    const approved = { ...EVENT, invitation_asset_id: 'a1', invitation_url: 'https://x/a1.png' };
    render(<InvitationButton event={approved} showId="show-1" mode="inline" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit text' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/events/evt-1/invitation-text', { params: { assetId: 'a1' } }));
    fireEvent.click(screen.getByText('Save as new version'));
    await waitFor(() => expect(screen.getByTestId('invitation-notice').textContent).toContain('leave out 500 Prime Coins'));
    // The new version is pending: Approve is offered.
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
  });

  test('a failed reject is shown, not swallowed', async () => {
    api.post.mockImplementation((url) => {
      if (url.endsWith('/reject-invitation')) return Promise.reject({ response: { data: { error: 'This is the approved invitation.' } } });
      if (url.endsWith('/generate-invitation')) return Promise.resolve({ data: { data: { versions: [{ assetId: 'a1', imageUrl: 'https://x/a1.png' }] } } });
      return Promise.resolve({ data: { data: ESTIMATE } });
    });
    render(<InvitationButton event={EVENT} showId="show-1" mode="inline" />);
    fireEvent.click(screen.getByText(/Generate Invitation/));
    fireEvent.click(await screen.findByTestId('invitation-generate-go'));
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.getByText('This is the approved invitation.')).toBeTruthy());
  });
});

describe('notes', () => {
  test('moneyNote names what is missing and what is invented', () => {
    expect(moneyNote({ ok: false, missing: [1500], invented: [200] }))
      .toBe("These words leave out 1,500 Prime Coins and name 200 Prime Coins, which the terms don't.");
    expect(moneyNote({ ok: true, missing: [], invented: [] })).toBeNull();
  });

  test('versionNote explains the plain wording fallback', () => {
    expect(versionNote({ textSource: 'fallback' })).toMatch(/plain wording/);
  });
});
