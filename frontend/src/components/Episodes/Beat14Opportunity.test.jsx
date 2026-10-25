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
const OPP = { id: 'o1', name: 'Studio by Sable campaign', status: 'held', contact_name: 'Sable Reyes', connector_profile_id: 7 };

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
    fireEvent.click(screen.getByTestId('script-beat14-pick-o2').querySelector('input'));
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
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      fireEvent.click(screen.getByTestId('script-beat14-remove'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(api.delete).toHaveBeenCalledWith(URL);
    } finally { confirm.mockRestore(); }
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

  test('after completion the card says what happened', () => {
    renderIt({ opportunity: { ...OPP, status: 'expired' }, people: PEOPLE, candidates: [] }, { designedIntent: 'pass' });
    expect(screen.getByTestId('script-beat14-attached').textContent).toMatch(/did not land.*expired/);
    // Final once offered or expired (Script tab audit 6, 2026-10-24).
    expect(screen.queryByTestId('script-beat14-change')).toBeNull();
    expect(screen.queryByTestId('script-beat14-remove')).toBeNull();
  });

  // Evoni, 2026-10-23: one released or scheduled early from the show tab.
  test('one offered by hand says so, even on a design-to-fail episode', () => {
    renderIt({ opportunity: { ...OPP, status: 'booked', released: true, completion_status: 'offered' }, people: PEOPLE, candidates: [] }, { designedIntent: 'fail' });
    expect(screen.getByTestId('script-beat14-attached').textContent).toContain('It was offered by hand from the Opportunities tab');
  });

  test('one offered at completion says that', () => {
    renderIt({ opportunity: { ...OPP, status: 'offered', released: false }, people: PEOPLE, candidates: [] });
    expect(screen.getByTestId('script-beat14-attached').textContent).toContain('It was offered when the episode was completed.');
    expect(screen.queryByTestId('script-beat14-change')).toBeNull();
  });

  // Change keeps what is attached (Script page audit, 2026-10-19).
  test('Change opens on the attached one and its sender, so only the sender changes', async () => {
    api.put.mockResolvedValue({ data: {} });
    const onChange = renderIt({ opportunity: OPP, people: PEOPLE, candidates: [{ id: 'o2', name: 'Panel talk' }] });
    fireEvent.click(screen.getByTestId('script-beat14-change'));
    expect(screen.getByTestId('script-beat14-mode-pick').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('script-beat14-pick-o1').querySelector('input').checked).toBe(true);
    expect(screen.getByTestId('script-beat14-pick').textContent).toContain('Studio by Sable campaign (attached)');
    expect(screen.getByTestId('script-beat14-pick').textContent).toContain('Panel talk');
    expect(screen.getByTestId('script-beat14-from').value).toBe('7');
    fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(URL, { opportunity_id: 'o1', connector_profile_id: 9 });
  });

  test('Cancel puts the attached one back', () => {
    renderIt({ opportunity: OPP, people: PEOPLE, candidates: [] });
    fireEvent.click(screen.getByTestId('script-beat14-change'));
    expect(screen.queryByTestId('script-beat14-attached')).toBeNull();
    fireEvent.click(screen.getByTestId('script-beat14-cancel'));
    expect(screen.getByTestId('script-beat14-attached')).toBeTruthy();
  });

  test('Change with nobody at the event still has Cancel, so it is never stuck', () => {
    renderIt({ opportunity: OPP, people: [], candidates: [] });
    fireEvent.click(screen.getByTestId('script-beat14-change'));
    expect(screen.getByTestId('script-beat14-nobody')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-beat14-cancel'));
    expect(screen.getByTestId('script-beat14-attached')).toBeTruthy();
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
    // Named in beat 13 only, it is not delivered (Script page audit, 2026-10-19).
    const early = [{ id: 'b13', number: 13, lines: [beats[1].lines[0]] }, { id: 'b14', number: 14, lines: ['Me: and?'] }];
    expect(mustCover({ beats: early, opportunity: { name: 'Studio by Sable campaign' } }).find((i) => i.key === 'opportunity').beat).toBeNull();
  });

  test('health: none attached, attached, designed to fail, not read', () => {
    const row = (args) => scriptHealth({ beats, ...args }).find((r) => r.key === 'beat14');
    // Optional (Evoni, 2026-10-19; Script page audit 4): a note, not a thing to check.
    expect(row({ beat14: { opportunity: null } })).toMatchObject({ ok: true, beatId: 'b14' });
    expect(row({ beat14: { opportunity: OPP } }).text).toBe('Beat 14 offers Studio by Sable campaign, from Sable Reyes.');
    // Designed to fail, a beat 14 that delivers it is flagged (Script page audit, 2026-10-19).
    expect(row({ beat14: { opportunity: OPP }, designedIntent: 'fail' })).toMatchObject({ ok: false, text: 'Beat 14 delivers Studio by Sable campaign, but the episode is designed to fail: the invitation does not come.' });
    expect(row({ beat14: null })).toBeUndefined();
  });
});

describe('third pass (Script page audit 3, 2026-10-19)', () => {
  test('Remove asks first, saying it may be deleted; No sends nothing', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderIt({ opportunity: OPP, people: PEOPLE, candidates: [] });
      fireEvent.click(screen.getByTestId('script-beat14-remove'));
      expect(confirm.mock.calls[0][0]).toBe('Remove Studio by Sable campaign from beat 14? Studio by Sable campaign goes back to its earlier status, or is deleted if it was made for beat 14.');
      expect(api.delete).not.toHaveBeenCalled();
    } finally { confirm.mockRestore(); }
  });

  test('Change to another one asks first, with the show tab\'s words; No sends nothing', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      renderIt({ opportunity: OPP, people: PEOPLE, candidates: [{ id: 'o2', name: 'Panel talk' }] });
      fireEvent.click(screen.getByTestId('script-beat14-change'));
      fireEvent.click(screen.getByTestId('script-beat14-pick-o2').querySelector('input'));
      fireEvent.click(screen.getByTestId('script-beat14-save'));
      expect(confirm.mock.calls[0][0]).toMatch(/^Beat 14 of this episode already offers Studio by Sable campaign; attaching replaces it\. .*deleted if it was made for beat 14\. Save the new one instead\?$/);
      expect(api.put).not.toHaveBeenCalled();
    } finally { confirm.mockRestore(); }
  });

  test('changing only who offers it saves without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    api.put.mockResolvedValue({ data: {} });
    try {
      const onChange = renderIt({ opportunity: OPP, people: PEOPLE, candidates: [] });
      fireEvent.click(screen.getByTestId('script-beat14-change'));
      fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '9' } });
      fireEvent.click(screen.getByTestId('script-beat14-save'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(confirm).not.toHaveBeenCalled();
    } finally { confirm.mockRestore(); }
  });

  test('Change focuses the form; Cancel and Save give focus back to Change', async () => {
    api.put.mockResolvedValue({ data: {} });
    renderIt({ opportunity: OPP, people: PEOPLE, candidates: [] });
    fireEvent.click(screen.getByTestId('script-beat14-change'));
    expect(document.activeElement).toBe(screen.getByTestId('script-beat14-pick-o1').querySelector('input'));
    fireEvent.click(screen.getByTestId('script-beat14-cancel'));
    expect(document.activeElement).toBe(screen.getByTestId('script-beat14-change'));
    fireEvent.click(screen.getByTestId('script-beat14-change'));
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-beat14-change')));
  });
});

// Ranked by fit with the event, and "Suggest one" (Evoni, 2026-10-25).
describe('Beat14Opportunity: ranked by fit, and Suggest one', () => {
  const fit = (score, best, ...texts) => ({ score, best, reasons: texts.map(([kind, text]) => ({ kind, text })) });
  const RANKED = [
    { id: 'a', name: 'Maison campaign', brand_or_company: 'Maison Belle', fit: fit(9, true, ['brand', 'Same brand as the host'], ['type', 'Campaign suits a showcase']) },
    { id: 'b', name: 'Runway walk', fit: fit(4, false, ['type', 'Runway suits a showcase'], ['prestige', "Prestige 7, as the event's"]) },
    { id: 'c', name: 'Podcast chat', fit: fit(0, false) },
    { id: 'd', name: 'Panel talk', fit: fit(0, false) },
  ];
  const EVENT = { id: 'ev-1', name: 'Spring Showcase' };

  test('opens on the open ones when one is a best fit: best first, its reasons as chips, the others folded below', () => {
    renderIt({ opportunity: null, people: PEOPLE, candidates: RANKED, event: EVENT });
    expect(screen.getByTestId('script-beat14-mode-pick').getAttribute('aria-pressed')).toBe('true');
    const pick = screen.getByTestId('script-beat14-pick');
    const names = [...pick.querySelectorAll('[data-testid^="script-beat14-pick-"]')].map((n) => n.getAttribute('data-testid'));
    expect(names).toEqual(['script-beat14-pick-a', 'script-beat14-pick-b']);
    expect(screen.getByTestId('script-beat14-best-a').textContent).toBe('Best fit');
    expect(screen.queryByTestId('script-beat14-best-b')).toBeNull();
    expect([...screen.getByTestId('script-beat14-reasons-a').children].map((n) => n.textContent)).toEqual(['Same brand as the host', 'Campaign suits a showcase']);
    expect(screen.getByTestId('script-beat14-reasons-b').textContent).toContain("Prestige 7, as the event's");
    expect(screen.queryByTestId('script-beat14-nofit')).toBeNull();
    fireEvent.click(screen.getByTestId('script-beat14-rest-toggle'));
    expect(screen.getByTestId('script-beat14-pick-c')).toBeTruthy();
    expect(screen.getByTestId('script-beat14-pick-d')).toBeTruthy();
    expect(screen.queryByTestId('script-beat14-reasons-c')).toBeNull();
  });

  test('a ranked one attaches as before', async () => {
    api.put.mockResolvedValue({ data: {} });
    const onChange = renderIt({ opportunity: null, people: PEOPLE, candidates: RANKED, event: EVENT });
    fireEvent.click(screen.getByTestId('script-beat14-pick-a').querySelector('input'));
    fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(URL, { opportunity_id: 'a', connector_profile_id: 7 });
  });

  test('nothing fits well: it says so and offers Suggest one, which fills the New form and saves nothing', async () => {
    api.get.mockResolvedValue({ data: { data: { draft: {
      name: 'Maison Belle runway booking', opportunity_type: 'runway', connector_profile_id: 9,
      pitch: 'Noor was at Spring Showcase and wants Lala for a runway booking with Maison Belle.', goal: { id: 'g1', title: 'Grow audience to 100K' },
    } } } });
    renderIt({ opportunity: null, people: PEOPLE, candidates: [RANKED[2], RANKED[3]], event: EVENT });
    expect(screen.getByTestId('script-beat14-mode-new').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('script-beat14-nofit').textContent).toMatch(/^Nothing open fits this event well\./);
    fireEvent.change(screen.getByTestId('script-beat14-from'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('script-beat14-suggest'));
    await waitFor(() => expect(screen.getByTestId('script-beat14-name').value).toBe('Maison Belle runway booking'));
    expect(api.get).toHaveBeenCalledWith(`${URL}/suggest?from=9`);
    expect(screen.getByTestId('script-beat14-type').value).toBe('runway');
    expect(screen.getByTestId('script-beat14-pitch').value).toBe('Noor was at Spring Showcase and wants Lala for a runway booking with Maison Belle.');
    expect(screen.getByTestId('script-beat14-from').value).toBe('9');
    expect(screen.getByTestId('script-beat14-drafted').textContent).toBe('Drafted from Spring Showcase and Noor, to move Grow audience to 100K. Edit it as you like: nothing is saved until you attach it.');
    expect(api.put).not.toHaveBeenCalled();
  });

  test('Suggest one from the open ones switches to New; Attach then creates it', async () => {
    api.get.mockResolvedValue({ data: { data: { draft: { name: 'Sable Reyes brand deal', opportunity_type: 'brand_deal', connector_profile_id: 7, pitch: 'P', goal: null } } } });
    api.put.mockResolvedValue({ data: {} });
    const onChange = renderIt({ opportunity: null, people: PEOPLE, candidates: RANKED, event: EVENT });
    fireEvent.click(screen.getByTestId('script-beat14-suggest'));
    await waitFor(() => expect(screen.getByTestId('script-beat14-mode-new').getAttribute('aria-pressed')).toBe('true'));
    expect(api.get).toHaveBeenCalledWith(`${URL}/suggest`);
    fireEvent.click(screen.getByTestId('script-beat14-save'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(URL, { create: { name: 'Sable Reyes brand deal', opportunity_type: 'brand_deal', pitch: 'P', connector_profile_id: 7 } });
  });

  test('a failed suggest says so', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'The invitation comes from someone at the event.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt({ opportunity: null, people: PEOPLE, candidates: [], event: EVENT });
    expect(screen.getByTestId('script-beat14-nofit').textContent).toMatch(/^Nothing is open to attach\./);
    fireEvent.click(screen.getByTestId('script-beat14-suggest'));
    expect((await screen.findByTestId('script-beat14-error')).textContent).toBe('The invitation comes from someone at the event.');
  });
});
