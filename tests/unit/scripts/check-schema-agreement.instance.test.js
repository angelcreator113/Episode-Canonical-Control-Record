/**
 * Task #1909 — step 1 of scripts/check-schema-agreement.js sees writes
 * through a loaded record.
 *
 * Runs the checker on its fixture (tests/fixtures/schema-agreement-step1/
 * loadedRecordWrites.js) with --step1-src, reads the JSON report, and checks
 * that each pattern is reported (names starting fx_hit_) and nothing else is
 * (names starting fx_miss_). Static read: the models load on a Sequelize
 * instance that never connects. No database.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const FIXTURE = 'tests/fixtures/schema-agreement-step1';

let hits;
beforeAll(() => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'schema-agreement-')), 'report.json');
  execFileSync(process.execPath, ['scripts/check-schema-agreement.js', '--step1-src', FIXTURE, '--json', out], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  hits = JSON.parse(fs.readFileSync(out, 'utf8')).step1.hits
    .map((h) => ({ file: h.file, key: `${h.model}.${h.method}\t${h.clause}\t${h.name}`, name: h.name }));
}, 60000);

test('every hit is in the fixture', () => {
  expect(hits.length).toBeGreaterThan(0);
  for (const h of hits) expect(h.file).toBe(`${FIXTURE}/loadedRecordWrites.js`);
});

test.each([
  ['x.update(values) on a findByPk row', 'ThumbnailComposition.instance.update\tvalues\tfx_hit_update'],
  ['x.attr = ... then x.save() on a findOne row', 'ThumbnailComposition.instance.save\tassigned\tfx_hit_assigned'],
  ['x.update() in for (const x of await Model.findAll())', 'ThumbnailComposition.instance.update\tvalues\tfx_hit_loop'],
  ['x.attr = ...; x.save() in for (const x of rows), rows from findAll', 'ThumbnailComposition.instance.save\tassigned\tfx_hit_list_assigned'],
  ['x.update(values) on a row from create', 'ThumbnailComposition.instance.update\tvalues\tfx_hit_created'],
])('reports %s', (_what, key) => {
  expect(hits.map((h) => h.key)).toContain(key);
});

test('reports nothing declared, nothing assigned after the last save or with no save, nothing shadowed, no plain object', () => {
  expect(hits.filter((h) => !h.name.startsWith('fx_hit_'))).toEqual([]);
  expect(hits.map((h) => h.name).sort()).toEqual([
    'fx_hit_assigned', 'fx_hit_created', 'fx_hit_list_assigned', 'fx_hit_loop', 'fx_hit_update',
  ]);
});
