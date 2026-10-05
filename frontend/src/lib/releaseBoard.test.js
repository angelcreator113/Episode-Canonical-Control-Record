import { describe, test, expect } from 'vitest';
import { nextRelease, goLive, formatWhen, readiness, releaseCalendar, releasedResults } from './releaseBoard';

const eps = [
  { id: 'e1', episode_number: 1, title: 'Studio', status: 'published', evaluation_json: { tier_final: 'slay' } },
  { id: 'e2', episode_number: 2, title: 'Gala', status: 'in_build', air_date: '2026-10-20T00:00:00.000Z' },
  { id: 'e3', episode_number: 3, title: 'Rooftop', status: 'scripted' },
  { id: 'e4', episode_number: 4, title: 'Old', status: 'archived' },
  { id: 'e5', episode_number: 5, title: 'Later', status: 'draft' },
];

describe('Release helpers', () => {
  test('the next release is the lowest-numbered episode not published or archived', () => {
    expect(nextRelease(eps).id).toBe('e2');
    expect(nextRelease([eps[0], eps[3]])).toBeNull();
  });

  test('it goes live on its air date, else its earliest platform schedule', () => {
    expect(goLive(eps[1])).toBe('2026-10-20T00:00:00.000Z');
    expect(goLive({ distribution_metadata: { tiktok: { scheduled_time: '2026-11-02T18:00' }, youtube: { scheduled_time: '2026-11-01T18:00' } } })).toBe('2026-11-01T18:00');
    expect(goLive({})).toBeNull();
  });

  test('a day reads as that calendar day; a time shows with it', () => {
    expect(formatWhen('2026-10-20T00:00:00.000Z')).toBe('Oct 20, 2026');
    expect(formatWhen('2026-10-20')).toBe('Oct 20, 2026');
    expect(formatWhen('2026-11-01T18:00')).toMatch(/^Nov 1, 2026, 6:00\sPM$/);
    expect(formatWhen(null)).toBeNull();
  });

  test('the checklist reads the status, the thumbnail, the approved title and copy, the posts and the date', () => {
    const bare = readiness({ status: 'draft' }, []);
    expect(bare.map((r) => [r.key, r.state, r.text])).toEqual([
      ['cut', 'todo', 'Not started'], ['thumbnail', 'todo', 'Missing'], ['copy', 'todo', 'Not started'],
      ['feed', 'todo', 'None yet'], ['schedule', 'todo', 'Not set'],
    ]);
    const ready = readiness({
      status: 'in_review', thumbnail_url: 'x.png', title: 'Gala', title_approved_at: 'now', title_approved_value: 'Gala',
      distribution_metadata: { youtube: { title: 'Gala night' } }, air_date: '2026-10-20',
    }, [{ status: 'draft' }, { status: 'live' }, { status: 'draft' }]);
    expect(ready.map((r) => [r.key, r.state, r.text])).toEqual([
      ['cut', 'ready', 'In review'], ['thumbnail', 'ready', 'Ready'], ['copy', 'ready', 'Title approved · copy written'],
      ['feed', 'ready', '2 drafts · 1 live'], ['schedule', 'ready', 'Oct 20, 2026'],
    ]);
    // A title edited after approval is no longer approved.
    expect(readiness({ status: 'in_build', title: 'New', title_approved_at: 'x', title_approved_value: 'Old', distribution_metadata: { tiktok: { caption: 'hi' } } }, null)
      .filter((r) => ['cut', 'copy', 'feed'].includes(r.key)).map((r) => [r.state, r.text]))
      .toEqual([['progress', 'In the edit'], ['progress', 'Copy written · title not approved'], ['todo', 'Loading…']]);
  });

  test('the calendar lists what is ahead, with its date or where it stands', () => {
    expect(releaseCalendar(eps).map(({ ep, state }) => [ep.id, state])).toEqual([['e2', 'Scheduled'], ['e3', 'Scripted'], ['e5', 'No date yet']]);
    expect(releaseCalendar(eps, 1)).toHaveLength(1);
  });

  test('results: released episodes newest first, their tier, and what their history rows did', () => {
    const history = [
      { episode_id: 'e1', deltas_json: { coins: 650, reputation: 2, stress: 0 } },
      { episode_id: 'e1', deltas_json: '{"coins":-50,"influence":1}' },
      { episode_id: 'e2', deltas_json: { coins: 999 } },
    ];
    expect(releasedResults(eps, history)).toEqual([
      { ep: eps[0], tier: 'slay', coins: 600, stats: [['reputation', 2], ['influence', 1]] },
    ]);
  });
});
