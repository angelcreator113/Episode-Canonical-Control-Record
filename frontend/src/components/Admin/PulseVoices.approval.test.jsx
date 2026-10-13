/**
 * Admin › The Pulse › Voices › Approve voice (Task 3029): a voice waits for
 * Evoni's approval before the worker posts for the character; Approve and
 * Withdraw call the API; a voice whose profile changed is rebuilt before it
 * can be approved; rebuilding an approved voice asks first.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseVoices, { approvalState } from './PulseVoices';

const VOICE = { id: 'v1', registry_character_id: 'c1', status: 'built', built_at: '2026-10-12T10:00:00Z', habits: {}, examples: [], approved_at: null, approved_by: null };
const APPROVED = { ...VOICE, approved_at: '2026-10-12T12:00:00Z', approved_by: 'evoni' };
const row = (voice, over = {}) => ({ registry_character_id: 'c1', display_name: 'Marcus', depth_level: 'alive', handle: 'marcus.k', social_profile_id: 3, voice, needs_rebuild: false, ...over });
const renderWith = async (rows) => {
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, banned_phrases: [], characters: rows } });
  render(<PulseVoices showId="show-1" />);
  return within((await screen.findAllByTestId('pulse-voices-card'))[0]);
};

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

describe('Approve voice', () => {
  test('approvalState: none without a voice; waiting; approved by whom and when', () => {
    expect(approvalState(null)).toBeNull();
    expect(approvalState(VOICE)).toEqual({ approved: false, label: 'Waiting for your approval: not posting yet' });
    expect(approvalState(APPROVED)).toEqual({ approved: true, label: 'Approved by evoni on 12 Oct 2026' });
  });

  test('a waiting voice says so; Approve calls the API and shows who approved', async () => {
    api.post.mockResolvedValue({ data: { success: true, voice: APPROVED } });
    const card = await renderWith([row(VOICE)]);
    expect(card.getByTestId('pulse-voices-approval').textContent).toBe('Waiting for your approval: not posting yet');
    fireEvent.click(card.getByRole('button', { name: 'Approve voice' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/v1/approve'));
    await waitFor(() => expect(card.getByTestId('pulse-voices-approval').textContent).toBe('Approved by evoni on 12 Oct 2026'));
    expect(card.queryByRole('button', { name: 'Approve voice' })).toBeNull();
  });

  test('Withdraw approval calls the API', async () => {
    api.post.mockResolvedValue({ data: { success: true, voice: VOICE } });
    const card = await renderWith([row(APPROVED)]);
    fireEvent.click(card.getByRole('button', { name: 'Withdraw approval' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/v1/unapprove'));
    await waitFor(() => expect(card.getByTestId('pulse-voices-approval').textContent).toMatch(/^Waiting/));
  });

  test('a voice whose profile changed is rebuilt before it can be approved; no voice, no approval line', async () => {
    const card = await renderWith([row(VOICE, { needs_rebuild: true }), row(null, { registry_character_id: 'c2', display_name: 'Nia' })]);
    expect(card.getByRole('button', { name: 'Approve voice' }).disabled).toBe(true);
    const nia = within(screen.getAllByTestId('pulse-voices-card')[1]);
    expect(nia.queryByTestId('pulse-voices-approval')).toBeNull();
  });

  test('rebuilding an approved voice asks first, and does nothing if she says no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const card = await renderWith([row(APPROVED)]);
    fireEvent.click(card.getByRole('button', { name: 'Rebuild' }));
    expect(confirm).toHaveBeenCalledWith('A rebuilt voice needs your approval again before automated posting. Rebuild?');
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  test('a refusal shows the message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValue({ response: { status: 403, data: { error: 'Insufficient permissions' } } });
    const card = await renderWith([row(VOICE)]);
    fireEvent.click(card.getByRole('button', { name: 'Approve voice' }));
    expect((await card.findByRole('alert')).textContent).toBe('Insufficient permissions');
  });
});
