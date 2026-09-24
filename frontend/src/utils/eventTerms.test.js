import { describe, test, expect } from 'vitest';
import {
  describeRequirements, requirementsDraftFrom, buildRequirementsUpdate,
  restrictionsOf, buildRestrictionAdd, buildRestrictionRemove, restrictionLabel,
  describeCompensation, compensationDraftFrom, buildCompensationUpdate,
  buildDeliverableBody, deliverableDraftFrom,
} from './eventTerms';

describe('access requirements', () => {
  test('known keys first, zeros hidden, other keys as stored', () => {
    const ev = { requirements: { coins_min: 100, reputation_min: 0, brand_trust_min: 4, portfolio_min: 10 } };
    expect(describeRequirements(ev)).toEqual([
      { key: 'brand_trust_min', label: 'Brand trust at least', value: '4' },
      { key: 'coins_min', label: 'Coins at least', value: '100' },
      { key: 'portfolio_min', label: 'Portfolio Min', value: '10' },
    ]);
    expect(describeRequirements({})).toEqual([]);
  });

  test('update keeps unknown keys, drops emptied/zero known keys, validates', () => {
    const ev = { requirements: { reputation_min: 3, portfolio_min: 10 } };
    const draft = { ...requirementsDraftFrom(ev), reputation_min: '', coins_min: '50' };
    expect(buildRequirementsUpdate(ev, draft)).toEqual({
      body: { requirements: { portfolio_min: 10, coins_min: 50 } }, unchanged: false, errors: [],
    });
    expect(buildRequirementsUpdate(ev, requirementsDraftFrom(ev)).unchanged).toBe(true);
    expect(buildRequirementsUpdate(ev, { ...draft, coins_min: '-1' }).errors).toHaveLength(1);
    expect(buildRequirementsUpdate(ev, { ...draft, coins_min: '2.5' }).errors).toHaveLength(1);
  });

  test('the old editor\'s all-zero default counts as no requirements, unchanged when left empty', () => {
    const ev = { requirements: { reputation_min: 0, brand_trust_min: 0, coins_min: 0 } };
    expect(requirementsDraftFrom(ev)).toEqual({ reputation_min: '', brand_trust_min: '', coins_min: '' });
    expect(buildRequirementsUpdate(ev, requirementsDraftFrom(ev)).unchanged).toBe(true);
  });
});

describe('restrictions', () => {
  test('stored array normalised; strings accepted; junk dropped', () => {
    expect(restrictionsOf({ restrictions: [{ type: 'exclusivity', description: 'No rivals' }, 'No leaks', { description: '' }, 7] }))
      .toEqual([{ type: 'exclusivity', description: 'No rivals' }, { type: 'other', description: 'No leaks' }]);
    expect(restrictionsOf({ restrictions: null })).toEqual([]);
    expect(restrictionsOf({ restrictions: '[{"type":"other","description":"x"}]' })).toEqual([{ type: 'other', description: 'x' }]);
  });

  test('add appends; remove drops by index; empty text is an error', () => {
    const ev = { restrictions: [{ type: 'exclusivity', description: 'No rivals' }] };
    expect(buildRestrictionAdd(ev, '  No leaks ').body).toEqual({
      restrictions: [{ type: 'exclusivity', description: 'No rivals' }, { type: 'other', description: 'No leaks' }],
    });
    expect(buildRestrictionAdd(ev, ' ').error).toBeTruthy();
    expect(buildRestrictionRemove(ev, 0).body).toEqual({ restrictions: [] });
    expect(restrictionLabel('exclusivity')).toBe('Exclusivity');
    expect(restrictionLabel('other')).toBe('Restriction');
  });
});

describe('compensation', () => {
  test('summary', () => {
    expect(describeCompensation({ is_paid: true, payment_amount: 1500 }).summary).toBe('Paid: 1500 coins');
    expect(describeCompensation({ is_paid: false, payment_amount: 0 }).summary).toBe('Unpaid');
    // Carried from an opportunity with is_paid off (Evoni, 2026-09-24).
    expect(describeCompensation({ is_paid: false, payment_amount: 1500 }).summary).toBe('Agreed: 1500 coins (not paid out)');
  });

  test('paid needs a whole amount above 0; unpaid keeps the stored amount', () => {
    const ev = { is_paid: false, payment_amount: 0 };
    expect(buildCompensationUpdate(ev, { is_paid: true, payment_amount: '1500' }))
      .toEqual({ body: { is_paid: true, payment_amount: 1500 }, unchanged: false, errors: [] });
    expect(buildCompensationUpdate(ev, { is_paid: true, payment_amount: '' }).errors).toHaveLength(1);
    expect(buildCompensationUpdate(ev, { is_paid: true, payment_amount: '12.5' }).errors).toHaveLength(1);
    expect(buildCompensationUpdate(ev, compensationDraftFrom(ev)).unchanged).toBe(true);
    const paid = { is_paid: true, payment_amount: 1500 };
    expect(buildCompensationUpdate(paid, { is_paid: false, payment_amount: '1500' }).body).toEqual({ is_paid: false, payment_amount: 1500 });
    const agreed = { is_paid: false, payment_amount: 1500 };
    expect(buildCompensationUpdate(agreed, compensationDraftFrom(agreed)).unchanged).toBe(true);
  });
});

describe('deliverable form', () => {
  test('body trims and nulls empties; description required', () => {
    expect(buildDeliverableBody({ description: ' Tagged post ', deliverable_type: ' ', due_date: '2026-11-07', required: false }))
      .toEqual({ body: { description: 'Tagged post', deliverable_type: null, due_date: '2026-11-07', required: false } });
    expect(buildDeliverableBody({ description: '' }).error).toBeTruthy();
    expect(deliverableDraftFrom(null)).toEqual({ description: '', deliverable_type: '', due_date: '', required: true });
  });
});
