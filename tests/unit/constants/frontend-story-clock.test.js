/** frontend/src/lib/storyClock.js mirrors src/services/storyClock.js's phases (2026-10-04). */
const fs = require('fs');
const path = require('path');
const { PHASES } = require('../../../src/services/storyClock');

const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'storyClock.js'), 'utf8');

describe('frontend story clock', () => {
  test('the same phases', () => {
    const m = /export const PHASES = (\{[^}]+\});/.exec(src);
    expect(m).toBeTruthy();
    expect(Function(`return ${m[1]}`)()).toEqual(PHASES);
  });
});
