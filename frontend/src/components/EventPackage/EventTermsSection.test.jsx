/**
 * EventTermsSection (Task #1814) — the Event Package's Terms area renders
 * its four sub-sections from their own homes, saves the event-held terms
 * through the page's putEvent, writes deliverables through their own
 * routes, and offers no editing once the event is locked.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventTermsSection from './EventTermsSection';

const EVENT = {
  id: 'ev-1',
  requirements: { reputation_min: 3, coins_min: 100 },
  restrictions: [{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }],
  is_paid: true,
  payment_amount: 1500,
};
const DELIVERABLES = [
  { id: 'd1', description: 'Sponsored content', deliverable_type: 'post', due_date: '2026-11-07', required: true, status: 'pending' },
  { id: 'd2', description: 'Story mentions', deliverable_type: null, due_date: null, required: false, status: 'pending' },
];

function renderTerms(props = {}) {
  const putEvent = vi.fn(async () => ({ data: { success: true } }));
  const onSaved = vi.fn(async () => {});
  const onToast = vi.fn();
  render(
    <EventTermsSection
      showId="show-1" eventId="ev-1" event={EVENT} locked={false}
      putEvent={putEvent} onSaved={onSaved} onToast={onToast} {...props}
    />
  );
  return { putEvent, onSaved, onToast };
}

describe('EventTermsSection', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: DELIVERABLES, locked: false } });
  });

  test('renders the four sub-sections, each from its own home', async () => {
    renderTerms();
    expect(screen.getByTestId('terms-section')).toBeTruthy();

    const access = screen.getByTestId('terms-access');
    expect(within(access).getByText('Reputation at least: 3')).toBeTruthy();
    expect(within(access).getByText('Coins at least: 100')).toBeTruthy();

    const deliverables = screen.getByTestId('terms-deliverables');
    await waitFor(() => expect(within(deliverables).getByText('Sponsored content')).toBeTruthy());
    expect(within(deliverables).getByText('Due 2026-11-07')).toBeTruthy();
    expect(within(deliverables).getByText('Optional')).toBeTruthy();
    expect(within(deliverables).getAllByText('Pending')).toHaveLength(2);
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/deliverables');

    const restrictions = screen.getByTestId('terms-restrictions');
    expect(within(restrictions).getByText('No competing beauty brands for 90 days')).toBeTruthy();
    expect(within(restrictions).getByText('Exclusivity')).toBeTruthy();

    expect(screen.getByTestId('terms-compensation-summary').textContent).toBe('Paid: 1500 coins');
  });

  test('adding a restriction saves the whole array through the event PUT, apart from requirements', async () => {
    const { putEvent, onSaved } = renderTerms();
    fireEvent.change(screen.getByTestId('terms-restriction-input'), { target: { value: 'No posting before launch' } });
    fireEvent.click(screen.getByTestId('terms-restriction-add'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledTimes(1));
    expect(putEvent).toHaveBeenCalledWith({
      restrictions: [
        { type: 'exclusivity', description: 'No competing beauty brands for 90 days' },
        { type: 'other', description: 'No posting before launch' },
      ],
    });
    expect(putEvent.mock.calls[0][0]).not.toHaveProperty('requirements');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  test('compensation edit sends is_paid and payment_amount', async () => {
    const { putEvent } = renderTerms();
    fireEvent.click(screen.getByTestId('terms-compensation-edit'));
    fireEvent.change(screen.getByTestId('terms-compensation-amount'), { target: { value: '2000' } });
    fireEvent.click(screen.getByTestId('terms-compensation-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ is_paid: true, payment_amount: 2000 }));
  });

  test('access requirements edit keeps its own key', async () => {
    const { putEvent } = renderTerms();
    fireEvent.click(screen.getByTestId('terms-access-edit'));
    fireEvent.change(screen.getByTestId('terms-access-input-brand_trust_min'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('terms-access-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({
      requirements: { reputation_min: 3, coins_min: 100, brand_trust_min: 5 },
    }));
  });

  test('adding a deliverable posts to the deliverable route, not the event PUT', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, deliverable: { id: 'd3' } } });
    const { putEvent } = renderTerms();
    await waitFor(() => expect(screen.getByText('Sponsored content')).toBeTruthy());
    fireEvent.click(screen.getByTestId('terms-deliverable-add'));
    fireEvent.change(screen.getByTestId('terms-deliverable-description'), { target: { value: 'Walk the show' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/v1/world/show-1/events/ev-1/deliverables',
      { description: 'Walk the show', deliverable_type: null, due_date: null, required: true, owed_to: 'host', fee: null }
    ));
    expect(putEvent).not.toHaveBeenCalled();
  });

  test('a deliverable can be marked as owed to a brand (T2, Task #2294)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, deliverable: { id: 'd3' } } });
    renderTerms();
    await waitFor(() => expect(screen.getByText('Sponsored content')).toBeTruthy());
    fireEvent.click(screen.getByTestId('terms-deliverable-add'));
    fireEvent.change(screen.getByTestId('terms-deliverable-description'), { target: { value: 'Tag the label' } });
    fireEvent.change(screen.getByTestId('terms-deliverable-owed-to'), { target: { value: 'brand' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/v1/world/show-1/events/ev-1/deliverables',
      expect.objectContaining({ description: 'Tag the label', owed_to: 'brand' })
    ));
  });

  test('locked: shows the terms, offers no editing', async () => {
    renderTerms({ locked: true });
    expect(screen.getByTestId('terms-locked')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Sponsored content')).toBeTruthy());
    expect(screen.queryByTestId('terms-access-edit')).toBeNull();
    expect(screen.queryByTestId('terms-deliverable-add')).toBeNull();
    expect(screen.queryByTestId('terms-restriction-input')).toBeNull();
    expect(screen.queryByTestId('terms-compensation-edit')).toBeNull();
    expect(screen.queryByTestId('terms-deal-type-edit')).toBeNull();
    expect(screen.queryByLabelText('Remove Sponsored content')).toBeNull();
  });

  // Deal build PR 2 (Task #2330): the deal type, drafted by the server's
  // fixed rule, labelled per doctrine rule 14, editable until the lock.
  const drafted = (dealType, draftedValue = dealType, source = 'rule') => ({
    ...EVENT,
    deal_type: dealType,
    canon_consequences: { automation: { auto_drafted: { deal_type: source }, drafted_values: { deal_type: draftedValue } } },
  });

  test('deal type: a drafted value reads Auto-drafted · <source>', async () => {
    renderTerms({ event: drafted('invited_comped') });
    expect(screen.getByTestId('terms-deal-type-summary').textContent).toBe('Invited, comped · Auto-drafted · rule');
  });

  test('deal type: from an opportunity, and once changed it reads Edited', async () => {
    renderTerms({ event: drafted('paid_appearance', 'paid_appearance', 'opportunity') });
    expect(screen.getByTestId('terms-deal-type-state').textContent).toContain('Auto-drafted · opportunity');
  });

  test('deal type: a value different from the draft reads Edited', async () => {
    renderTerms({ event: drafted('gifted', 'invited_comped') });
    expect(screen.getByTestId('terms-deal-type-summary').textContent).toBe('Gifted · Edited');
  });

  test('deal type: no value and no draft reads Not set, with no label', async () => {
    renderTerms();
    expect(screen.getByTestId('terms-deal-type-summary').textContent).toBe('Not set');
    expect(screen.queryByTestId('terms-deal-type-state')).toBeNull();
  });

  // Deal build PR 3 (Task #2341): the appearance fee and Propose terms.
  test('pricing: Propose terms loads the card and posts only the chosen premiums', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/deal-rates'
      ? { data: { success: true, card: { version: 1, anchors: {}, premiums: { rush: { '48h': 10, '24h': 20 }, paid_ad: { whitelisting: null } } } } }
      : { data: { success: true, deliverables: DELIVERABLES, locked: false } }));
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, proposal: { ok: true, gaps: ['"Story mentions" has no rate anchor; price it by hand.'] } } });
    const { onSaved } = renderTerms({ event: { ...EVENT, deal_type: 'appearance_plus_deliverables' } });
    await waitFor(() => expect(screen.getByText('Sponsored content')).toBeTruthy());

    fireEvent.click(screen.getByTestId('terms-propose-open'));
    await waitFor(() => expect(screen.getByTestId('terms-premium-appearance-rush')).toBeTruthy());
    // paid_ad has no percent: listed, not choosable.
    const paidAd = screen.getByTestId('terms-premium-d1-paid_ad');
    expect(within(paidAd).getByText('whitelisting (set before use)').disabled).toBe(true);

    fireEvent.change(screen.getByTestId('terms-premium-d1-rush'), { target: { value: '24h' } });
    fireEvent.click(screen.getByTestId('terms-propose-run'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/v1/world/show-1/events/ev-1/propose-terms',
      { premiums: { appearance: [], deliverables: { d1: [{ kind: 'rush', key: '24h' }] } } }
    ));
    await waitFor(() => expect(screen.getByTestId('terms-propose-gaps').textContent).toContain('price it by hand'));
    expect(onSaved).toHaveBeenCalled();
  });

  test('pricing: without a deal type Propose terms is disabled; the fee reads Not set', async () => {
    renderTerms();
    expect(screen.getByTestId('terms-propose-open').disabled).toBe(true);
    expect(screen.getByTestId('terms-fee-summary').textContent).toBe('Not set');
  });

  test('pricing: drafted fees are labelled, and editing the appearance fee sends only that', async () => {
    const event = {
      ...EVENT, deal_type: 'paid_appearance', appearance_fee: 450,
      canon_consequences: { automation: { pricing_version: 1, auto_drafted: { appearance_fee: 'pricing', deliverable_fees: 'pricing' }, drafted_values: { appearance_fee: 450, deliverable_fees: { d1: 125 } } } },
    };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [{ ...DELIVERABLES[0], fee: 125 }, DELIVERABLES[1]], locked: false } });
    const { putEvent } = renderTerms({ event });
    expect(screen.getByTestId('terms-fee-summary').textContent).toBe('450 coins · Auto-drafted · pricing v1');
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-fee-d1').textContent).toBe('Fee 125 coins · Auto-drafted · pricing v1'));

    fireEvent.click(screen.getByTestId('terms-fee-edit'));
    fireEvent.change(screen.getByTestId('terms-fee-input'), { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('terms-fee-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ appearance_fee: 500 }));
  });

  test('pricing: locked shows the fee, with no edit or propose control', async () => {
    renderTerms({ locked: true, event: { ...EVENT, deal_type: 'paid_appearance', appearance_fee: 250 } });
    expect(screen.getByTestId('terms-fee-summary').textContent).toBe('250 coins');
    expect(screen.queryByTestId('terms-fee-edit')).toBeNull();
    expect(screen.queryByTestId('terms-propose-open')).toBeNull();
  });

  test('deal type: editing sends only deal_type through the event PUT', async () => {
    const { putEvent } = renderTerms({ event: drafted('invited_comped') });
    fireEvent.click(screen.getByTestId('terms-deal-type-edit'));
    const select = screen.getByTestId('terms-deal-type-select');
    expect(select.value).toBe('invited_comped');
    expect(screen.getByTestId('terms-deal-type-save').disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'paid_appearance' } });
    fireEvent.click(screen.getByTestId('terms-deal-type-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ deal_type: 'paid_appearance' }));
  });

  test('before Start Episode: no fulfilment control', async () => {
    renderTerms();
    await waitFor(() => expect(screen.getByText('Sponsored content')).toBeTruthy());
    expect(screen.queryByTestId('terms-deliverable-advance-d1')).toBeNull();
    expect(screen.queryByTestId('terms-deliverable-advance-d2')).toBeNull();
  });

  describe('fulfilment after Start Episode (Task #1815)', () => {
    const LOCKED = [
      { id: 'p1', description: 'Tagged post', status: 'pending', completed_at: null, submitted_at: null, approved_at: null },
      { id: 'c1', description: 'Story mentions', status: 'completed', completed_at: '2026-09-20T12:00:00Z', submitted_at: null, approved_at: null },
      { id: 's1', description: 'Reel', status: 'submitted', completed_at: '2026-09-20T12:00:00Z', submitted_at: '2026-09-22T12:00:00Z', approved_at: null },
      { id: 'a1', description: 'Walk the show', status: 'approved', completed_at: '2026-09-20T12:00:00Z', submitted_at: '2026-09-21T12:00:00Z', approved_at: '2026-09-23T12:00:00Z' },
    ];
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: LOCKED, locked: true } });
    });

    test('shows each status, the date of each step reached, and one button to the next status (none at approved)', async () => {
      renderTerms({ locked: true });
      await waitFor(() => expect(screen.getByText('Tagged post')).toBeTruthy());

      expect(screen.getByTestId('terms-deliverable-status-p1').textContent).toBe('Pending');
      expect(screen.getByTestId('terms-deliverable-status-c1').textContent).toBe('Completed');
      expect(screen.getByTestId('terms-deliverable-status-s1').textContent).toBe('Submitted');
      expect(screen.getByTestId('terms-deliverable-status-a1').textContent).toBe('Approved');

      expect(screen.getByTestId('terms-deliverable-advance-p1').textContent).toBe('Mark completed');
      expect(screen.getByTestId('terms-deliverable-advance-c1').textContent).toBe('Mark submitted');
      expect(screen.getByTestId('terms-deliverable-advance-s1').textContent).toBe('Mark approved');
      expect(screen.queryByTestId('terms-deliverable-advance-a1')).toBeNull();

      expect(screen.queryByTestId('terms-deliverable-timeline-p1')).toBeNull();
      const times = (id) => [...screen.getByTestId(`terms-deliverable-timeline-${id}`).querySelectorAll('time')].map((t) => t.getAttribute('datetime'));
      expect(times('s1')).toEqual(['2026-09-20T12:00:00.000Z', '2026-09-22T12:00:00.000Z']);
      expect(times('a1')).toEqual(['2026-09-20T12:00:00.000Z', '2026-09-21T12:00:00.000Z', '2026-09-23T12:00:00.000Z']);
      expect(within(screen.getByTestId('terms-deliverable-timeline-a1')).getByText(/Approved/)).toBeTruthy();

      // Editing stays off while locked.
      expect(screen.queryByLabelText('Edit Tagged post')).toBeNull();
      expect(screen.queryByLabelText('Remove Tagged post')).toBeNull();
    });

    test('advancing posts the next status to the status route and shows the saved row', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: { success: true, deliverable: { ...LOCKED[0], status: 'completed', completed_at: '2026-09-24T09:00:00Z' } },
      });
      const { putEvent, onToast } = renderTerms({ locked: true });
      await waitFor(() => expect(screen.getByText('Tagged post')).toBeTruthy());

      fireEvent.click(screen.getByTestId('terms-deliverable-advance-p1'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        '/api/v1/world/show-1/events/ev-1/deliverables/p1/status', { status: 'completed' }
      ));
      await waitFor(() => expect(screen.getByTestId('terms-deliverable-status-p1').textContent).toBe('Completed'));
      expect(screen.getByTestId('terms-deliverable-advance-p1').textContent).toBe('Mark submitted');
      expect(screen.getByTestId('terms-deliverable-timeline-p1').querySelector('time').getAttribute('datetime'))
        .toBe('2026-09-24T09:00:00.000Z');
      expect(onToast).toHaveBeenCalledWith('Marked completed');
      expect(api.put).not.toHaveBeenCalled();
      expect(putEvent).not.toHaveBeenCalled();
    });

    test('a refusal shows the server\'s error and reloads the list', async () => {
      const err = Object.assign(new Error('Request failed'), {
        response: { status: 409, data: { success: false, code: 'DELIVERABLE_STATUS_CONFLICT', error: 'The deliverable changed while this was being saved; reload and try again.' } },
      });
      vi.mocked(api.post).mockRejectedValue(err);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      renderTerms({ locked: true });
      await waitFor(() => expect(screen.getByText('Tagged post')).toBeTruthy());
      expect(api.get).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('terms-deliverable-advance-p1'));
      await waitFor(() => expect(screen.getByText(/changed while this was being saved/)).toBeTruthy());
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    });
  });

  test('empty event: every sub-section says None set / Unpaid', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [] } });
    renderTerms({ event: { id: 'ev-1' } });
    await waitFor(() => expect(within(screen.getByTestId('terms-deliverables')).getByText('None set')).toBeTruthy());
    expect(within(screen.getByTestId('terms-access')).getByText('None set')).toBeTruthy();
    expect(within(screen.getByTestId('terms-restrictions')).getByText('None set')).toBeTruthy();
    expect(screen.getByTestId('terms-compensation-summary').textContent).toBe('Unpaid');
  });
});
