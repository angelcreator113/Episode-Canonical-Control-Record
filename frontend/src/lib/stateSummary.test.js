/** The State front page's helpers: real data, no invented directions. */
import { describe, test, expect } from 'vitest';
import { deltaText, tensionBars, snapshotSummary, snapshotLine, episodeStates, whatChanged } from './stateSummary';

const pair = (a, b, state, extra = {}) => ({ char_a: { id: a, name: a }, char_b: { id: b, name: b }, tension_state: state, relationship_type: 'rival', conflict_summary: '', ...extra });

describe('stateSummary', () => {
  test('deltaText names the stats in order, signs them, skips zeros, reads a JSON string', () => {
    expect(deltaText({ coins: 120, stress: -2, reputation: 3, influence: 0 })).toBe('Reputation +3 · Stress −2 · Coins +120');
    expect(deltaText('{"brand_trust":1,"glow_up":2}')).toBe('Brand trust +1 · Glow up +2');
    expect(deltaText({})).toBe('');
    expect(deltaText('not json')).toBe('');
  });

  test('tensionBars puts the hottest first, keeps the real state word, and caps the list', () => {
    const bars = tensionBars([pair('A', 'B', 'Simmering'), pair('C', 'D', 'Explosive'), pair('E', 'F', 'high'), { char_a: { name: 'X' }, char_b: {} }], 2);
    expect(bars.total).toBe(3);
    expect(bars.rows.map((r) => [r.names, r.label, r.tone])).toEqual([['C & D', 'Explosive', 'peach'], ['E & F', 'High', 'pink']]);
    expect(bars.rows[0].level).toBeGreaterThan(bars.rows[1].level);
    expect(tensionBars([pair('A', 'B', 'Simmering', { relationship_type: 'unknown' })]).rows[0].relationship).toBeNull();
  });

  test('snapshotSummary keeps the automatic temperature rows out of the snapshots and reads the latest temperature', () => {
    const s = snapshotSummary([
      { id: 't2', snapshot_label: 'temperature_update', created_at: '2026-10-03', metadata: { world_temperature: { value: 64 } } },
      { id: 'm2', snapshot_label: 'After the gala', created_at: '2026-10-02' },
      { id: 't1', snapshot_label: 'temperature_update', created_at: '2026-10-01', metadata: { world_temperature: { value: 50 } } },
      { id: 'm1', snapshot_label: 'The world before Lala', created_at: '2026-09-01' },
    ]);
    expect(s.baseline.id).toBe('m1');
    expect(s.saved.map((x) => x.id)).toEqual(['m2', 'm1']);
    expect(s.temperature).toBe(64);
    expect(s.autoCount).toBe(2);
    expect(snapshotSummary(null)).toEqual({ baseline: null, saved: [], temperature: null, autoCount: 0 });
  });

  test('snapshotLine counts facts and threads', () => {
    expect(snapshotLine({ world_facts: ['a', 'b'], active_threads: ['t'] })).toBe('2 facts · 1 thread');
    expect(snapshotLine({})).toBe('No facts written');
  });

  test("episodeStates sums an episode's computed rows, marks accepted ones done and ends on the next one not done", () => {
    const episodes = [
      { id: 'e3', episode_number: 3, title: 'Three' },
      { id: 'e1', episode_number: 1, title: 'One', evaluation_status: 'accepted' },
      { id: 'e2', episode_number: 2, title: 'Two' },
      { id: 'e4', episode_number: 4, title: 'Four' },
    ];
    const history = [
      { episode_id: 'e1', source: 'computed', deltas_json: { reputation: 2, coins: 0 } },
      { episode_id: 'e1', source: 'computed', deltas_json: '{"coins":150}' },
      { episode_id: 'e2', source: 'manual', deltas_json: { stress: 1 } },
    ];
    const s = episodeStates(episodes, history);
    expect(s.rows.map((r) => [r.number, r.done, r.changes])).toEqual([[1, true, 'Reputation +2 · Coins +150'], [2, false, '']]);
    expect(s.total).toBe(4);
    expect(episodeStates(episodes, history, 1)).toMatchObject({ earlier: 1, rows: [{ number: 2 }] });
    expect(episodeStates([], [])).toEqual({ rows: [], earlier: 0, total: 0 });
  });

  test("whatChanged lists the ledger newest first with who and when, one change per episode, skipping rows that moved nothing", () => {
    const rows = whatChanged([
      { id: 'h2', character_key: 'lala', source: 'manual', deltas_json: { stress: -1 }, created_at: '2026-10-03' },
      { id: 'h3', character_key: 'lala', source: 'wardrobe_purchase', deltas_json: { coins: 0 }, created_at: '2026-10-04' },
      { id: 'h4', character_key: 'nia_vale', source: 'wardrobe_purchase', deltas_json: { coins: -40 }, created_at: '2026-10-02' },
      { id: 'h0', character_key: 'lala', source: 'computed', episode_id: 'e1', episode_number: 1, deltas_json: { reputation: 3 }, created_at: '2026-10-01' },
      { id: 'h1', character_key: 'lala', source: 'computed', episode_id: 'e1', episode_number: 1, deltas_json: '{"coins":150}', created_at: '2026-10-01T01:00:00Z' },
    ]);
    expect(rows).toEqual([
      { id: 'h2', who: 'Lala', when: 'edited by hand', text: 'Stress −1' },
      { id: 'h4', who: 'Nia vale', when: 'a wardrobe purchase', text: 'Coins −40' },
      { id: 'h1', who: 'Lala', when: 'after Episode 1', text: 'Reputation +3 · Coins +150' },
    ]);
  });
});
