import { describe, test, expect } from 'vitest';
import { alwaysTrue, decisions, canonItems, canonFindings, GUARD_BATCH } from './showBibleSummary';

describe('the Show Bible front page helpers', () => {
  test('always true is the active always-inject entries, critical first, labelled by section or category', () => {
    const rules = alwaysTrue([
      { id: 1, status: 'active', always_inject: true, severity: 'important', title: 'B rule', category: 'brand' },
      { id: 2, status: 'active', always_inject: true, severity: 'critical', title: 'Lala does not know she is in a show.', category: 'franchise_law', content: JSON.stringify({ section: 'canon_rules' }) },
      { id: 3, status: 'pending_review', always_inject: true, severity: 'critical', title: 'Pending' },
      { id: 4, status: 'active', always_inject: false, severity: 'critical', title: 'Not injected' },
    ]);
    expect(rules.map((r) => [r.label, r.text, r.critical])).toEqual([
      ['Canon Rules', 'Lala does not know she is in a show.', true],
      ['Brand', 'B rule', false],
    ]);
  });

  test('decisions are the active locked decisions, newest first, with what they affect', () => {
    const list = decisions([
      { id: 1, status: 'active', category: 'locked_decision', title: 'Older', created_at: '2026-09-02T00:00:00Z', applies_to: ['show_brain'] },
      { id: 2, status: 'active', category: 'locked_decision', title: 'Newer', created_at: '2026-10-02T00:00:00Z', applies_to: '["feed","release"]' },
      { id: 3, status: 'archived', category: 'locked_decision', title: 'Archived', created_at: '2026-10-05T00:00:00Z' },
      { id: 4, status: 'active', category: 'franchise_law', title: 'A law', created_at: '2026-10-05T00:00:00Z' },
    ]);
    expect(list.map((d) => d.text)).toEqual(['Newer', 'Older']);
    expect(list[0].affects).toEqual(['Feed', 'Release']);
    expect(list[1].affects).toEqual(['Show brain']);
    expect(list[0].when).toMatch(/2026/);
  });

  test('the canon items are every episode and event, keyed and linked, in batches of 25', () => {
    const episodes = [{ id: 'ep1', episode_number: 1, title: 'Planning', description: 'No venue yet.' }];
    const events = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, name: `Event ${i}`, venue_name: i === 0 ? "STUDIO BY SABLE's Studio" : null }));
    const batches = canonItems({ episodes, events, showId: 'show-b' });
    expect(batches.map((b) => b.length)).toEqual([GUARD_BATCH, 31 - GUARD_BATCH]);
    expect(batches[0][0]).toEqual({ key: 'episode:ep1', label: 'Episode 1 · Planning', brief: 'Episode 1 · Planning\nNo venue yet.', to: '/episodes/ep1' });
    expect(batches[0][1].brief).toBe("Event: Event 0\nVenue: STUDIO BY SABLE's Studio");
    expect(batches[0][1].to).toBe('/shows/show-b/events/e0');
    expect(canonItems({ episodes: [], events: [], showId: 'show-b' })).toEqual([]);
  });

  test('findings sit on the item the guard named; an unnamed one is about the whole show; passes and failures add none', () => {
    const items = [{ key: 'episode:ep1', label: 'Episode 1 · Planning', to: '/episodes/ep1' }];
    const findings = canonFindings([
      { items, result: { status: 'issues', warnings: [{ item: 'episode:ep1', law: 'Venues', risk: 'Says "No venue"', suggestion: 'Name the venue' }, { item: null, law: 'Tone', risk: 'Too dark' }] } },
      { items, result: { status: 'passed', warnings: [] } },
      { items, result: { status: 'check_failed', warnings: [] } },
    ]);
    expect(findings.map((f) => [f.label, f.kind, f.to, f.risk])).toEqual([
      ['Episode 1 · Planning', 'episode', '/episodes/ep1', 'Says "No venue"'],
      [null, null, null, 'Too dark'],
    ]);
  });
});
