/**
 * Scene Sets header tiles, counts, sections and the angle hint (Evoni's
 * mock, 2026-10-07): made angles are the complete ones.
 */
import { describe, test, expect } from 'vitest';
import { angleCounts, angleLine, sceneSetTiles, typeCounts, sectionsOf, episodeChips, angleHint } from './sceneSetsSummary';

const ang = (status, cost = 0) => ({ id: Math.random().toString(36), generation_status: status, generation_cost: cost });
const HOME = { id: 'h', name: "Lala's home", scene_type: 'HOME_BASE', base_still_url: 'x', generation_cost: '0.2', angles: [ang('complete', 0.1), ang('pending')], episodes: [] };
const BED = { id: 'b', name: "Lala's bedroom", scene_type: 'HOME_BASE', base_still_url: 'x', angles: [ang('pending'), ang('failed')], episodes: [{ episode_number: 1 }] };
const VENUE = { id: 'v', name: 'Studio', scene_type: 'EVENT_LOCATION', angles: [], episodes: [{ episode_number: 3 }, { episode_number: 1 }] };
const ODD = { id: 'o', name: 'Odd', scene_type: 'MYSTERY', angles: [ang('complete')] };

describe('angles', () => {
  test('made is complete; the line says made of planned, all made, or none yet', () => {
    expect(angleCounts(HOME)).toEqual({ made: 1, total: 2 });
    expect(angleLine(HOME)).toBe('1 of 2 angles');
    expect(angleLine(ODD)).toBe('1 angle');
    expect(angleLine(VENUE)).toBe('No angles yet');
  });
});

describe('header and filters', () => {
  test('tiles: sets, angles made of planned, credits', () => {
    expect(sceneSetTiles([HOME, BED, VENUE]).map((t) => t.value)).toEqual(['3', '1/4', '0.3']);
  });
  test('type counts put an unknown type under Other', () => {
    expect(typeCounts([HOME, BED, VENUE, ODD])).toEqual({ ALL: 4, HOME_BASE: 2, CLOSET: 0, EVENT_LOCATION: 1, TRANSITION: 0, OTHER: 1 });
  });
  test('sections in type order, empty ones dropped, each keeping its order', () => {
    expect(sectionsOf([VENUE, HOME, ODD, BED]).map((s) => [s.title, s.sets.map((x) => x.id)])).toEqual([
      ['Home base', ['h', 'b']], ['Events', ['v']], ['Other', ['o']],
    ]);
  });
});

describe('episodes and the hint', () => {
  test('episode chips in order', () => {
    expect(episodeChips(VENUE)).toEqual(['Episode 1', 'Episode 3']);
  });
  test('the hint names the first used set short of angles, and the shots it has', () => {
    expect(angleHint([HOME, VENUE, BED])).toEqual({
      setId: 'b', lead: "Lala's bedroom has 0 of 2 angles.", text: 'Episode 1 uses it, so scenes there only have one shot to cut to.',
    });
    expect(angleHint([HOME, VENUE])).toBeNull();
  });
});
