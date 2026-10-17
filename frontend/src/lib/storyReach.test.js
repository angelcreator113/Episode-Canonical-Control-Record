/**
 * Where the inner life goes (step 4). The map must match the code: every
 * field a writer is said to read appears in that writer's source files.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { WRITERS, READ_AS, INNER_LIFE_FIELDS, reachOf, unreached, shortText } from './storyReach';

const repo = resolve(__dirname, '../../..');

describe('the map matches the code', () => {
  for (const w of WRITERS.filter((x) => x.sources.length)) {
    test(`${w.label}: every field it is said to read is in its sources`, () => {
      const code = w.sources.map((f) => readFileSync(resolve(repo, f), 'utf8')).join('\n');
      for (const field of [...w.shows, ...w.private, ...w.unmarked]) {
        // A bare 'wound' would match core_wound; look for it as its own key.
        const names = [field, ...(READ_AS[field] || [])].join('|');
        const pattern = field === 'wound' ? /(['"`.]|\b)wound\b(?!_)/ : new RegExp(`\\b(${names})\\b`);
        expect(code, `${field} in ${w.sources.join(', ')}`).toMatch(pattern);
      }
    });
  }

  test('no field is listed twice for one writer', () => {
    for (const w of WRITERS) {
      const all = [...w.shows, ...w.private, ...w.unmarked];
      expect(new Set(all).size, w.key).toBe(all.length);
    }
  });

  test('events read no inner life, and say so', () => {
    const events = WRITERS.find((w) => w.key === 'events');
    expect([...events.shows, ...events.private, ...events.unmarked]).toEqual([]);
    expect(events.note).toMatch(/No event writer/);
  });
});

describe('for one character', () => {
  const C = {
    mask_persona: 'Effortless and booked', living_state: { current_situation: 'Between leases' },
    core_wound: '', blind_spot: 'She keeps score.', triggers: ['Silence'], experience_of_joy: 'Fittings',
    time_orientation: 'future_oriented', extra_fields: { dilemma: { central_tension: 'Stay or go' } },
  };

  test('each writer with its fields, written ones with their words', () => {
    const posts = reachOf(C).find((w) => w.key === 'posts');
    expect(posts.shows.find((i) => i.field === 'mask_persona')).toEqual({ field: 'mask_persona', label: 'Mask persona', text: 'Effortless and booked' });
    expect(posts.private.find((i) => i.field === 'living_state').text).toBe('current situation: Between leases');
    expect(posts.private.find((i) => i.field === 'core_wound').text).toBeNull();
  });

  test('the blind spot is shown to the author only', () => {
    const scenes = (isAuthor) => reachOf(C, isAuthor).find((w) => w.key === 'scenes');
    expect(scenes(true).private.map((i) => i.field)).toContain('blind_spot');
    expect(scenes(false).private.map((i) => i.field)).not.toContain('blind_spot');
    expect(unreached(C, false).map((i) => i.field)).not.toContain('de_blind_spot_evidence');
  });

  test('what reaches no writer, written first', () => {
    const list = unreached(C);
    expect(list.map((i) => i.field)).toEqual(expect.arrayContaining(['triggers', 'experience_of_joy', 'dilemma']));
    expect(list.slice(0, 3).every((i) => i.text)).toBe(true);
    expect(list.find((i) => i.field === 'dilemma').text).toBe('central tension: Stay or go');
    expect(list.map((i) => i.field)).not.toContain('time_orientation');
    expect(INNER_LIFE_FIELDS).toContain('deep_profile');
  });

  test('short text: choices in words, long text clipped', () => {
    expect(shortText('future_oriented')).toBe('future oriented');
    expect(shortText({ mobility: 'conditionally_open', score: 40 })).toBe('mobility: conditionally open · score: 40');
    expect(shortText('x'.repeat(400))).toHaveLength(180);
    expect(shortText({ a: '', b: [] })).toBeNull();
  });
});
