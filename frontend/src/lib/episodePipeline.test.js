/**
 * The Production tab's stages, pipeline and event panel (Evoni's mock,
 * 2026-10-07): a stage is the episode's status.
 */
import { describe, test, expect } from 'vitest';
import { stageOf, episodeCode, episodeTags, openSlots, cardLine, pipelineColumns, pipelineSummary, eventPanel } from './episodePipeline';

describe('stageOf', () => {
  test('each status has its stage; archived has none', () => {
    expect(['draft', 'scripted', 'in_build', 'in_review', 'review', 'scheduled', 'published', undefined].map((status) => stageOf({ status })))
      .toEqual(['planning', 'script', 'production', 'edit', 'edit', 'released', 'released', 'planning']);
    expect(stageOf({ status: 'draft', evaluation_status: 'accepted' })).toBe('released');
    expect(stageOf({ status: 'archived' })).toBeNull();
  });
});

describe('episode labels', () => {
  test('code, tags and the card line', () => {
    expect(episodeCode({ season_number: 2, episode_number: 4 })).toBe('S2 E4');
    expect(episodeCode({ episode_number: 1 })).toBe('S1 E1');
    expect(episodeTags({ categories: '["a"," b ",""]' })).toEqual(['a', 'b']);
    expect(episodeTags({ categories: null })).toEqual([]);
    expect(cardLine({ status: 'draft' })).toBe('needs script');
    expect(cardLine({ status: 'draft', script_content: 'x' })).toBe('Draft');
    expect(cardLine({ status: 'in_build' })).toBe('In build');
  });
});

describe('pipeline', () => {
  const roadmap = { phases: [{ slots: [{ id: 'b', slot_number: 2, episode: null }, { id: 'a', slot_number: 1, episode: { id: 'e1' } }] }, { slots: [{ id: 'c', slot_number: 3 }] }] };
  test('open slots are the slots with no episode, in order', () => {
    expect(openSlots(roadmap).map((s) => s.id)).toEqual(['b', 'c']);
    expect(openSlots(null)).toEqual([]);
  });

  test('columns put episodes by stage and the open slots under Planning', () => {
    const cols = pipelineColumns([{ id: 'e2', episode_number: 2, status: 'scripted' }, { id: 'e1', episode_number: 1, status: 'draft' }, { id: 'x', status: 'archived' }], roadmap);
    expect(cols.map((c) => [c.key, c.cards.map((k) => k.id)])).toEqual([
      ['planning', ['e1', 'slot-b', 'slot-c']], ['script', ['e2']], ['production', []], ['edit', []], ['released', []],
    ]);
  });

  test('the summary counts episodes, and open slots when there is a season', () => {
    expect(pipelineSummary([{ status: 'draft' }], roadmap)).toBe('1 episode · 2 open slots');
    expect(pipelineSummary([{ status: 'draft' }, { status: 'archived' }], null)).toBe('1 episode');
  });
});

describe('eventPanel', () => {
  test('venue and city through the automation copy, date and time as written, pay', () => {
    const p = eventPanel({ id: 'e', name: 'Session', payment_amount: '439', event_date: 'Nov 12', canon_consequences: { automation: { venue_name: 'Studio', venue_location_id: 'l1', event_time: '6:30 PM' } } }, [{ id: 'l1', city: 'Echo Park' }]);
    expect(p).toMatchObject({ name: 'Session', place: 'Studio · Echo Park', when: 'Nov 12 · 6:30 PM', earns: 439 });
    expect(p.stillNeeded.join('; ')).not.toMatch(/Place: [^;]*venue/);
    expect(p.stillNeeded).toContain('People: featured attendees');
  });

  test('no event, no panel; no pay, no earns line', () => {
    expect(eventPanel(null)).toBeNull();
    expect(eventPanel({ name: 'Free' }).earns).toBeNull();
  });
});
