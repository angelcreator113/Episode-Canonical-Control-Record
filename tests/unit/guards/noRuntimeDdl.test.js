'use strict';

/**
 * The application never creates or changes schema at runtime (Evoni,
 * 2026-11-04; docs/reads/2026-11-04-runtime-ddl-inventory.md). Tables come
 * from reviewed migrations under src/migrations/, which the Deploy workflow
 * runs as the migration role. That lets the application role lose CREATE on
 * public, which the Deploy workflow's migration trust check requires
 * (scripts/deploy/migration-trust-check.js).
 *
 * Reads the source as text; comments are ignored.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

function files(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'migrations', 'seeders', '_unused_models'].includes(entry.name)) continue;
      out.push(...files(rel));
    } else if (/\.(c|m)?js$/.test(entry.name)) out.push(rel);
  }
  return out;
}
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const DDL = [
  /\.sync\s*\(/,
  /\bCREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TYPE|SEQUENCE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|EXTENSION|FUNCTION|OR\s+REPLACE|TRIGGER)\b/i,
  /\bALTER\s+(?:TABLE|INDEX|TYPE|SCHEMA|SEQUENCE)\b/i,
  /\bDROP\s+(?:TABLE|INDEX|TYPE|SCHEMA|SEQUENCE|CONSTRAINT|VIEW)\b/i,
  /\.(?:createTable|addColumn|addIndex|changeColumn|removeColumn|dropTable|renameColumn|addConstraint|removeConstraint)\s*\(/,
];

// What is left, each with its reason and how many DDL lines it may hold.
// None of these needs CREATE on public.
const ALLOWED = {
  'src/app.js': [1, 'sequelize.sync() only with ENABLE_DB_SYNC=true, a danger switch never set in production (F-App-1 plan §9.3)'],
  'src/models/index.js': [1, 'the sync() helper; nothing calls it'],
  'src/server.js': [5, 'one-time repair of the legacy shows unique constraints, only while shows_name_key/shows_slug_key exist; needs table ownership, not CREATE on public (inventory §3, separate decision)'],
  'src/controllers/sceneController.js': [2, 'drops and re-creates idx_scenes_episode_scene_number around scene renumbering; needs table ownership, not CREATE on public (inventory §3, separate fix)'],
};

describe('no runtime DDL in the application', () => {
  const found = {};
  for (const f of [...files('src')]) {
    const lines = code(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n');
    const hits = lines.filter((l) => DDL.some((re) => re.test(l)));
    if (hits.length) found[f] = hits.map((l) => l.trim());
  }

  test('no file outside the listed exceptions creates or changes schema', () => {
    const offenders = Object.keys(found).filter((f) => !ALLOWED[f]);
    expect(offenders.map((f) => `${f}: ${found[f].join(' | ')}`)).toEqual([]);
  });

  test('the listed exceptions hold no more DDL than recorded', () => {
    for (const [f, [max]] of Object.entries(ALLOWED)) expect([f, (found[f] || []).length <= max]).toEqual([f, true]);
  });

  test('the nine former table-creation sites are gone, and their tables come from migrations', () => {
    const src = (f) => code(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    expect(src('src/routes/sceneSetRoutes.js')).not.toMatch(/ensureGenerationJobsTable|GenerationJob\.sync/);
    expect(src('src/workers/sceneGenerationWorker.js')).not.toMatch(/\.sync\(/);
    expect(src('src/routes/continuityEngine.js')).not.toMatch(/ensureTables|\.sync\(/);
    expect(src('src/routes/franchiseBrainRoutes.js')).not.toMatch(/\.sync\(/);
    expect(src('src/routes/storyHealth.js')).not.toMatch(/CREATE TABLE/);
    expect(src('src/routes/worldStudio.js')).not.toMatch(/ensurePreviewsTable|CREATE TABLE/);
    expect(src('src/routes/admin.js')).not.toMatch(/create-video-compositions-table|CREATE TABLE/);
    expect(src('src/controllers/videoCompositionController.js')).not.toMatch(/CREATE (TABLE|INDEX)/);

    const migration = require(path.join(ROOT, 'src/migrations/20261104200000-create-runtime-created-tables.js'));
    expect(migration.TABLES.map(([t]) => t).sort()).toEqual([
      'brain_documents', 'chapter_versions', 'continuity_beat_characters', 'continuity_beats', 'continuity_characters',
      'continuity_timelines', 'ecosystem_previews', 'video_compositions',
    ]);
    const all = fs.readdirSync(path.join(ROOT, 'src/migrations')).map((f) => fs.readFileSync(path.join(ROOT, 'src/migrations', f), 'utf8')).join('\n');
    expect(all).toMatch(/createTable\(\s*['"]generation_jobs['"]/);
    expect(all).toMatch(/createTable\(\s*['"]franchise_knowledge['"]/);
  });

  test('the guard sees each form it looks for', () => {
    const samples = [
      'await GenerationJob.sync();', "await sequelize.query('CREATE TABLE IF NOT EXISTS x (id int)')",
      'CREATE UNIQUE INDEX i ON t (a)', 'ALTER TABLE shows DROP CONSTRAINT x', 'DROP INDEX IF EXISTS i',
      "await queryInterface.addColumn('t', 'c', {})",
    ];
    for (const s of samples) expect([s, DDL.some((re) => re.test(s))]).toEqual([s, true]);
    expect(DDL.some((re) => re.test("SELECT to_regclass('public.x')"))).toBe(false);
  });
});
