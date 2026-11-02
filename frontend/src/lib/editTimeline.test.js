/**
 * The editor's copy of the episode edit's clock (design R8.11.1; Timeline
 * Editor redesign P1, 2026-11-02): frontend/src/lib/editTimeline.js is
 * src/utils/editTimeline.js byte for byte, apart from the two module lines
 * ('use strict' at the top; `module.exports = {` becomes `export {`). The
 * preview, the timeline and the server therefore read the same beats, spans
 * and findings from the same rows. To update the copy after a server change:
 *
 *   node scripts/sync-edit-timeline.js
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as client from './editTimeline';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/editTimeline.js');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const serverAsModule = (text) => {
  const head = "'use strict';\n\n";
  if (!text.startsWith(head)) throw new Error("src/utils/editTimeline.js no longer starts with 'use strict'");
  return text.slice(head.length).replace(/^module\.exports = \{/m, 'export {');
};

// A small edit with every kind of row the editor draws.
const EDIT = {
  fps: 30,
  beatModes: { 2: 'gameplay_only' },
  beatDurations: { 1: 8000 },
  sceneClips: [
    { id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: 0, source_out_ms: 6000, source_duration_ms: null, duration_ms: 6000 },
    { id: 'c2', beat_number: 2, position: 0, source_kind: 'angle_video', source_id: 'a2', source_in_ms: 0, source_out_ms: 5000, source_duration_ms: 5000, duration_ms: 5000 },
  ],
  segments: [{ id: 's1', raw_clip_id: 'r1', source_in_ms: 1000, source_out_ms: 9000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0, layout: null,
    audio_in_ms: 1000, audio_out_ms: 9000, audio_gain_db: 0, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0, status: 'draft' }],
  pip: null,
  visibility: [],
  items: [],
  audioItems: [{ id: 'm1', track: 'music', asset_ref: 'bed', slot: null, source_in_ms: 0, source_out_ms: 4000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 500, gain_db: -6, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null }],
  lineTimes: {},
  voiceTakes: {},
};

describe('the editor reads the edit as the server does', () => {
  test('the copy is the server module byte for byte', () => {
    const serverText = readFileSync(here('../../../src/utils/editTimeline.js'), 'utf8');
    const clientText = readFileSync(here('./editTimeline.js'), 'utf8');
    expect(clientText).toBe(serverAsModule(serverText));
  });

  test('both export the same names and give the same answers', () => {
    expect(Object.keys(client).sort()).toEqual(Object.keys(server).sort());
    expect(client.beatTimeline(EDIT)).toEqual(server.beatTimeline(EDIT));
    expect(client.editFindings(EDIT)).toEqual(server.editFindings(EDIT));
    expect(client.mixPlan(EDIT)).toEqual(server.mixPlan(EDIT));
    for (const t of [0, 2500, 7999, 8000, 12000]) expect(client.layoutAt(EDIT, t)).toEqual(server.layoutAt(EDIT, t));
  });
});
