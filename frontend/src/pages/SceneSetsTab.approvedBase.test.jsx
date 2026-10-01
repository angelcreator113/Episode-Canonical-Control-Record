/**
 * The location's approved base on Scene Sets (ruling S6 and Evoni's answers
 * of 2026-10-01): "Nothing is approved automatically; Evoni approves each
 * base from Scene Sets." The brief shows an event-dressed version as made
 * from the approved base.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import { ApprovedBaseRow } from './SceneSetsTab';
import SceneBriefConfirm from '../components/SceneBriefConfirm';

const SET = { id: 'set-1', name: 'Glasshouse Hall', world_location_id: 'loc-1', base_still_url: 'https://x/base.jpg' };

describe('ApprovedBaseRow (S6)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: { success: true } });
    vi.mocked(apiClient.delete).mockReset().mockResolvedValue({ data: { success: true } });
  });

  test('a set with a base at a location offers approval; approving calls the route and refreshes', async () => {
    const onRefresh = vi.fn();
    const onToast = vi.fn();
    render(<ApprovedBaseRow set={{ ...SET, base_approved: false, location_approved_base: null }} onRefresh={onRefresh} onToast={onToast} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve as the location's base/ }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/approve-base', {});
    expect(onToast).toHaveBeenCalledWith('Glasshouse Hall is now the location\'s approved base');
  });

  test('the approved set shows its badge and can be un-approved', async () => {
    const onRefresh = vi.fn();
    render(<ApprovedBaseRow set={{ ...SET, base_approved: true, location_approved_base: { scene_set_id: 'set-1' } }} onRefresh={onRefresh} />);
    expect(screen.getByText('Approved base')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Un-approve' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/approve-base');
  });

  test('another set at an approved location says its event versions come from that base; no approval offered', () => {
    render(<ApprovedBaseRow set={{ ...SET, id: 'set-2', base_approved: false, location_approved_base: { scene_set_id: 'set-1' } }} />);
    expect(screen.getByText(/made from this location's approved base/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('no location or no base: nothing to approve', () => {
    const { container } = render(<ApprovedBaseRow set={{ ...SET, world_location_id: null }} />);
    expect(container.textContent).toBe('');
  });

  test('a refusal is shown', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { error: 'The Glasshouse already has an approved base. Un-approve it first.' } } });
    const onToast = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ApprovedBaseRow set={{ ...SET, base_approved: false, location_approved_base: null }} onToast={onToast} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('The Glasshouse already has an approved base. Un-approve it first.', 'error'));
  });
});

describe('the brief of an event-dressed version (S6)', () => {
  test('says it is made from the approved base, with the image', async () => {
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: { success: true, data: {
      target: { kind: 'base' },
      brief: {
        version: 1, mode: 'event_dressing', approved_base: { scene_set_id: 'set-1', image_url: 'https://x/base.jpg' },
        lines: [{ layer: 'event', key: 'concept', label: 'Event', text: 'Dressed for Velour Launch.', source: 'event', essential: true }],
        rules: [], missing: [], overrides: {}, event_id: 'ev-1',
      },
      estimate: { usd: 0.04, priced: true, base_model: 'flux-kontext' },
    } } });
    render(<SceneBriefConfirm setId="set-2" title="t" onConfirm={() => {}} onCancel={() => {}} />);
    const note = await screen.findByTestId('sbc-dressing');
    expect(note.textContent).toMatch(/approved base image with Flux Kontext. Only the event layer is sent/);
    expect(note.querySelector('img').getAttribute('src')).toBe('https://x/base.jpg');
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.04');
  });
});
