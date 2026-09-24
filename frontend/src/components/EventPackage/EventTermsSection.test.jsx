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
      { description: 'Walk the show', deliverable_type: null, due_date: null, required: true }
    ));
    expect(putEvent).not.toHaveBeenCalled();
  });

  test('locked: shows the terms, offers no editing', async () => {
    renderTerms({ locked: true });
    expect(screen.getByTestId('terms-locked')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Sponsored content')).toBeTruthy());
    expect(screen.queryByTestId('terms-access-edit')).toBeNull();
    expect(screen.queryByTestId('terms-deliverable-add')).toBeNull();
    expect(screen.queryByTestId('terms-restriction-input')).toBeNull();
    expect(screen.queryByTestId('terms-compensation-edit')).toBeNull();
    expect(screen.queryByLabelText('Remove Sponsored content')).toBeNull();
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
