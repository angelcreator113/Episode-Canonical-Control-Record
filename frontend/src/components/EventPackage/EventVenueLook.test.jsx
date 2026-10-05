/**
 * The Event Venue Look in the Event Package (Evoni's ruling L1, 2026-10-02,
 * answers Q2, Q6, Q8, Q9; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventVenueLook from './EventVenueLook';

const URL = '/api/v1/world/show-1/events/ev-1/venue-look';
const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';
const A3 = '33333333-3333-4333-8333-333333333333';
const A4 = '44444444-4444-4444-8444-444444444444';

const LOOK = {
  overall: 'A candlelit greenhouse gala.',
  decor: 'White orchids and gold glassware.',
  lighting: '', signage: '', must_include: '', must_avoid: 'Neon.',
  areas: ['Bar', 'Runway'],
  references: [{ asset_id: A1, use_as_reference: true, url: 'https://x/a1.png' }],
  sources: { overall: 'auto-drafted', decor: 'edited', areas: 'auto-drafted', must_avoid: 'auto-drafted' },
};

let body;
// The look's buttons stay disabled until its first load; clicking one
// before then does nothing, so wait for it to be enabled (CI raced it).
const enabled = async (testId) => {
  const button = await screen.findByTestId(testId);
  await waitFor(() => expect(button.disabled).toBe(false));
  return button;
};
const renderLook = () => {
  const onToast = vi.fn();
  const onSaved = vi.fn();
  render(<EventVenueLook showId="show-1" eventId="ev-1" onToast={onToast} onSaved={onSaved} />);
  return { onToast, onSaved };
};

describe('EventVenueLook (L1)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    body = { venue_look: LOOK, editable: true };
    vi.mocked(api.get).mockImplementation(async (url) => (url === URL ? { data: { success: true, data: body } } : { data: {} }));
  });

  test('shows each part with its Auto-drafted or Edited label, and the references used', async () => {
    renderLook();
    expect((await screen.findByTestId('venue-look-part-overall')).textContent).toContain('A candlelit greenhouse gala.');
    expect(screen.getByTestId('venue-look-source-overall').textContent).toContain('Auto-drafted');
    expect(screen.getByTestId('venue-look-source-decor').textContent).toContain('Edited');
    fireEvent.click(screen.getByTestId('venue-look-more'));
    expect(screen.getByTestId('venue-look-part-areas').textContent).toContain('Bar, Runway');
    expect(screen.queryByTestId('venue-look-part-lighting')).toBeNull();
    expect(screen.getByText('Used as reference')).toBeTruthy();
  });

  test('Place shows the first two parts; Show more opens the rest and the references, Show less folds them', async () => {
    renderLook();
    await screen.findByTestId('venue-look-part-overall');
    expect(screen.getByTestId('venue-look-part-decor')).toBeTruthy();
    expect(screen.queryByTestId('venue-look-part-areas')).toBeNull();
    expect(screen.queryByText('Used as reference')).toBeNull();
    const more = screen.getByTestId('venue-look-more');
    // Areas, Must avoid and the reference images.
    expect(more.textContent).toContain('Show 3 more parts');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(screen.getByTestId('venue-look-part-must_avoid').textContent).toContain('Neon.');
    expect(screen.getByText('Used as reference')).toBeTruthy();
    expect(more.textContent).toContain('Show less');
    fireEvent.click(more);
    expect(screen.queryByTestId('venue-look-part-areas')).toBeNull();
  });

  test('a look of two parts or fewer has no Show more', async () => {
    body = { venue_look: { overall: 'Just this.', decor: 'And this.', areas: [], references: [], sources: {} }, editable: true };
    renderLook();
    await screen.findByTestId('venue-look-part-decor');
    expect(screen.queryByTestId('venue-look-more')).toBeNull();
  });

  test('with no look it says so and offers drafting and writing', async () => {
    body = { venue_look: null, editable: true };
    renderLook();
    expect(await screen.findByText('No venue look yet. Draft it from the event details, or write it.')).toBeTruthy();
    expect(screen.getByTestId('venue-look-edit').textContent).toContain('Write');
  });

  test('Draft from event details drafts with no confirm and names the edits it kept', async () => {
    body = { venue_look: null, editable: true };
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { venue_look: LOOK, kept_edited: ['decor'] } } });
    const confirm = vi.spyOn(window, 'confirm');
    const { onToast, onSaved } = renderLook();
    fireEvent.click(await enabled('venue-look-draft'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${URL}/draft`, {}));
    expect(confirm).not.toHaveBeenCalled();
    await screen.findByTestId('venue-look-part-overall');
    expect(onToast).toHaveBeenCalledWith('Venue look drafted; kept your edits to Décor and colours');
    expect(onSaved).toHaveBeenCalled();
  });

  test('Edit saves every part, areas one per line, and the references with their ticks', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { venue_look: LOOK } } });
    const { onToast } = renderLook();
    fireEvent.click(await enabled('venue-look-edit'));
    await screen.findByTestId('venue-look-editor');
    fireEvent.change(screen.getByTestId('venue-look-input-lighting'), { target: { value: 'Warm candlelight at dusk.' } });
    fireEvent.change(screen.getByTestId('venue-look-input-areas'), { target: { value: 'Bar\nRunway\n\nVIP lounge' } });
    fireEvent.click(screen.getByTestId(`venue-look-ref-tick-${A1}`));
    fireEvent.click(screen.getByTestId('venue-look-save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(URL, { venue_look: {
      overall: LOOK.overall, decor: LOOK.decor, lighting: 'Warm candlelight at dusk.', signage: '', must_include: '', must_avoid: 'Neon.',
      areas: ['Bar', 'Runway', 'VIP lounge'],
      references: [{ asset_id: A1, use_as_reference: false }],
    } }));
    await waitFor(() => expect(screen.queryByTestId('venue-look-editor')).toBeNull());
    expect(onToast).toHaveBeenCalledWith('Venue look saved');
  });

  test('at most 3 references can be ticked', async () => {
    body = { venue_look: { ...LOOK, references: [A1, A2, A3, A4].map((id, i) => ({ asset_id: id, use_as_reference: i < 3, url: null })) }, editable: true };
    renderLook();
    fireEvent.click(await enabled('venue-look-edit'));
    expect(screen.getByTestId(`venue-look-ref-tick-${A4}`).disabled).toBe(true);
    fireEvent.click(screen.getByTestId(`venue-look-ref-tick-${A1}`));
    expect(screen.getByTestId(`venue-look-ref-tick-${A4}`).disabled).toBe(false);
  });

  test('an uploaded image is added as a reference, not ticked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'SUCCESS', data: { id: A2, s3_url_processed: 'https://x/a2.png' } } });
    renderLook();
    fireEvent.click(await enabled('venue-look-edit'));
    const file = new File(['png'], 'mood.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Add reference image'), { target: { files: [file] } });
    await screen.findByTestId(`venue-look-ref-${A2}`);
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/api/v1/assets');
    expect(form.get('assetType')).toBe('CUSTOM_GRAPHIC');
    expect(JSON.parse(form.get('metadata'))).toEqual({ purpose: 'venue_look_reference', event_id: 'ev-1' });
    expect(screen.getByTestId(`venue-look-ref-tick-${A2}`).checked).toBe(false);
  });

  test("a refused save keeps the editor open with the server's reason", async () => {
    const err = new Error('Request failed');
    err.response = { status: 409, data: { code: 'VENUE_LOOK_LOCKED', error: "This event's episode is accepted: its venue look is locked" } };
    vi.mocked(api.put).mockRejectedValue(err);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLook();
    fireEvent.click(await enabled('venue-look-edit'));
    fireEvent.click(screen.getByTestId('venue-look-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('venue look is locked');
    expect(screen.getByTestId('venue-look-editor')).toBeTruthy();
  });

  test('locked once the episode is accepted: no draft or edit', async () => {
    body = { venue_look: LOOK, editable: false };
    renderLook();
    expect(await screen.findByTestId('venue-look-locked')).toBeTruthy();
    expect(screen.queryByTestId('venue-look-draft')).toBeNull();
    expect(screen.queryByTestId('venue-look-edit')).toBeNull();
  });
});
