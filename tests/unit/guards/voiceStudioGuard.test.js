'use strict';

/**
 * Voice Studio B1 (design R5.5 B1-12): the boundaries held in the code.
 * - Only the migration, the service, its routes and tests name the new tables.
 * - Sources and candidate revisions are never updated in place (immutable);
 *   an association only gets superseded, an approval only superseded or
 *   invalidated.
 * - The service never writes the script or the legacy voice clips, and the
 *   A1c script save names no Voice Studio table.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...files(p));
    else if (/\.js$/.test(e.name) && !/\.bak\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

const TABLES = /\b(voice_source_assets|line_voice_candidates|line_voice_associations|line_voice_candidate_revisions|line_voice_approvals|line_voice_reconfirmations)\b/;
const SERVICE = 'src/services/voiceStudioService.js';

describe('Voice Studio boundaries', () => {
  test('only the migration, the service and its routes name the Voice Studio tables', () => {
    const naming = [...files('src'), ...files('scripts')].filter((f) => TABLES.test(read(f))).sort();
    expect(naming).toEqual([
      'src/migrations/20261027200000-create-voice-studio-tables.js',
      SERVICE,
    ].sort());
  });

  test('sources and candidate revisions are never updated; associations and approvals only superseded or invalidated', () => {
    const code = read(SERVICE);
    expect(code).not.toMatch(/UPDATE\s+voice_source_assets/i);
    expect(code).not.toMatch(/UPDATE\s+line_voice_candidate_revisions/i);
    expect(code).not.toMatch(/DELETE\s+FROM\s+(voice_source_assets|line_voice_)/i);
    for (const m of code.matchAll(/UPDATE\s+line_voice_associations\s+SET\s+([^`]*?)\s+WHERE/gi)) {
      expect(m[1]).toMatch(/^(superseded_at = NOW\(\), updated_at = NOW\(\)|superseded_by = :to)$/);
    }
    for (const m of code.matchAll(/UPDATE\s+line_voice_approvals\s+SET\s+([^`]*?)\s+WHERE/gi)) {
      expect(m[1]).toMatch(/^(superseded_at = NOW\(\), updated_at = NOW\(\)|superseded_by = :to|invalidated_at = NOW\(\), invalidated_reason = :reason, updated_at = NOW\(\))$/);
    }
    // A take is removed by a soft delete only.
    expect(code).toMatch(/UPDATE line_voice_candidates SET deleted_at = NOW\(\), updated_at = NOW\(\) WHERE id = :candidateId/);
  });

  test('the service never writes the script or the legacy voice clips', () => {
    const code = read(SERVICE);
    expect(code).not.toMatch(/(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+episodes\b/i);
    expect(code).not.toMatch(/script_content\s*=(?!=)/);
    expect(code).not.toMatch(/(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+script_voice_clips/i);
    expect(code).not.toMatch(/saveEpisodeScript|snapshotScript|episode_script_versions|EpisodeScriptVersion/);
  });

  test('the A1c script save and the legacy voice clips name no Voice Studio table', () => {
    for (const f of ['src/services/scriptSave.js', 'src/services/scriptVersions.js', 'src/services/scriptVoiceClipsService.js', 'src/routes/scriptVoiceClipRoutes.js']) {
      expect(TABLES.test(read(f))).toBe(false);
    }
  });
});
