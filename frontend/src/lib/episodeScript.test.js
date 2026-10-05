import { describe, test, expect } from 'vitest';
import { scriptInputs } from './episodeScript';

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
    expect(rows.map((r) => r.label)).toEqual(['Brief', 'Event', 'Place', 'Stakes', 'Cast', 'Look']);
    expect(rows.map((r) => r.ok)).toEqual([true, true, true, true, false, false]);
    expect(rows[1].detail).toBe('Wearable Experiments');
    expect(rows[2].detail).toBe("SABLE's Studio");
    expect(rows[4].detail).toBe('full guest list (none featured)');
  });
  test('a brief with gaps and no event say so', () => {
    const rows = scriptInputs({ brief: { ...BRIEF, forward_hook: '' }, plan: null });
    expect(rows[0]).toMatchObject({ ok: false, detail: 'missing forward hook' });
    expect(rows[1]).toMatchObject({ ok: false, detail: 'no source event' });
  });
});
