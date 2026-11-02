/**
 * The editor's changes to the episode edit as commands (Timeline Editor
 * redesign P3, 2026-11-02). Pure: each builder takes the stored row (as
 * GET /edit returns it) and the change, and gives
 *
 *   { label, requests: [{ method, path, body }], undo(results) }
 *
 * `requests` run in order through episodeEditApi.write, each with the
 * edit_revision the one before returned. `undo(results)` gives the command
 * that puts back exactly what was stored before, built from the stored values
 * (never from what is on screen), or a barrier { barrier: true, label, why }
 * for a change the edit's API cannot take back (a split supersedes its
 * segment; a restore or a timing lock rewrites many rows).
 *
 * Only the C1 routes are named. Times are whole milliseconds.
 */

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k]]));
const ANCHOR = ['anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms'];
const anchorOfRow = (row) => pick(row, ANCHOR);
const barrier = (label, why) => () => ({ barrier: true, label, why });

/** A write's failure as the producer reads it. */
export function writeFailure(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code || null;
  if (code === 'EDIT_CHANGED' || code === 'EDIT_REVISION_REQUIRED') {
    return { code, stale: true, message: 'The edit changed in another tab or by someone else. It has been reloaded, and this change was not saved.' };
  }
  if (status === 403 || code === 'AUTH_GROUP_REQUIRED') return { code, message: 'Editing needs an admin account. Nothing was changed.' };
  if (status === 401) return { code, message: 'Your sign-in has expired. Sign in again; nothing was changed.' };
  if (code === 'EPISODE_EDIT_OFF') return { code, message: 'The episode edit is switched off on this server. Nothing was changed.' };
  if (!err?.response) return { code, message: 'The server could not be reached. Nothing was changed.' };
  return { code, message: err.response.data?.error || 'That change was refused. Nothing was changed.' };
}

// ── Scene clips ─────────────────────────────────────────────────────────

/** body: { beat_number, source_kind, source_id, duration_ms?, source_in_ms?, source_out_ms?, position? } */
export function placeSceneClip(body, label = 'Place scene clip') {
  return {
    label,
    requests: [{ method: 'post', path: '/scene-clips', body }],
    undo: ([r]) => removeSceneClip({ ...body, id: r.scene_clip_id }, `Undo: ${label.toLowerCase()}`),
  };
}

export function removeSceneClip(clip, label = 'Delete scene clip') {
  const back = {
    beat_number: clip.beat_number, source_kind: clip.source_kind, source_id: clip.source_id, duration_ms: clip.duration_ms,
    ...(clip.source_kind === 'angle_still' ? {} : { source_in_ms: clip.source_in_ms, source_out_ms: clip.source_out_ms }),
    ...(clip.position != null ? { position: clip.position } : {}),
  };
  return {
    label,
    requests: [{ method: 'delete', path: `/scene-clips/${clip.id}` }],
    undo: () => placeSceneClip(back, 'Put back scene clip'),
  };
}

/** changes: any of { duration_ms, source_in_ms, source_out_ms }. */
export function updateSceneClip(clip, changes, label = 'Trim scene clip') {
  const before = pick(clip, Object.keys(changes));
  return {
    label,
    requests: [{ method: 'patch', path: `/scene-clips/${clip.id}`, body: changes }],
    undo: () => updateSceneClip({ ...clip, ...changes }, before, `Undo: ${label.toLowerCase()}`),
  };
}

// ── Prime segments ──────────────────────────────────────────────────────

const SEGMENT_PLACE = ['raw_clip_id', 'source_in_ms', 'source_out_ms', ...ANCHOR, 'layout', 'audio_in_ms', 'audio_out_ms',
  'audio_gain_db', 'audio_muted', 'audio_fade_in_ms', 'audio_fade_out_ms'];

/** body: { raw_clip_id, anchor_kind, anchor_beat?, offset_ms, source_in_ms?, source_out_ms?, layout?, ... } */
export function placeSegment(body, label = 'Place Prime segment') {
  return {
    label,
    requests: [{ method: 'post', path: '/segments', body }],
    undo: ([r]) => removeSegment({ ...body, id: r.segment_id }, `Undo: ${label.toLowerCase()}`),
  };
}

export function removeSegment(seg, label = 'Delete Prime segment') {
  const back = Object.fromEntries(Object.entries(pick(seg, SEGMENT_PLACE)).filter(([, v]) => v !== undefined));
  return {
    label,
    requests: [{ method: 'delete', path: `/segments/${seg.id}` }],
    undo: () => placeSegment(back, 'Put back Prime segment'),
  };
}

/** Moves picture and commentary together to a new anchor. */
export function moveSegment(seg, anchor, label = 'Move Prime segment') {
  const before = anchorOfRow(seg);
  return {
    label,
    requests: [{ method: 'post', path: `/segments/${seg.id}/move`, body: anchor }],
    undo: () => moveSegment({ ...seg, ...anchor }, before, `Undo: ${label.toLowerCase()}`),
  };
}

/**
 * Trims the video. The server keeps the frames left at their edit time and
 * clamps the commentary inside the new range, so undoing puts back the video
 * range and then the commentary range, in that order.
 */
export function trimSegment(seg, { source_in_ms = seg.source_in_ms, source_out_ms = seg.source_out_ms }, label = 'Trim Prime segment') {
  const after = { ...seg, source_in_ms, source_out_ms };
  return {
    label,
    requests: [{ method: 'post', path: `/segments/${seg.id}/trim-video`, body: { source_in_ms, source_out_ms } }],
    undo: () => {
      const requests = [{ method: 'post', path: `/segments/${seg.id}/trim-video`, body: { source_in_ms: seg.source_in_ms, source_out_ms: seg.source_out_ms } }];
      if (seg.audio_in_ms != null && seg.audio_out_ms != null) {
        requests.push({ method: 'post', path: `/segments/${seg.id}/trim-audio`, body: { audio_in_ms: seg.audio_in_ms, audio_out_ms: seg.audio_out_ms } });
        requests.push({ method: 'post', path: `/segments/${seg.id}/audio`, body: { audio_fade_in_ms: seg.audio_fade_in_ms ?? 0, audio_fade_out_ms: seg.audio_fade_out_ms ?? 0 } });
      }
      return { label: `Undo: ${label.toLowerCase()}`, requests, undo: () => trimSegment(seg, { source_in_ms, source_out_ms }, label) };
    },
    after,
  };
}

/** changes: any of { audio_gain_db, audio_muted, audio_fade_in_ms, audio_fade_out_ms }. */
export function setSegmentAudio(seg, changes, label = "Change Prime's commentary") {
  const before = pick(seg, Object.keys(changes));
  return {
    label,
    requests: [{ method: 'post', path: `/segments/${seg.id}/audio`, body: changes }],
    undo: () => setSegmentAudio({ ...seg, ...changes }, before, `Undo: ${label.toLowerCase()}`),
  };
}

/** layout: { x, y, w, h } in 1920×1080 pixels, or null for the episode's default. */
export function setSegmentLayout(seg, layout, label = 'Move or resize Prime') {
  const before = seg.layout || null;
  return {
    label,
    requests: [{ method: 'post', path: `/segments/${seg.id}/layout`, body: { layout } }],
    undo: () => setSegmentLayout({ ...seg, layout }, before, `Undo: ${label.toLowerCase()}`),
  };
}

/** Splits at a source time inside the segment. The API supersedes the original, so this cannot be undone. */
export function splitSegment(seg, atSourceMs) {
  return {
    label: 'Split Prime segment',
    requests: [{ method: 'post', path: `/segments/${seg.id}/split`, body: { at_source_ms: atSourceMs } }],
    undo: barrier('Split Prime segment', "A split can't be undone here: the edit keeps the original segment superseded. Restore a saved draft to go back."),
  };
}

// ── Dialogue ────────────────────────────────────────────────────────────

/** body: { approval_id, association_id, anchor_kind: 'beat_start' | 'edit_start', anchor_beat?, offset_ms } */
export function placeDialogue(body, label = 'Place dialogue') {
  return {
    label,
    requests: [{ method: 'post', path: '/dialogue', body }],
    undo: ([r]) => removeDialogue({ id: r.item_id, voice_approval_id: body.approval_id, voice_association_id: body.association_id, ...pick(body, ANCHOR) }, `Undo: ${label.toLowerCase()}`),
  };
}

export function removeDialogue(item, label = 'Delete dialogue') {
  const back = { approval_id: item.voice_approval_id, association_id: item.voice_association_id, ...anchorOfRow(item) };
  return {
    label,
    requests: [{ method: 'delete', path: `/dialogue/${item.id}` }],
    undo: () => placeDialogue(back, 'Put back dialogue'),
  };
}

export function moveDialogue(item, anchor, label = 'Move dialogue') {
  const before = anchorOfRow(item);
  return {
    label,
    requests: [{ method: 'post', path: `/dialogue/${item.id}/move`, body: anchor }],
    undo: () => moveDialogue({ ...item, ...anchor }, before, `Undo: ${label.toLowerCase()}`),
  };
}

// ── Music and SFX items (placing waits for the library; removing and copying work) ──

const AUDIO_PLACE = ['track', 'asset_ref', 'slot', 'source_in_ms', 'source_out_ms', ...ANCHOR, 'gain_db', 'fade_in_ms', 'fade_out_ms', 'duck_under_dialogue_db'];

export function addAudioItem(body, label = 'Place sound') {
  return {
    label,
    requests: [{ method: 'post', path: '/audio-items', body }],
    undo: ([r]) => removeAudioItem({ ...body, id: r.audio_item_id }, `Undo: ${label.toLowerCase()}`),
  };
}

export function removeAudioItem(item, label = 'Delete sound') {
  const back = Object.fromEntries(Object.entries(pick(item, AUDIO_PLACE)).filter(([, v]) => v !== undefined && v !== null));
  return {
    label,
    requests: [{ method: 'delete', path: `/audio-items/${item.id}` }],
    undo: () => addAudioItem(back, 'Put back sound'),
  };
}

// ── Beats and PIP visibility ────────────────────────────────────────────

export function setBeatMode(beat, primeMode, before) {
  return {
    label: `Beat ${beat}: Prime ${primeMode === 'gameplay_only' ? 'not needed' : 'required'}`,
    requests: [{ method: 'post', path: `/beats/${beat}/mode`, body: { prime_mode: primeMode } }],
    undo: () => setBeatMode(beat, before, primeMode),
  };
}

/** ms: a stored length, or null for draft timing again. before: the stored length now (null when draft). */
export function setBeatDuration(beat, ms, before) {
  return {
    label: ms == null ? `Beat ${beat}: back to draft timing` : `Beat ${beat}: length`,
    requests: [{ method: 'post', path: `/beats/${beat}/duration`, body: { duration_ms: ms } }],
    undo: () => setBeatDuration(beat, before, ms),
  };
}

export function lockTiming() {
  return {
    label: 'Lock timing for all 14 beats',
    requests: [{ method: 'post', path: '/beats/lock', body: {} }],
    undo: barrier('Lock timing', "Locking all 14 beats can't be undone in one step: set a beat back to draft timing on its card."),
  };
}

/** Hides (or shows) Prime for one beat: a visibility rule, which never mutes her commentary. */
export function setBeatPipVisible(beat, visible) {
  return {
    label: `Beat ${beat}: ${visible ? 'show' : 'hide'} Prime`,
    requests: [{ method: 'post', path: '/visibility', body: { scope: 'beat', beat_number: beat, visible } }],
    undo: ([r]) => removeVisibility({ id: r.rule_id, scope: 'beat', beat_number: beat, visible }),
  };
}

export function removeVisibility(rule) {
  return {
    label: `Beat ${rule.beat_number}: remove the Prime ${rule.visible ? 'show' : 'hide'} rule`,
    requests: [{ method: 'delete', path: `/visibility/${rule.id}` }],
    undo: () => setBeatPipVisible(rule.beat_number, rule.visible),
  };
}

export function restoreVersion(version) {
  return {
    label: `Restore draft “${version.name}”`,
    requests: [{ method: 'post', path: `/versions/${version.id}/restore`, body: {} }],
    undo: barrier('Restore draft', "A restore can't be undone here. Save a draft before restoring if you may want to come back."),
  };
}

// ── Anchors from a drag ─────────────────────────────────────────────────

/**
 * The anchor that puts something at edit time t, keeping the kind it had:
 * beat_start stays relative to its beat, edit_start stays absolute; anything
 * else (a line or item anchor) becomes absolute, since its own time is not
 * the producer's to move.
 */
export function anchorAt(row, t, beats) {
  const at = Math.round(t);
  if (row.anchor_kind === 'beat_start') {
    const b = beats.find((x) => x.beat === row.anchor_beat);
    if (b) return { anchor_kind: 'beat_start', anchor_beat: row.anchor_beat, offset_ms: at - b.start };
  }
  return { anchor_kind: 'edit_start', offset_ms: at };
}

/** The beat a drop at t lands in: the beat at t, else the first beat after the last one that has a length. */
export function beatForDrop(beats, t, duration) {
  const inside = beats.find((b) => t >= b.start && t < b.end);
  if (inside) return inside.beat;
  if (t >= duration) {
    const lastWithLength = [...beats].reverse().find((b) => b.end > b.start);
    if (!lastWithLength) return 1;
    return Math.min(14, lastWithLength.beat + 1);
  }
  return beats.find((b) => b.start >= t)?.beat || 1;
}
