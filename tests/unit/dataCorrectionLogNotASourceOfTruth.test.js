/**
 * data_correction_log is an audit and undo record only (Evoni, 2026-11-04): Prime
 * Bank, wardrobe ownership and episode continuity are never read from it, and no
 * application code reads or writes it. Only its migration may name it; the reviewed
 * correction scripts live under docs/, outside the application.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['src', 'frontend/src'].map((p) => path.join(__dirname, '..', '..', p));
const ALLOWED = new Set([
  path.join('src', 'migrations', '20261104170000-create-data-correction-log.js'),
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(c|m)?(j|t)sx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('data_correction_log is not read or written by the application', () => {
  test('only its migration names the table', () => {
    const root = path.join(__dirname, '..', '..');
    const offenders = ROOTS.flatMap((r) => walk(r))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('data_correction_log'))
      .map((file) => path.relative(root, file))
      .filter((rel) => !ALLOWED.has(rel));
    expect(offenders).toEqual([]);
  });
});
