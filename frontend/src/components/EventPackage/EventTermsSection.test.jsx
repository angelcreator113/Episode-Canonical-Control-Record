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

  // Deal build PR 3 (Task #2341; Evoni's Deal PR 3 ruling): the deal's
  // components, the fixed deliverable types, and Propose terms.
  const CARD = { version: 1, anchors: {}, premiums: { rush: { '48h': 10, '24h': 20 }, paid_ad: { whitelisting: null } } };
  const TYPED = [
    { id: 'd1', description: 'One reel in the coat', deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, required: true, status: 'pending', fee: null },
    { id: 'd2', description: 'Host a Q&A', deliverable_type: 'other', required: true, status: 'pending', fee: null },
  ];

  test('pricing: Propose terms posts premiums per component, and offers them only on anchored lines (ruling 3)', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/deal-rates'
      ? { data: { success: true, card: CARD } }
      : { data: { success: true, deliverables: TYPED, locked: false } }));
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, proposal: { ok: true, gaps: ['"Host a Q&A": price required (Other is never priced automatically).'] } } });
    const { onSaved } = renderTerms({ event: { ...EVENT, deal_type: 'brand_partnership', appearance_required: true } });
    await waitFor(() => expect(screen.getByText('One reel in the coat')).toBeTruthy());

    fireEvent.click(screen.getByTestId('terms-propose-open'));
    await waitFor(() => expect(screen.getByTestId('terms-premium-partnership_base-rush')).toBeTruthy());
    expect(screen.getByTestId('terms-premium-appearance-rush')).toBeTruthy();
    expect(screen.getByTestId('terms-premium-d1-rush')).toBeTruthy();
    // Other has no anchor, so no premium can be chosen for it.
    expect(screen.queryByTestId('terms-premium-d2-rush')).toBeNull();
    // paid_ad has no percent: listed, not choosable.
    expect(within(screen.getByTestId('terms-premium-d1-paid_ad')).getByText('whitelisting (set before use)').disabled).toBe(true);

    fireEvent.change(screen.getByTestId('terms-premium-partnership_base-rush'), { target: { value: '48h' } });
    fireEvent.change(screen.getByTestId('terms-premium-d1-rush'), { target: { value: '24h' } });
    fireEvent.click(screen.getByTestId('terms-propose-run'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/v1/world/show-1/events/ev-1/propose-terms',
      { premiums: { partnership_base: [{ kind: 'rush', key: '48h' }], deliverables: { d1: [{ kind: 'rush', key: '24h' }] } } }
    ));
    await waitFor(() => expect(screen.getByTestId('terms-propose-gaps').textContent).toContain('Other is never priced automatically'));
    expect(onSaved).toHaveBeenCalled();
  });

  test('pricing: ruling 1 — a partnership shows its base, and the appearance only when required', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], locked: false } });
    const { putEvent } = renderTerms({ event: { ...EVENT, deal_type: 'brand_partnership', partnership_base_fee: 900 } });
    expect(screen.getByTestId('terms-component-summary-partnership_base_fee').textContent).toBe('900 coins');
    expect(screen.queryByTestId('terms-component-appearance_fee')).toBeNull();

    // D14: the appearance is its own ticked component, not a partnership flag.
    expect(screen.queryByTestId('terms-appearance-required')).toBeNull();
    expect(putEvent).not.toHaveBeenCalled();
  });

  test('D14: a partnership with Paid to appear ticked shows the appearance fee as well', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], locked: false } });
    renderTerms({ event: { ...EVENT, deal_type: 'brand_partnership', deal_components: ['paid_to_appear', 'paid_for_content', 'partnership_base'], partnership_base_fee: 900 } });
    expect(screen.getByTestId('terms-component-summary-partnership_base_fee').textContent).toBe('900 coins');
    expect(screen.getByTestId('terms-component-appearance_fee')).toBeTruthy();
  });

  test('pricing: ruling 6 — a missing price reads Price required, and Start Episode is said to wait on it', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: TYPED, locked: false } });
    renderTerms({ event: { ...EVENT, deal_type: 'paid_deliverables' } });
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-fee-d2').textContent).toBe('Price required'));
    expect(screen.getByTestId('terms-deliverable-type-d2').textContent).toBe('Other');
    expect(screen.getByTestId('terms-price-missing').textContent).toContain('Start Episode waits on a price for: "One reel in the coat", "Host a Q&A".');
  });

  test('pricing: "No fee (0)" sets a Price required deliverable to 0 in one click', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: TYPED, locked: false } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, deliverable: { ...TYPED[1], fee: 0 } } });
    renderTerms({ event: { ...EVENT, deal_type: 'paid_deliverables' } });
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-nofee-d2')).toBeTruthy());
    fireEvent.click(screen.getByTestId('terms-deliverable-nofee-d2'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/deliverables/d2', { fee: 0 }));
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  test('pricing: no "No fee (0)" on a line that already has a price', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [{ ...TYPED[0], fee: 125 }], locked: false } });
    renderTerms({ event: { ...EVENT, deal_type: 'paid_deliverables' } });
    await waitFor(() => expect(screen.getByText('One reel in the coat')).toBeTruthy());
    expect(screen.queryByTestId('terms-deliverable-nofee-d1')).toBeNull();
  });

  test('pricing: without a deal type nothing is priced; a no-cash deal says so and cannot propose', async () => {
    renderTerms();
    expect(screen.getByTestId('terms-pricing-empty').textContent).toBe('Tick what the deal includes to price it.');
    expect(screen.getByTestId('terms-propose-open').disabled).toBe(true);
  });

  test('pricing: gifted records its value, never paid (ruling 4)', async () => {
    const { putEvent } = renderTerms({ event: { ...EVENT, deal_type: 'gifted' } });
    expect(screen.getByTestId('terms-no-cash').textContent).toBe('Gifted: no cash income. The gifted value is recorded, never paid.');
    expect(screen.getByTestId('terms-propose-open').disabled).toBe(true);
    expect(screen.getByTestId('terms-component-summary-gifted_value').textContent).toBe('Not recorded');
    fireEvent.click(screen.getByTestId('terms-component-edit-gifted_value'));
    fireEvent.change(screen.getByTestId('terms-component-input-gifted_value'), { target: { value: '300' } });
    fireEvent.click(screen.getByTestId('terms-component-save-gifted_value'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ gifted_value: 300 }));
  });

  test('pricing: drafted fees are labelled, and editing one component sends only that', async () => {
    const event = {
      ...EVENT, deal_type: 'appearance_plus_deliverables', appearance_fee: 450,
      canon_consequences: { automation: { pricing_version: 1, auto_drafted: { appearance_fee: 'pricing', deliverable_fees: 'pricing' }, drafted_values: { appearance_fee: 450, deliverable_fees: { d1: 125 } } } },
    };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [{ ...TYPED[0], fee: 125 }], locked: false } });
    const { putEvent } = renderTerms({ event });
    expect(screen.getByTestId('terms-component-summary-appearance_fee').textContent).toBe('450 coins · Auto-drafted · pricing v1');
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-fee-d1').textContent).toBe('Fee 125 coins · Auto-drafted · pricing v1'));

    fireEvent.click(screen.getByTestId('terms-component-edit-appearance_fee'));
    fireEvent.change(screen.getByTestId('terms-component-input-appearance_fee'), { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('terms-component-save-appearance_fee'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ appearance_fee: 500 }));
  });

  test('one drafted deliverable says Auto-drafted once, and never "pricing vnull" (Evoni, 2026-10-01)', async () => {
    // As on the Wearable Experiments Studio Session: a drafted, priced Reel and no recorded pricing version.
    const event = {
      ...EVENT, deal_type: 'paid_deliverables',
      canon_consequences: { automation: {
        auto_drafted: { deliverables: 'deal', deliverable_fees: 'pricing' },
        drafted_values: {
          deliverables: { r1: { type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 325, description: 'Instagram Reel', required: true } },
          deliverable_fees: { r1: 325 },
        },
      } },
    };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, locked: false, deliverables: [
      { id: 'r1', description: 'Instagram Reel', deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, required: true, owed_to: 'host', status: 'pending', fee: 325 },
    ] } });
    renderTerms({ event });
    const row = await screen.findByTestId('terms-deliverable-r1');
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-fee-r1').textContent).toBe('Fee 325 coins'));
    expect(row.textContent).not.toMatch(/vnull|vundefined/);
    expect(row.textContent.match(/Auto-drafted/g)).toHaveLength(1);
    expect(screen.getByTestId('terms-deliverable-draft-r1').textContent).toBe('Auto-drafted · from deal · pricing');
  });

  test('with a pricing version, the one note names it; an edited fee reads Edited once', async () => {
    const auto = { auto_drafted: { deliverables: 'deal', deliverable_fees: 'pricing' }, pricing_version: 2,
      drafted_values: { deliverables: { r1: { type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 325, description: 'Instagram Reel', required: true } }, deliverable_fees: { r1: 325 } } };
    const event = { ...EVENT, deal_type: 'paid_deliverables', canon_consequences: { automation: auto } };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, locked: false, deliverables: [
      { id: 'r1', description: 'Instagram Reel', deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, required: true, owed_to: 'host', status: 'pending', fee: 400 },
    ] } });
    renderTerms({ event });
    const row = await screen.findByTestId('terms-deliverable-r1');
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-fee-r1').textContent).toBe('Fee 400 coins'));
    expect(row.textContent.match(/Edited/g)).toHaveLength(1);
    expect(screen.getByTestId('terms-deliverable-draft-r1').textContent).toBe('Edited');
  });

  test('D12: a deliverable Propose terms drafted reads Auto-drafted · from deal, and Edited once changed', async () => {
    const event = {
      ...EVENT, deal_type: 'brand_partnership',
      canon_consequences: { automation: { auto_drafted: { deliverables: 'deal' }, drafted_values: { deliverables: {
        r1: { type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 125, description: 'Instagram Reel', required: true },
        s1: { type: 'instagram_stories', platform: 'instagram', quantity: 3, fee: 60, description: 'Instagram Stories (×3)', required: true },
      } } } },
    };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, locked: false, deliverables: [
      { id: 'r1', description: 'Instagram Reel', deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, required: true, owed_to: 'brand', status: 'pending', fee: 125 },
      { id: 's1', description: 'Instagram Stories (×3)', deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, required: true, owed_to: 'brand', status: 'pending', fee: 80 },
      { id: 'x1', description: 'Host a Q&A', deliverable_type: 'other', required: true, owed_to: 'brand', status: 'pending', fee: 50 },
    ] } });
    renderTerms({ event });
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-draft-r1').textContent).toBe('Auto-drafted · from deal'));
    expect(screen.getByTestId('terms-deliverable-draft-s1').textContent).toBe('Edited');
    expect(screen.queryByTestId('terms-deliverable-draft-x1')).toBeNull();
  });

  test('pricing: the deliverable form offers only the D15 formats (ruling 2 as D15 replaces its list)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], locked: false } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, deliverable: { id: 'd9' } } });
    renderTerms({ event: { ...EVENT, deal_type: 'paid_deliverables' } });
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-add')).toBeTruthy());
    fireEvent.click(screen.getByTestId('terms-deliverable-add'));
    const select = screen.getByTestId('terms-deliverable-type');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Choose a type', 'Instagram Reel', 'Instagram post', 'TikTok video',
      'GRWM video', 'Instagram Stories', 'Carousel post', 'Go Live', 'Link in bio', 'Try-on/haul video', 'Content for the brand (UGC)', 'Other']);
    fireEvent.change(select, { target: { value: 'other' } });
    expect(screen.getByTestId('terms-deliverable-manual-note').textContent).toBe('Other is never priced automatically: set its fee.');
    fireEvent.change(screen.getByTestId('terms-deliverable-description'), { target: { value: 'Host a Q&A' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/v1/world/show-1/events/ev-1/deliverables',
      expect.objectContaining({ description: 'Host a Q&A', deliverable_type: 'other' })
    ));
  });

  test('D15: a format with several platforms asks for one, and its quantity is sent', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], locked: false } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, deliverable: { id: 'd9' } } });
    renderTerms({ event: { ...EVENT, deal_type: 'paid_deliverables' } });
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-add')).toBeTruthy());
    fireEvent.click(screen.getByTestId('terms-deliverable-add'));
    // A single-platform format has no platform picker; Stories start at 3 slides.
    fireEvent.change(screen.getByTestId('terms-deliverable-type'), { target: { value: 'instagram_stories' } });
    expect(screen.queryByTestId('terms-deliverable-platform')).toBeNull();
    expect(screen.getByTestId('terms-deliverable-quantity').value).toBe('3');
    expect(screen.getByText('Slides')).toBeTruthy();
    // GRWM goes on several platforms; switching keeps a platform it is also on.
    fireEvent.change(screen.getByTestId('terms-deliverable-type'), { target: { value: 'grwm_video' } });
    const platform = screen.getByTestId('terms-deliverable-platform');
    expect(platform.value).toBe('instagram');
    expect([...platform.options].map((o) => o.textContent)).toEqual(['Choose a platform', 'TikTok', 'Instagram', 'YouTube']);
    fireEvent.change(platform, { target: { value: '' } });
    fireEvent.change(screen.getByTestId('terms-deliverable-description'), { target: { value: 'GRWM for the launch' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await waitFor(() => expect(screen.getByText(/Platform: choose TikTok, Instagram, YouTube/)).toBeTruthy());
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(platform, { target: { value: 'tiktok' } });
    fireEvent.change(screen.getByTestId('terms-deliverable-quantity'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/v1/world/show-1/events/ev-1/deliverables',
      expect.objectContaining({ deliverable_type: 'grwm_video', platform: 'tiktok', quantity: 2 })
    ));
  });

  test('D15: a row shows its format with quantity, and the platform where it has a choice', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, locked: false, deliverables: [
      { id: 'g1', description: 'GRWM', deliverable_type: 'grwm_video', platform: 'tiktok', quantity: 2, required: true, owed_to: 'brand', status: 'pending', fee: 540 },
      { id: 's1', description: 'Stories', deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, required: true, owed_to: 'brand', status: 'pending', fee: 110 },
    ] } });
    renderTerms({ event: { ...EVENT, deal_type: 'paid_deliverables' } });
    await waitFor(() => expect(screen.getByTestId('terms-deliverable-type-g1').textContent).toBe('GRWM video (×2) · TikTok'));
    expect(screen.getByTestId('terms-deliverable-type-s1').textContent).toBe('Instagram Stories (×3)');
  });

  test('pricing: locked shows the numbers, with no edit or propose control', async () => {
    renderTerms({ locked: true, event: { ...EVENT, deal_type: 'paid_appearance', appearance_fee: 250 } });
    expect(screen.getByTestId('terms-component-summary-appearance_fee').textContent).toBe('250 coins');
    expect(screen.queryByTestId('terms-component-edit-appearance_fee')).toBeNull();
    expect(screen.queryByTestId('terms-propose-open')).toBeNull();
  });

  test('D14: editing ticks components, shows the label they make, and sends only deal_components', async () => {
    const { putEvent } = renderTerms({ event: drafted('invited_comped') });
    fireEvent.click(screen.getByTestId('terms-deal-type-edit'));
    expect(screen.getByTestId('terms-deal-component-entry_covered').checked).toBe(true);
    expect(screen.getByTestId('terms-deal-component-paid_to_appear').checked).toBe(false);
    expect(screen.getByTestId('terms-deal-type-save').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('terms-deal-component-paid_to_appear'));
    fireEvent.click(screen.getByTestId('terms-deal-component-performance_fee'));
    expect(screen.getByTestId('terms-deal-components-label').textContent).toBe('Reads as: Paid appearance + performance fee');
    fireEvent.click(screen.getByTestId('terms-deal-type-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ deal_components: ['paid_to_appear', 'performance_fee', 'entry_covered'] }));
  });

  test('D14: the summary names the ticked components; stored components win over deal_type', async () => {
    renderTerms({ event: { ...EVENT, deal_type: 'brand_partnership', deal_components: ['partnership_base'] } });
    expect(screen.getByTestId('terms-deal-type-summary').textContent).toBe('Brand partnership (retainer)');
    expect(screen.getByTestId('terms-deal-components-summary').textContent).toBe('Partnership base');
  });

  test('D14: a drafted components record reads Auto-drafted until the ticks differ', async () => {
    const event = {
      ...EVENT, deal_type: 'gifted', deal_components: ['gifted_items', 'entry_covered'],
      canon_consequences: { automation: {
        auto_drafted: { deal_type: 'opportunity', deal_components: 'opportunity' },
        drafted_values: { deal_type: 'gifted', deal_components: ['gifted_items', 'entry_covered'] },
      } },
    };
    renderTerms({ event });
    expect(screen.getByTestId('terms-deal-type-summary').textContent).toBe('Gifted · Auto-drafted · opportunity');
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
