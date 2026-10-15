/**
 * The deal checklist and the to-do mode by beat (Task #3191; Evoni,
 * 2026-10-14, Lala's Phone phase 3 rulings 3 and 6): [DELIVER: id] ticks a
 * deal item from its line without changing its status; [TODO_MODE] sets a
 * beat's list; otherwise Shopping through the closet beat, the deal at a
 * locked deal, else Career.
 */
const { parseScript } = require('../../../src/utils/scriptBeatParser');
const { scriptBeats } = require('../../../src/utils/scriptWear');
const { deliverCues, deliveredAt, todoModeAt } = require('../../../src/utils/scriptTodo');
const { dealLocationLabel } = require('../../../src/utils/socialTaskSource');
const { getTodoAt } = require('../../../src/services/dealChecklistService');

const SCRIPT = [
  '## BEAT: 7 · Interruption Pulse 2',
  'Lala: "A deal?"',
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  'Lala: "This one."',
  '## BEAT: 10 · Location',
  'Lala: "Here we go."',
  '[DELIVER: d-reel]',
  '[DELIVER: d-gone]',
  '## BEAT: 11 · Arrival',
  '[TODO_MODE: career]',
  '[DELIVER: d-story]',
].join('\n');
const DELIVERABLES = [
  { id: 'd-reel', description: 'One reel in the coat', owed_to: 'brand', required: true, status: 'pending' },
  { id: 'd-story', description: 'Three stories at the launch', owed_to: 'brand', required: true, status: 'approved' },
  { id: 'd-tag', description: 'Tag the host', owed_to: 'host', required: false, status: 'pending' },
];

describe('the parser keeps [DELIVER] and [TODO_MODE] on the beat', () => {
  test('each deliver cue with its id and line; the beat mode, the last valid one winning', () => {
    const { beats } = parseScript([
      '## BEAT: LOCATION', '[DELIVER: d-reel]', 'Lala: "Rolling."', '[DELIVER:  d-story ]',
      '[TODO_MODE: deal]', '[TODO_MODE: banana]',
    ].join('\n'));
    expect(beats[0].tags.deliver).toEqual([{ deliverable_id: 'd-reel', line: 2 }, { deliverable_id: 'd-story', line: 4 }]);
    expect(beats[0].tags.todo_mode).toBe('deal');
  });

  test('a beat with neither has no tags for them', () => {
    const { beats } = parseScript('## BEAT: OPEN\nLala: "Hi."');
    expect(beats[0].tags.deliver).toBeUndefined();
    expect(beats[0].tags.todo_mode).toBeUndefined();
  });
});

describe('ticks and the mode by beat', () => {
  const beats = scriptBeats(SCRIPT);

  test("a deliverable is ticked from its line; an id that isn't the event's ticks nothing", () => {
    expect(deliverCues(beats, DELIVERABLES).map((c) => [c.id, Boolean(c.deliverable)])).toEqual([['d-reel', true], ['d-gone', false], ['d-story', true]]);
    expect([...deliveredAt(beats, 2, 0, DELIVERABLES)]).toEqual([]);
    expect([...deliveredAt(beats, 2, 1, DELIVERABLES)]).toEqual(['d-reel']);
    expect([...deliveredAt(beats, 3, Infinity, DELIVERABLES)]).toEqual(['d-reel', 'd-story']);
  });

  test('Shopping through the closet beat, then the deal at a locked deal, else Career; a beat cue wins', () => {
    expect(todoModeAt(beats, 0, { dealLocked: true })).toEqual({ mode: 'shopping', source: 'auto' });
    expect(todoModeAt(beats, 1, { dealLocked: true })).toEqual({ mode: 'shopping', source: 'auto' });
    expect(todoModeAt(beats, 2, { dealLocked: true })).toEqual({ mode: 'deal', source: 'auto' });
    expect(todoModeAt(beats, 2, { dealLocked: false })).toEqual({ mode: 'career', source: 'auto' });
    expect(todoModeAt(beats, 3, { dealLocked: true })).toEqual({ mode: 'career', source: 'cue' });
    // No closet beat: no Shopping stretch.
    expect(todoModeAt(scriptBeats('## BEAT: 2 · Login\nHi'), 0, { dealLocked: true }).mode).toBe('deal');
  });
});

describe('the location label', () => {
  test("At <host_brand or host>'s <venue>", () => {
    expect(dealLocationLabel({ host_brand: 'STUDIO BY SABLE', host: 'Sable Reyes', venue_name: 'Studio' })).toBe("At STUDIO BY SABLE's Studio");
    expect(dealLocationLabel({ host: 'Maya', venue_name: 'Club Noir' })).toBe("At Maya's Club Noir");
    expect(dealLocationLabel({ host_brand: 'Sable' }, 'The Loft')).toBe("At Sable's Loft");
  });

  test('a venue already carrying the name reads alone; no venue, "For"; neither, the event', () => {
    expect(dealLocationLabel({ host_brand: 'Sable', venue_name: 'Studio by Sable' })).toBe('At Studio by Sable');
    expect(dealLocationLabel({ host_brand: 'Sable' })).toBe('For Sable');
    expect(dealLocationLabel({ name: 'Gala' })).toBe('At Gala');
    expect(dealLocationLabel(null)).toBe('The deal');
  });
});

describe('getTodoAt, read-only', () => {
  function fakeModels({ lockedTo = 'ep1' } = {}) {
    const query = jest.fn(async (sql) => {
      if (/^\s*(UPDATE|INSERT|DELETE)/i.test(sql)) throw new Error(`a write: ${sql}`);
      if (sql.includes('SELECT script_content')) return [{ script_content: SCRIPT }];
      if (sql.includes('FROM world_events WHERE id =')) return [{ id: 'ev1', name: 'Launch', host: 'Sable Reyes', host_brand: 'STUDIO BY SABLE', venue_name: null, venue_location_id: 'loc1' }];
      if (sql.includes('FROM world_locations')) return [{ name: 'Studio' }];
      if (sql.includes('FROM episode_briefs b')) return [lockedTo ? [{ id: lockedTo }] : [], {}];
      if (sql.includes('SELECT used_in_episode_id')) return [[], {}];
      if (sql.includes('FROM event_deliverables')) return DELIVERABLES;
      throw new Error(`unexpected SQL: ${sql}`);
    });
    return { sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
  }

  test("each item ticked at its cue reads ready to approve until approved; its status is the deliverable's own", async () => {
    const models = fakeModels();
    const at = await getTodoAt('ep1', models, { beat: 10 });
    expect(at).toMatchObject({ mode: 'deal', mode_source: 'auto', beat_found: true });
    expect(at.deal.label).toBe("At STUDIO BY SABLE's Studio");
    expect(at.deal.locked).toBe(true);
    expect(at.deal.items.map((i) => [i.deliverable_id, i.delivered, i.ready_to_approve, i.status])).toEqual([
      ['d-reel', true, true, 'pending'],
      ['d-story', false, false, 'approved'],
      ['d-tag', false, false, 'pending'],
    ]);
    expect(at.flags).toEqual([{ beat: 10, line: 2, id: 'd-gone' }]);
    // Nothing here writes.
    expect(models.sequelize.query.mock.calls.every(([sql]) => /^\s*SELECT/i.test(sql))).toBe(true);
  });

  test('by beat: Shopping through the closet; the beat cue; Career when the terms are not locked to this episode', async () => {
    expect((await getTodoAt('ep1', fakeModels(), { beat: 8 })).mode).toBe('shopping');
    expect(await getTodoAt('ep1', fakeModels(), { beat: 11 })).toMatchObject({ mode: 'career', mode_source: 'cue' });
    const other = await getTodoAt('ep1', fakeModels({ lockedTo: 'ep-other' }), { beat: 10 });
    expect(other.mode).toBe('career');
    expect(other.deal.locked).toBe(false);
  });

  test('a beat the script lacks: what came before it; no beat: the whole script', async () => {
    const nine = await getTodoAt('ep1', fakeModels(), { beat: 9 });
    expect(nine).toMatchObject({ beat_found: false, mode: 'deal' });
    expect(nine.deal.items.every((i) => !i.delivered)).toBe(true);
    const all = await getTodoAt('ep1', fakeModels(), {});
    expect(all.mode).toBe('deal');
    expect(all.deal.items.filter((i) => i.delivered).map((i) => i.deliverable_id)).toEqual(['d-reel', 'd-story']);
  });
});
