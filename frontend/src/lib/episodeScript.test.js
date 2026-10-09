import { describe, test, expect } from 'vitest';
import { scriptInputs, lookInput, careerInput } from './episodeScript';

const PLAN = { items: [
  { key: 'event', done: true, detail: 'Wearable Experiments · organized by SABLE' },
  { key: 'cast', done: false, detail: '5 invited, none featured' },
  { key: 'location', done: true, detail: "SABLE's Studio · Studio set" },
  { key: 'look', done: false, detail: 'Not chosen yet' },
  { key: 'stakes', done: true, detail: 'A first credit' },
] };
const BRIEF = { episode_archetype: 'Redemption', designed_intent: 'pass', narrative_purpose: 'x', forward_hook: 'y' };

describe('scriptInputs', () => {
  test('names what generation reads, lavender when there, amber when the script fills it', () => {
    const rows = scriptInputs({ brief: BRIEF, plan: PLAN });
    expect(rows.map((r) => r.label)).toEqual(['Brief', 'Event', 'Place', 'Stakes', 'Cast', 'Look', 'Career']);
    expect(rows.map((r) => r.ok)).toEqual([true, true, true, true, false, false, false]);
    expect(rows[1].detail).toBe('Wearable Experiments');
    expect(rows[2].detail).toBe("SABLE's Studio");
    expect(rows[4].detail).toBe('full guest list (none featured)');
  });
  test('a brief with gaps and no event say so', () => {
    const rows = scriptInputs({ brief: { ...BRIEF, forward_hook: '' }, plan: null });
    expect(rows[0]).toMatchObject({ ok: false, detail: 'missing forward hook' });
    expect(rows[1]).toMatchObject({ ok: false, detail: 'no source event' });
  });

  test('Look is the outfit locked on the Wardrobe tab, the one the script writer reads', () => {
    const locked = [{ name: 'Silk slip dress' }, { name: 'Strappy heels' }, { name: 'Mini clutch' }, { name: 'Gold hoops' }];
    expect(scriptInputs({ brief: BRIEF, plan: PLAN, outfit: locked })[5]).toMatchObject({
      label: 'Look', ok: true, detail: '4 pieces locked: Silk slip dress, Strappy heels, Mini clutch +1', fix: 'wardrobe',
    });
    expect(lookInput([{ name: 'Dress' }], null)).toEqual({ ok: true, detail: '1 piece locked: Dress' });
    // Planned in the event but not locked: the script does not use it yet.
    expect(lookInput([], { done: true })).toEqual({ ok: false, detail: 'planned in the event, not locked on the Wardrobe tab yet' });
    expect(lookInput([], null)).toEqual({ ok: false, detail: 'not locked on the Wardrobe tab yet' });
    expect(lookInput(null, { done: true })).toEqual({ ok: false, detail: 'the locked outfit could not be read' });
  });

  test("Career is the event's deal, what Lala owes and her goals, the script writer's career block", () => {
    const event = {
      id: 'ev-1', show_id: 'show-1', host: 'Sable', host_brand: 'Maison Rue', deal_components: ['paid_to_appear', 'paid_for_content'],
      canon_consequences: { automation: { relationship_goals: [{ label: 'Get booked again' }] } },
    };
    expect(scriptInputs({ brief: BRIEF, plan: PLAN, event, deliverables: [{ id: 'd1' }, { id: 'd2' }] })[6]).toEqual({
      key: 'career', label: 'Career', ok: true, detail: 'Appearance plus content from Maison Rue · 2 deliverables owed · 1 goal',
    });
    expect(careerInput({ deal_components: [] }, [])).toEqual({ ok: true, detail: 'Self-funded' });
    expect(careerInput({ is_paid: true, payment_amount: 250 }, [])).toEqual({ ok: true, detail: 'paid 250 coins' });
    expect(careerInput({ deal_components: ['gifted_items'], host: 'Sable' }, null)).toEqual({ ok: true, detail: 'Gifted from Sable · deliverables could not be read' });
    // Nothing for the script to use: amber, with the way to the event.
    expect(careerInput({ id: 'ev-2', show_id: 'show-1' }, [])).toEqual({
      ok: false, detail: 'no deal, deliverables or goals on the event', fix: 'event', to: '/shows/show-1/events/ev-2',
    });
    expect(careerInput(null, [])).toEqual({ ok: false, detail: 'no source event' });
  });
});
