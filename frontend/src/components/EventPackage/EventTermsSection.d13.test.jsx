/**
 * D13 (Evoni, 2026-09-30): the whole Terms section, drafted. Saving the
 * components drafts it on the server, so the lists reload; the relationship
 * goals show under the deliverables as Lala's goals (not owed); the drafted
 * bonus reads Auto-drafted until edited.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventTermsSection from './EventTermsSection';
import { bonusDraftNote, relationshipGoalsOf, relationshipGoalsDraftNote, buildRelationshipGoalRemove } from '../../utils/eventTerms';
import { costDraftNote } from '../../utils/eventCosts';

const GOALS = [
  { slot: 'relationship_host', label: 'Follow up with Celeste Rue after the event', description: 'A thank-you' },
  { slot: 'relationship_brand', label: 'Co-style a moment with Velour', description: 'Something Velour would share' },
];

const event = (over = {}) => ({
  id: 'ev-1', deal_type: 'brand_partnership', deal_components: ['paid_for_content', 'partnership_base'],
  partnership_base_fee: 500, bonus_terms: { slay: 165, pass: 85 },
  canon_consequences: { automation: {
    relationship_goals: GOALS,
    auto_drafted: { relationship_goals: 'deal', bonus_terms: 'deal' },
    drafted_values: { relationship_goals: GOALS, bonus_terms: { slay: 165, pass: 85 } },
  } },
  ...over,
});

function renderTerms(props = {}) {
  const putEvent = vi.fn(async () => ({ data: { success: true } }));
  const onSaved = vi.fn(async () => {});
  const onToast = vi.fn();
  render(
    <EventTermsSection showId="show-1" eventId="ev-1" event={event()} locked={false}
      putEvent={putEvent} onSaved={onSaved} onToast={onToast} {...props} />
  );
  return { putEvent, onSaved, onToast };
}

describe('EventTermsSection (D13)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], costs: [], drafted: {}, deal: true, locked: false } });
  });

  test('the relationship goals show as Lala\'s goals, not owed, and can be removed', async () => {
    const { putEvent } = renderTerms();
    const goals = screen.getByTestId('terms-relationship-goals');
    expect(within(goals).getByText("Lala's goals (not owed)")).toBeTruthy();
    expect(within(goals).getByText('Follow up with Celeste Rue after the event')).toBeTruthy();
    expect(within(goals).getByText(/Auto-drafted · from deal\. Start Episode adds these to Lala's goals/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('terms-relationship-goal-remove-0'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({
      canon_consequences: { automation: { relationship_goals: [GOALS[1]] } },
    }));
  });

  test('locked: the goals show with no remove', () => {
    renderTerms({ locked: true });
    expect(screen.getByTestId('terms-relationship-goals')).toBeTruthy();
    expect(screen.queryByTestId('terms-relationship-goal-remove-0')).toBeNull();
  });

  test('the drafted bonus reads Auto-drafted', () => {
    renderTerms();
    expect(screen.getByTestId('terms-bonus-note').textContent).toContain('Auto-drafted · suggested: slay 20%, pass 10% of the cash total');
  });

  test('saving the components reloads the deliverables the server drafted', async () => {
    const { putEvent } = renderTerms();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/deliverables'));
    const before = vi.mocked(api.get).mock.calls.filter(([url]) => url.endsWith('/deliverables')).length;
    fireEvent.click(screen.getByTestId('terms-deal-type-edit'));
    fireEvent.click(screen.getByTestId('terms-deal-component-performance_fee'));
    fireEvent.click(screen.getByTestId('terms-deal-type-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalled());
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([url]) => url.endsWith('/deliverables')).length).toBeGreaterThan(before));
  });
});

describe('D13 helpers', () => {
  test('bonusDraftNote: Auto-drafted while equal, then Edited; none without a record', () => {
    expect(bonusDraftNote(event())).toMatch(/^Auto-drafted/);
    expect(bonusDraftNote(event({ bonus_terms: { slay: 50 } }))).toBe('Edited');
    expect(bonusDraftNote({ bonus_terms: { slay: 50 } })).toBeNull();
  });

  test('relationship goals: listed, noted, removed one at a time', () => {
    expect(relationshipGoalsOf(event())).toHaveLength(2);
    expect(relationshipGoalsDraftNote(event())).toBe('Auto-drafted · from deal');
    const edited = event();
    edited.canon_consequences.automation.relationship_goals = [GOALS[0]];
    expect(relationshipGoalsDraftNote(edited)).toBe('Edited');
    expect(buildRelationshipGoalRemove(event(), 1).body.canon_consequences.automation.relationship_goals).toEqual([GOALS[0]]);
    expect(relationshipGoalsOf({})).toEqual([]);
  });

  test('costDraftNote: travel, and an edited payer', () => {
    expect(costDraftNote({ id: 'c1', amount: 0, paid_by: 'lala' }, { c1: { key: 'travel', amount: 0, paid_by: 'lala', source: 'travel' } }))
      .toBe('Auto-drafted · Lala travels');
    expect(costDraftNote({ id: 'c1', amount: 100, paid_by: 'host' }, { c1: { key: 'entry', amount: 100, paid_by: 'lala', source: 'event_cost' } }))
      .toBe('Edited');
  });
});
