'use strict';

/**
 * Voice Studio B1 (design R5.5 B1-12): the boundaries held in the code.
 * - Only the migration, the service, its routes and tests name the new tables.
 * - Sources and candidate revisions are never updated in place (immutable);
 *   an association only gets superseded, an approval only superseded,
 *   invalidated or revoked (history is kept).
 * - Only a current approval is playable.
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
      // Timeline C1 reads Voice Studio (only): a line anchor's target, and the approvals, revisions and
      // sources a dialogue placement plays; its guard forbids writes. Its migration names the two
      // tables a placement's foreign keys point at (associations, approvals).
      'src/services/episodeEditService.js',
      'src/migrations/20261028100000-create-episode-edit-tables.js',
    ].sort());
  });

  test('sources and candidate revisions are never updated; associations only superseded; approvals only superseded, invalidated or revoked', () => {
    const code = read(SERVICE);
    expect(code).not.toMatch(/UPDATE\s+voice_source_assets/i);
    expect(code).not.toMatch(/UPDATE\s+line_voice_candidate_revisions/i);
    expect(code).not.toMatch(/DELETE\s+FROM\s+(voice_source_assets|line_voice_)/i);
    for (const m of code.matchAll(/UPDATE\s+line_voice_associations\s+SET\s+([^`]*?)\s+WHERE/gi)) {
      expect(m[1]).toMatch(/^(superseded_at = NOW\(\), updated_at = NOW\(\)|superseded_by = :to)$/);
    }
    for (const m of code.matchAll(/UPDATE\s+line_voice_approvals\s+SET\s+([^`]*?)\s+WHERE/gi)) {
      expect(m[1]).toMatch(/^(superseded_at = NOW\(\), updated_at = NOW\(\)|superseded_at = NOW\(\), superseded_by = :byId, updated_at = NOW\(\)|invalidated_at = NOW\(\), invalidated_reason = :reason, updated_at = NOW\(\)|revoked_at = NOW\(\), revoked_by = :userId, updated_at = NOW\(\))$/);
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
    // The save number is read as text and compared as text (a BIGINT).
    expect(code).toMatch(/script_seq::text AS script_seq/);
    expect(code).not.toMatch(/(Number|parseInt|parseFloat)\([^)]*seq/i);
  });

  test('the A1c script save and the legacy voice clips name no Voice Studio table', () => {
    for (const f of ['src/services/scriptSave.js', 'src/services/scriptVersions.js', 'src/services/scriptVoiceClipsService.js', 'src/routes/scriptVoiceClipRoutes.js']) {
      expect(TABLES.test(read(f))).toBe(false);
    }
    // Neither the save nor the version history reaches Voice Studio: no version row is kept for an
    // approval (Evoni, 2026-10-28), so pruning never asks it.
    expect(read('src/services/scriptSave.js')).not.toMatch(/voiceStudio|voice_studio|line_voice/i);
    expect(read('src/services/scriptVersions.js')).not.toMatch(/voiceStudio|voice_studio|line_voice/i);
    // And Voice Studio holds no reference to a version row.
    const code = read(SERVICE);
    expect(code).not.toMatch(/script_version_id|episode_script_versions|EpisodeScriptVersion|scriptVersions/);
  });

  test('only a current approval is playable', () => {
    const { STATES, isPlayable } = require('../../../src/services/voiceStudioService');
    expect(STATES.filter(isPlayable)).toEqual(['current']);
  });

  test('B2: the page judges nothing and writes nothing by itself', () => {
    const page = ['frontend/src/pages/VoiceStudio.jsx', 'frontend/src/lib/voiceStudioView.js', 'frontend/src/lib/voiceStudioApi.js',
      ...fs.readdirSync(path.join(ROOT, 'frontend/src/components/VoiceStudio')).map((f) => `frontend/src/components/VoiceStudio/${f}`)];
    for (const f of page) {
      const code = read(f);
      // No copy of the line rule: the server's voiceLineContext is the only judge of a line or an approval.
      expect(code).not.toMatch(/voiceLineContext|teleprompterLines|lineContexts|rowHashOf|contextHash\(|sha256|crypto\.subtle/);
    }
    // Every write is a person's press: none is made while loading (no write inside an effect).
    const effects = page.map(read).join('\n').match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\)/g) || [];
    for (const e of effects) expect(e).not.toMatch(/voiceStudioApi\.(approve|reconfirm|resolve|revoke|tie|revise|removeTake|uploadSource|createTake)/);
    // The approval states are the server's names; only `current` is described as playing.
    expect(read('frontend/src/lib/voiceStudioView.js')).toMatch(/current: \{ label: 'Approved', tone: 'ok', help: 'This take plays for the line\.' \}/);
  });
  test('B2b: with Voice Studio on, the Teleprompter plays only the playable list, found by beat and index', () => {
    const lib = read('frontend/src/lib/teleprompterVoiceStudio.js');
    // No words, no old clips: the line is its beat and index (lineKey), as the server placed the approval.
    expect(lib).not.toMatch(/clipForLine|clipsByLine|voiceClipsApi\.|line_text|\.text\b|isStale/);
    expect(lib).toMatch(/lineKey\(t\.beat_number, t\.line_index\)/);
    const reader = read('frontend/src/components/Teleprompter/TeleprompterReader.jsx');
    const clipOf = reader.match(/const clipOf = \(i\) => \{[\s\S]*?\n  \};/)[0];
    // Unknown or still checking: nothing; on: the studio list and a return before the old clips are looked at.
    expect(clipOf).toMatch(/studioMode == null \|\| studioMode === 'unknown'\) return null/);
    expect(clipOf.indexOf('if (studio) return studioLines.byLine.get(lineKey(w.beat, w.index)) || null;')).toBeGreaterThan(-1);
    expect(clipOf.indexOf('if (studio) return')).toBeLessThan(clipOf.indexOf('clipForLine('));
    // The server's list is the only one read in Voice Studio mode.
    expect(read('frontend/src/lib/voiceStudioApi.js')).toMatch(/playable: \(episodeId\) => api\.get\(`\$\{base\(episodeId\)\}\/playable`\)/);
  });
  test('B2b: recording from the teleprompter makes unapproved takes only; never an old clip; links to Voice Studio', () => {
    const panel = read('frontend/src/components/Teleprompter/StudioRecord.jsx');
    const save = read('frontend/src/hooks/useTakeSave.js');
    for (const code of [panel, save]) {
      expect(code).not.toMatch(/voiceStudioApi\.(approve|reconfirm|resolve|revoke|removeTake)|voiceClipsApi/);
    }
    expect(save).toMatch(/voiceStudioApi\.uploadSource[\s\S]*voiceStudioApi\.createTake[\s\S]*voiceStudioApi\.tie/);
    expect(panel).toMatch(/\/voice\?beat=/);
    // The reader only shows the old recorder and old clips while Voice Studio is off.
    const reader = read('frontend/src/components/Teleprompter/TeleprompterReader.jsx');
    expect(reader).toMatch(/const legacyVoice = !!voiceEpisode && studioMode === 'off';/);
    expect(reader).toMatch(/\{voiceLine && !take && !studio && \(/);
    expect(read('frontend/src/components/Episodes/EpisodeScriptTab.jsx')).toMatch(/mode === 'off' && live \? voiceClipsApi\.list\(episodeId\)/);
  });
});
