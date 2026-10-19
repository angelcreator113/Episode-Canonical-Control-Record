/**
 * Beat 14's opportunity (Evoni, 2026-10-19): the invitation someone at the
 * event offers, attached in the Script tab's side panel; also its must-cover
 * item and its health row.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import Beat14Opportunity from './Beat14Opportunity';
import { mustCover } from '../../lib/episodeScript';
import { scriptHealth } from '../../lib/scriptHealth';

const URL = '/api/v1/opportunities/show-1/episode/ep-1/beat14';
const PEOPLE = [
  { profile_id: 7, handle: 'sable', name: 'Sable Reyes', role: 'host' },
  { profile_id: 9, handle: 'noor', name: 'Noor', role: 'guest' },
];
const OPP = { id: 'o1', name: 'Studio by Sable campaign', contact_name: 'Sable Reyes', connector_profile_id: 7 };

const renderIt = (data, extra = {}) => {
  const onChange = vi.fn().mockResolvedValue();
  render(<Beat14Opportunity showId="show-1" episodeId="ep-1" data={data} onChange={onChange} {...extra} />);
  return onChange;
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Beat14Opportunity', () => {
  test('makes a new one from someone at the event and attaches it', async () => {
    api.put.mockResolvedValue({ data: {} });
    const onChange = renderIt({ opportunity: null, people: PEOPLE, candidates: [] });
    expect(screen.getByTestId('script-beat14-from').textContent).toContain('Sable Reyes (host)');
    fireEvent.change(screen.getByTestId('script-beat14-name'), { target: { value: '  Campaign shoot ' } });
    fireEvent.change(screen.getByTestId('script-beat14-type'), { target: { value: 'campaign' } });
    fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(URL, { create: { name: 'Campaign shoot', opportunity_type: 'campaign', pitch: '', connector_profile_id: 9 } });
  });

  test('needs who offers it before saving', () => {
    renderIt({ opportunity: null, people: PEOPLE, candidates: [] });
    fireEvent.change(screen.getByTestId('script-beat14-name'), { target: { value: 'Shoot' } });
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    expect(screen.getByTestId('script-beat14-error').textContent).toMatch(/who at the event/);
    expect(api.put).not.toHaveBeenCalled();
  });

  test('attaches one of the open ones', async () => {
    api.put.mockResolvedValue({ data: {} });
    const onChange = renderIt({ opportunity: null, people: PEOPLE, candidates: [{ id: 'o2', name: 'Panel talk' }] });
    fireEvent.click(screen.getByTestId('script-beat14-mode-pick'));
    fireEvent.change(screen.getByTestId('script-beat14-pick'), { target: { value: 'o2' } });
    fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(URL, { opportunity_id: 'o2', connector_profile_id: 7 });
  });

  test('shows what is attached and removes it', async () => {
    api.delete.mockResolvedValue({ data: { opportunity: null } });
    const onChange = renderIt({ opportunity: OPP, people: PEOPLE, candidates: [] });
    expect(screen.getByTestId('script-beat14-attached').textContent).toContain('Studio by Sable campaign · from Sable Reyes');
    expect(screen.getByTestId('script-beat14-attached').textContent).toMatch(/if the episode lands/);
    fireEvent.click(screen.getByTestId('script-beat14-remove'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.delete).toHaveBeenCalledWith(URL);
  });

  test('an episode designed to fail says the invitation does not come', () => {
    renderIt({ opportunity: OPP, people: PEOPLE, candidates: [] }, { designedIntent: 'fail' });
    expect(screen.getByTestId('script-beat14-attached').textContent).toMatch(/does not come in beat 14/);
  });

  test('nobody at the event: says so, no form', () => {
    renderIt({ opportunity: null, people: [], candidates: [] });
    expect(screen.getByTestId('script-beat14-nobody')).toBeTruthy();
    expect(screen.queryByTestId('script-beat14-form')).toBeNull();
  });

  test('a server refusal is shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.put.mockRejectedValue({ response: { data: { error: 'The invitation comes from someone at the event.' } } });
    renderIt({ opportunity: null, people: PEOPLE, candidates: [] });
    fireEvent.change(screen.getByTestId('script-beat14-name'), { target: { value: 'Shoot' } });
    fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(screen.getByTestId('script-beat14-error').textContent).toBe('The invitation comes from someone at the event.'));
    expect(console.error).toHaveBeenCalled();
  });
});

describe('beat 14 in must cover and health', () => {
  const beats = [
    { id: 'b13', number: 13, lines: [] },
    { id: 'b14', number: 14, lines: ['[UI:DM Sable Reyes: I want you for the Studio by Sable campaign.]'] },
  ];

  test('must cover lists the opportunity, ticked by the beat that names it', () => {
    const items = mustCover({ beats, event: null, brief: null, opportunity: { name: 'Studio by Sable campaign' } });
    const opp = items.find((i) => i.key === 'opportunity');
    expect(opp).toMatchObject({ source: 'Opportunity', label: 'Studio by Sable campaign', beat: 14 });
    expect(mustCover({ beats, event: null, brief: null, opportunity: null }).some((i) => i.key === 'opportunity')).toBe(false);
  });

  test('health: none attached, attached, designed to fail, not read', () => {
    const row = (args) => scriptHealth({ beats, ...args }).find((r) => r.key === 'beat14');
    expect(row({ beat14: { opportunity: null } })).toMatchObject({ ok: false, beatId: 'b14' });
    expect(row({ beat14: { opportunity: OPP } }).text).toBe('Beat 14 offers Studio by Sable campaign, from Sable Reyes.');
    expect(row({ beat14: { opportunity: OPP }, designedIntent: 'fail' }).text).toMatch(/does not come/);
    expect(row({ beat14: null })).toBeUndefined();
  });
});
