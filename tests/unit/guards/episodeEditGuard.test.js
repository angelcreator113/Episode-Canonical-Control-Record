'use strict';

/**
 * Timeline C1 (design R5.6 checklist 6): the boundaries held in the code.
 * - Only the migration and the service name the nine edit tables.
 * - Nothing in C1 writes the legacy Timeline Editor's data
 *   (timeline_data, scenes.duration_seconds), the reusable
 *   scene_angles.video_duration, episodes, or the raw takes.
 * - Edit rows are only ever soft-deleted; versions are never updated.
 * - Prime's commentary has no offset of its own (one clock).
 * - editTimeline is pure: no database, no clock, no randomness.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...files(p)); } else if (/\.(c|m)?jsx?$/.test(e.name) && !/\.bak\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

const TABLES = /\b(episode_edit_state|episode_beat_production|episode_scene_clips|episode_prime_segments|episode_pip_settings|episode_pip_visibility|timeline_items|timeline_audio_items|edit_versions)\b/;
const SERVICE = 'src/services/episodeEditService.js';
const MIGRATION = 'src/migrations/20261028100000-create-episode-edit-tables.js';
const C1_CODE = [SERVICE, 'src/utils/editTimeline.js', 'src/routes/episodeEditRoutes.js'];

describe('Timeline C1 boundaries', () => {
  test('only the migration and the service name the edit tables', () => {
    const naming = [...files('src'), ...files('scripts'), ...files('frontend/src')].filter((f) => TABLES.test(read(f))).sort();
    expect(naming).toEqual([MIGRATION, SERVICE].sort());
  });

  test('C1 never writes the legacy timeline, the scene sources, the episode or the takes', () => {
    for (const f of C1_CODE) {
      const code = read(f);
      expect(code).not.toMatch(/(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+"?(timeline_data|scenes|scene_angles|scene_sets|scene_set_episodes|episodes|episode_raw_clips|line_voice_\w+|voice_source_assets)"?\b/i);
      expect(code).not.toMatch(/duration_seconds\s*=(?!=)|video_duration\s*=(?!=)/);
      expect(code).not.toMatch(/\b(TimelineData|Scene|SceneAngle|Episode)\.(update|create|destroy|upsert|bulkCreate)\(/);
    }
  });

  test('edit rows are soft-deleted only; versions are never updated or deleted', () => {
    const code = read(SERVICE);
    expect(code).not.toMatch(/DELETE\s+FROM/i);
    expect(code).not.toMatch(/UPDATE\s+edit_versions/i);
    expect(code).not.toMatch(/\.destroy\(/);
  });

  test('one clock: no audio offset column; the commentary range is checked inside the video by the database', () => {
    const migration = read(MIGRATION);
    expect(migration).not.toMatch(/audio_offset_ms|audio_start_ms|audio_anchor/);
    expect(migration).toMatch(/source_in_ms <= audio_in_ms AND audio_in_ms < audio_out_ms AND audio_out_ms <= source_out_ms/);
    // No commentary is both ends NULL, with no fades: nothing to play.
    expect(migration).toMatch(/audio_in_ms IS NULL AND audio_out_ms IS NULL AND audio_fade_in_ms = 0 AND audio_fade_out_ms = 0/);
  });

  test('editTimeline is pure: no database, files, clock or randomness', () => {
    const code = read('src/utils/editTimeline.js');
    expect(code).not.toMatch(/require\(/);
    expect(code).not.toMatch(/Date\.now|new Date|Math\.random|process\.env/);
  });

  test('the legacy Timeline Editor names nothing of C1', () => {
    const legacy = [...files('src'), ...files('frontend/src')].filter((f) => /timelineData|TimelineEditor|timeline-editor/i.test(f));
    expect(legacy.length).toBeGreaterThan(0);
    for (const f of legacy) {
      expect(read(f)).not.toMatch(TABLES);
      expect(read(f)).not.toMatch(/episodeEditService|editTimeline\b/);
    }
  });
});
