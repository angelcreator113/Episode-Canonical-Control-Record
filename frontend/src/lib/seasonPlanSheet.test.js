/** lib/seasonPlanSheet: the season on one printable page (round 3, 2026-10-26). */
import { describe, test, expect } from 'vitest';
import { seasonPlanSheet } from './seasonPlanSheet';

const roadmap = {
  season_number: 1,
  phases: [
    { phase: 1, title: 'Foundation', tagline: 'She arrives', episode_start: 1, episode_end: 2, slots: [
      { id: 's2', slot_number: 2, state: 'needs_event', episode: null, event: null, intention: { story_purpose: 'Meet Marcus' } },
      { id: 's1', slot_number: 1, state: 'in_production', episode: { id: 'ep1', title: 'Opener' }, event: { id: 'ev1', name: 'Gala' } },
    ] },
  ],
};
const release = {
  state: 'active', schedule: { day: 'sun', time: '10:00', platforms: ['youtube'] },
  seasons: [{ season_number: 1, first_release: '2026-11-01', slots: { 2: { date: '2026-11-08', source: 'schedule' } } }],
  episodes: [{ episode_id: 'ep1', season_number: 1, date: '2026-11-01', source: 'schedule' }], slots: {},
};

describe('seasonPlanSheet', () => {
  test('parts with their slots in order and release days, events, goals, schedule; the logline is the pitch', () => {
    const sheet = seasonPlanSheet({
      arc: { title: 'Glow Up', tagline: 'Rising', season_number: 1, logline: 'Lala builds a name.', starts_on: '2026-11-01', ends_on: '2027-04-11' },
      roadmap, release,
      events: [{ id: 'ev1', name: 'Velour Gala', event_date: '2026-10-30', event_type: 'brand_deal' }],
      goals: [{ id: 'g1', title: 'Save coins', icon: '🪙', status: 'active', current_value: 600, target_value: 3000 }, { id: 'g2', title: 'Gone', status: 'archived' }],
    });
    expect(sheet).toMatchObject({ eyebrow: 'Season 1', title: 'Glow Up', pitch: 'Lala builds a name.', dates: 'Nov 1, 2026 – Apr 11, 2027', slotCount: 2 });
    expect(sheet.parts[0]).toMatchObject({ title: 'Foundation', range: 'E1 – E2' });
    expect(sheet.parts[0].slots).toEqual([
      { code: 'E1', title: 'Opener', event: 'Velour Gala', status: 'In Production', when: 'Sun, Nov 1' },
      { code: 'E2', title: 'Meet Marcus', event: null, status: 'Open', when: 'Sun, Nov 8' },
    ]);
    expect(sheet.events).toEqual([{ code: 'E1', name: 'Velour Gala', date: 'Oct 30, 2026', type: 'brand deal' }]);
    expect(sheet.goals).toEqual([{ id: 'g1', title: '🪙 Save coins', status: 'Active', progress: '600 of 3000' }]);
    expect(sheet.releases).toEqual({ line: 'Releases on YouTube every Sunday at 10:00 AM', start: 'Season 1 starts releasing Sun, Nov 1' });
  });

  test('no logline: the pitch is empty (the page marks the spot); no schedule: no release line', () => {
    const sheet = seasonPlanSheet({ arc: { title: 'X', season_number: 2 }, roadmap: null });
    expect(sheet.pitch).toBeNull();
    expect(sheet.releases).toBeNull();
    expect(sheet.parts).toEqual([]);
  });
});
