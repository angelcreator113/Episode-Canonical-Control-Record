/** frontend/src/lib/storyClock.js mirrors src/services/storyClock.js's phases (2026-10-04). */
const fs = require('fs');
const path = require('path');
const { PHASES, beatOrder } = require('../../../src/services/storyClock');

const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'storyClock.js'), 'utf8');

describe('frontend story clock', () => {
  test('the same phases', () => {
    const m = /export const PHASES = (\{[^}]+\});/.exec(src);
    expect(m).toBeTruthy();
    expect(Function(`return ${m[1]}`)()).toEqual(PHASES);
  });

  test("the same beat order: a beat is its episode's During (Task 2986)", () => {
    const m = /export function beatOrder\(episodeNumber\) \{[\s\S]*?\n\}/.exec(src);
    expect(m).toBeTruthy();
    expect(m[0]).toContain('PHASES.during_episode');
    expect(beatOrder(1)).toBe(1 * 10 + PHASES.during_episode);
  });
});
