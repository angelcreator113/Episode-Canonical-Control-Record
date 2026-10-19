/**
 * Deliverables that check themselves (services/deliverableProgress): how a
 * deliverable's posts count, and how the likely posts are ranked. Pure.
 */
const dp = require('../../../src/services/deliverableProgress');

const live = (id, format, extra = {}) => ({ id, status: 'live', post_format: format, posted_at: `2026-10-1${id}T10:00:00Z`, ...extra });

describe('deliverableProgress', () => {
  test('a deliverable counts its live posts of its format: "Pulse stories: 2 of 3"', () => {
    const d = { id: 'd1', deliverable_type: 'pulse_stories', quantity: 3, description: '3 Pulse stories' };
    const p = dp.progressOf(d, [live(1, 'story'), live(2, 'story'), live(3, 'post')]);
    expect(p).toMatchObject({ countable: true, format: 'story', quantity: 3, counted: 2, done: false, line: 'Pulse stories: 2 of 3' });
    expect(p.posts.map((x) => x.counts)).toEqual([true, true, false]);
  });

  test('done when the quantity is met, at the time the last needed one went out; a story that has ended still counts', () => {
    const d = { id: 'd1', deliverable_type: 'pulse_stories', quantity: 2 };
    const ended = live(1, 'story', { posted_at: '2026-10-01T10:00:00Z' });
    const p = dp.progressOf(d, [ended, live(4, 'story')]);
    expect(p.done).toBe(true);
    expect(p.line).toBe('Pulse stories: 2 of 2');
    expect(p.done_at).toBe('2026-10-14T10:00:00.000Z');
  });

  test('a post taken down or deleted stops counting', () => {
    const d = { id: 'd1', deliverable_type: 'pulse_video', quantity: 1 };
    expect(dp.progressOf(d, [live(1, 'video', { status: 'draft' })]).counted).toBe(0);
    expect(dp.progressOf(d, [live(1, 'video', { deleted_at: '2026-10-15' })]).counted).toBe(0);
    expect(dp.progressOf(d, [live(1, null, { post_type: 'reel' })]).done).toBe(true);
  });

  test('link in bio, content for the brand and other are not posts: not counted, no line', () => {
    for (const type of ['link_in_bio', 'ugc', 'other']) {
      expect(dp.progressOf({ id: 'x', deliverable_type: type, quantity: 7, description: 'x' }, [live(1, 'post')]))
        .toMatchObject({ countable: false, counted: 0, done: false, line: null });
    }
  });

  test('a deal is done when every countable deliverable is', () => {
    const rows = [
      dp.progressOf({ id: 'a', deliverable_type: 'pulse_video', quantity: 1 }, [live(1, 'video')]),
      dp.progressOf({ id: 'b', deliverable_type: 'link_in_bio', quantity: 7 }, []),
    ];
    expect(dp.summarize('e', rows)).toMatchObject({ countable: 1, done: 1, all_done: true });
    rows.push(dp.progressOf({ id: 'c', deliverable_type: 'pulse_post', quantity: 2 }, [live(2, 'post')]));
    expect(dp.summarize('e', rows)).toMatchObject({ countable: 2, done: 1, all_done: false, done_at: null });
  });

  test('suggestions: naming the brand, then the event, then Lala posting it; ties to live, then newest', () => {
    const d = { brand_or_company: 'Velour Atelier', event_name: 'Velour Gala' };
    const posts = [
      { id: 'p1', content_text: 'a quiet day', status: 'live', posted_at: '2026-10-10', social_profile_id: 9 },
      { id: 'p2', content_text: 'at the velour gala tonight', status: 'live', posted_at: '2026-10-09', social_profile_id: 2 },
      { id: 'p3', content_text: 'wearing Velour Atelier', status: 'draft', posted_at: null, created_at: '2026-10-11', social_profile_id: 2 },
      { id: 'p4', content_text: 'a quiet day', status: 'draft', posted_at: null, created_at: '2026-10-12', social_profile_id: 2 },
    ];
    expect(dp.rankSuggestions(d, posts, { lalaProfileId: 9 }).map((p) => [p.id, p.score])).toEqual([['p3', 3], ['p2', 2], ['p1', 1], ['p4', 0]]);
  });
});
