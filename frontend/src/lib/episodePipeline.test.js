/**
 * The Production tab's stages, pipeline and event panel (Evoni's mock,
 * 2026-10-07): a stage is the episode's status.
 */
import { describe, test, expect, vi } from 'vitest';
import { stageOf, episodeCode, episodeName, seasonContextOf, episodeTags, openSlots, cardLine, pipelineColumns, pipelineSummary, eventPanel, pipelineSteps, matchesSearch } from './episodePipeline';

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

describe('episode codes across seasons (2026-10-25)', () => {
  test("a slotted episode reads its slot label, not the show-wide number", () => {
    const opener = { season_number: 2, episode_number: 25, season_context: { label: 'S2 · E1', slot_number: 1 } };
    expect(episodeCode(opener)).toBe('S2 · E1');
    expect(episodeName(opener)).toBe('Episode 1');
    expect(episodeCode({ ...opener, season_context: JSON.stringify(opener.season_context) })).toBe('S2 · E1');
  });
  test('no snapshot, or one that cannot be read: the old code', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(episodeCode({ season_number: 2, episode_number: 25, season_context: '{nope' })).toBe('S2 E25');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    expect(seasonContextOf({ season_context: null })).toBeNull();
    expect(episodeName({ episode_number: 3 })).toBe('Episode 3');
    expect(episodeName({})).toBeNull();
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

describe('the seven steps (Episodes mock, 2026-10-17)', () => {
  const SECTIONS = [
    { id: 'brief', items: [{ id: 'b1', required: true }] },
    { id: 'world', items: [{ id: 'w1', required: true }] },
    { id: 'scene', items: [{ id: 's1', required: true }] },
  ];
  const labels = (steps) => steps.map((s) => s.label);

  test('seven steps; a new draft is at Planning', () => {
    const steps = pipelineSteps({ episode: { id: 'e1', status: 'draft' } });
    expect(labels(steps)).toEqual(['Planning', 'Script', 'Production', 'Edit', 'Thumbnail', 'Review', 'Release']);
    expect(steps.find((s) => s.current).key).toBe('planning');
    expect(steps[1].href).toBe('/episodes/e1?tab=scripts');
  });

  test('each step from what the episode has', () => {
    const steps = pipelineSteps({
      episode: { id: 'e1', status: 'scripted', script_content: 'INT.', thumbnail_url: 'x.png' },
      checks: { b1: true, w1: true, s1: true }, sections: SECTIONS, clips: [{ beat_number: 1 }],
    });
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(done).toEqual({ planning: true, script: true, production: true, edit: false, thumbnail: true, review: false, release: false });
    expect(steps.find((s) => s.current).key).toBe('edit');
  });

  test('In review is Review done; Published is Release done', () => {
    expect(pipelineSteps({ episode: { status: 'in_review' } }).find((s) => s.key === 'review').done).toBe(true);
    expect(pipelineSteps({ episode: { status: 'published' } }).find((s) => s.key === 'release').done).toBe(true);
  });
});

describe('searching the board', () => {
  const ep = { kind: 'episode', episode: { season_number: 1, episode_number: 2, title: 'Gala Night', categories: ['grwm'] } };
  const slot = { kind: 'slot', slot: { label: 'S1 · E3', intention: { story_purpose: 'A boutique challenge' }, event: null } };
  test('by code, title, tags, or a slot’s purpose; every word must match', () => {
    expect(matchesSearch(ep, 'gala')).toBe(true);
    expect(matchesSearch(ep, 's1 e2')).toBe(true);
    expect(matchesSearch(ep, 'grwm night')).toBe(true);
    expect(matchesSearch(ep, 'boutique')).toBe(false);
    expect(matchesSearch(slot, 'boutique')).toBe(true);
    expect(matchesSearch(slot, '')).toBe(true);
  });
});
