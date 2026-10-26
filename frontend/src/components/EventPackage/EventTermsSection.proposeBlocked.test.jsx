/**
 * Propose terms says why it is off (Evoni, 2026-10-25: "say why something
 * is blocked"): with no deal type, "Deal prices need a deal type first ·
 * Pick one", which opens the Deal's form with its first box focused; a deal
 * with no paid part, "Proposing terms needs a paid part in the deal"; none
 * once the deal pays, or when the terms are locked.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventTermsSection from './EventTermsSection';

const EVENT = { id: 'ev-1', requirements: {}, restrictions: [], is_paid: false };

function renderTerms(props = {}) {
  render(
    <EventTermsSection
      showId="show-1" eventId="ev-1" event={EVENT} locked={false}
      putEvent={vi.fn(async () => ({ data: { success: true } }))} onSaved={vi.fn(async () => {})} onToast={vi.fn()} {...props}
    />
  );
}

describe('EventTermsSection — why Propose terms is off', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], costs: [], locked: false } });
  });

  test('no deal type: the reason and "Pick one", which opens the Deal form focused', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderTerms();
    expect(screen.getByTestId('terms-propose-open').disabled).toBe(true);
    const reason = screen.getByTestId('terms-propose-blocked');
    expect(reason.textContent).toContain('Deal prices need a deal type first');
    fireEvent.click(within(reason).getByTestId('terms-propose-blocked-action'));
    const form = await screen.findByTestId('terms-deal-components-form');
    await waitFor(() => expect(form.contains(document.activeElement)).toBe(true));
    // The form is open, so the reason steps aside.
    expect(screen.queryByTestId('terms-propose-blocked')).toBeNull();
    delete Element.prototype.scrollIntoView;
  });

  test('a deal with no paid part says so; a paying deal and locked terms say nothing', async () => {
    const { unmount } = render(
      <EventTermsSection showId="show-1" eventId="ev-1" event={{ ...EVENT, deal_type: 'gifted' }} locked={false}
        putEvent={vi.fn()} onSaved={vi.fn()} onToast={vi.fn()} />
    );
    expect(screen.getByTestId('terms-propose-blocked').textContent).toContain('Proposing terms needs a paid part in the deal');
    unmount();
    const paying = render(
      <EventTermsSection showId="show-1" eventId="ev-1" event={{ ...EVENT, deal_type: 'brand_partnership', deal_components: ['partnership_base'] }} locked={false}
        putEvent={vi.fn()} onSaved={vi.fn()} onToast={vi.fn()} />
    );
    expect(screen.queryByTestId('terms-propose-blocked')).toBeNull();
    paying.unmount();
    renderTerms({ locked: true });
    expect(screen.queryByTestId('terms-propose-blocked')).toBeNull();
  });
});
