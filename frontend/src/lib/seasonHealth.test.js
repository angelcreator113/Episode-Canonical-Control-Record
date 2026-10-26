/** lib/seasonHealth: the Season page's health line and its tone rule (round 3, 2026-10-26). */
import { describe, test, expect } from 'vitest';
import { seasonHealth, healthTone, goalsBehind, partReadiness } from './seasonHealth';

const slot = (n, phase, state) => ({ id: `s${n}`, slot_number: n, phase, state });
const roadmap = {
  season_number: 1,
  phases: [
    { phase: 1, title: 'Foundation', slots: [slot(1, 1, 'done'), slot(2, 1, 'in_production'), slot(3, 1, 'event_ready'), slot(4, 1, 'needs_event')] },
    { phase: 2, title: 'Ascension', slots: [slot(5, 2, 'needs_event')] },
  ],
};
const arc = { id: 'a1', season_number: 1, current_phase: 1, status: 'active' };
const release = (row) => ({ state: 'active', schedule: { day: 'sun' }, seasons: [], episodes: row ? [row] : [], slots: {} });

describe('the tone rule', () => {
  test('Behind with an overdue release; Needs attention with something soon or a goal behind; else On track', () => {
    expect(healthTone({ attention: [{ tone: 'calm' }, { tone: 'overdue' }] })).toBe('behind');
    expect(healthTone({ attention: [{ tone: 'soon' }] })).toBe('attention');
    expect(healthTone({ attention: [{ tone: 'calm' }], behind: [{ id: 'g' }] })).toBe('attention');
    expect(healthTone({ attention: [{ tone: 'calm' }] })).toBe('on_track');
    expect(healthTone({ attention: [{ tone: 'overdue' }], complete: true })).toBe('complete');
  });
});

describe('the pieces', () => {
  test('the part in progress: ready is any slot with an event or an episode', () => {
    expect(partReadiness(roadmap, arc)).toEqual({ phase: 1, title: 'Foundation', ready: 3, total: 4 });
    expect(partReadiness(roadmap, { current_phase: 2 })).toEqual({ phase: 2, title: 'Ascension', ready: 0, total: 1 });
  });

  test('goals behind: a gap in the part in progress (not a later one) or off track, each once', () => {
    const coverage = {
      goals: [{ id: 'g1', title: 'Save coins', covered: true }, { id: 'g2', title: 'Keep stress down', off_track: true, covered: false }, { id: 'g3', title: 'Later', covered: true }],
      parts: [{ phase: 1, gaps: [{ goal_id: 'g1', title: 'Save coins' }] }, { phase: 2, gaps: [{ goal_id: 'g3', title: 'Later' }] }],
    };
    expect(goalsBehind(coverage, { arc }).map((g) => g.title)).toEqual(['Save coins', 'Keep stress down']);
    expect(goalsBehind(null, { arc })).toBeNull();
  });

  test('the whole line, in words', () => {
    const h = seasonHealth({
      arc, roadmap, coverage: { parts: [{ phase: 1, gaps: [{ goal_id: 'g1', title: 'Save coins' }, { goal_id: 'g2', title: 'Earn trust' }] }] },
      release: release({ episode_id: 'e', season_number: 1, number: 2, date: '2026-11-01', source: 'schedule', due: 'later' }),
      attention: [{ tone: 'calm' }], today: '2026-10-26',
    });
    expect(h.tone).toBe('attention');
    expect(h.text).toBe('Needs attention · Part 1 is 3 of 4 ready · 2 goals behind · next release Sun, Nov 1');
  });

  test('on track with no goals behind; an overdue episode says when it was due', () => {
    const h = seasonHealth({
      arc, roadmap, coverage: { parts: [] },
      release: release({ episode_id: 'e', season_number: 1, number: 3, date: '2026-10-25', source: 'schedule', due: 'overdue' }),
      attention: [{ tone: 'overdue' }], today: '2026-10-26',
    });
    expect(h.text).toBe('Behind · Part 1 is 3 of 4 ready · no goals behind · E3 was due Sun, Oct 25');
    expect(seasonHealth({ arc, roadmap, coverage: { parts: [] }, release: release(null), attention: [], today: '2026-10-26' }).text)
      .toBe('On track · Part 1 is 3 of 4 ready · no goals behind · not releasing yet');
  });

  test('a past season: no goals (they are the show\'s), its episodes done, and Season complete', () => {
    const h = seasonHealth({ arc: { ...arc, status: 'completed' }, roadmap, coverage: { parts: [{ phase: 1, gaps: [{ goal_id: 'g' }] }] }, release: release(null), attention: [], isCurrent: false });
    expect(h.text).toBe('Season complete · 1 of 5 episodes done');
  });
});
