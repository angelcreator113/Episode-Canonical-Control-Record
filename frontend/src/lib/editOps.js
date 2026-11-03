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
 *
 * P4: an undo that takes several steps is one request to POST /ops (one
 * transaction, one revision), so it is applied entirely or not at all.
 */

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k]]));
const ANCHOR = ['anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms'];
const anchorOfRow = (row) => pick(row, ANCHOR);
const barrier = (label, why) => () => ({ barrier: true, label, why });

/**
 * A request with every row id it names (path segments, batch step ids, an
 * item anchor) resolved to the row that stands for it now. A put back or a
 * redone place makes a new row; the commands further down the undo and redo
 * stacks still name the old one (useEditOps keeps the map).
 */
export function resolveRequest(req, resolve) {
  const path = req.path.split('/').map((part) => (part ? resolve(part) : part)).join('/');
  let body = req.body;
  if (body && Array.isArray(body.steps)) {
    body = { ...body, steps: body.steps.map((st) => ({ ...st, ...(st.id ? { id: resolve(st.id) } : {}), ...(st.body?.anchor_ref ? { body: { ...st.body, anchor_ref: resolve(st.body.anchor_ref) } } : {}) })) };
  } else if (body && body.anchor_ref) {
    body = { ...body, anchor_ref: resolve(body.anchor_ref) };
  }
  return { ...req, path, ...(req.body === undefined ? {} : { body }) };
}

/** A place that puts back (or redoes) `replaces`: the new row stands for it from then on. */
const standsFor = (cmd, replaces, key) => (replaces ? { ...cmd, replaces, newId: ([r]) => r?.[key] } : cmd);

/** Several steps as one request: POST /ops { steps: [{ op, id?, body? }] } (P4). */
export const batchRequest = (steps) => ({ method: 'post', path: '/ops', body: { steps } });

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

/** body: { beat_number, source_kind, source_id, duration_ms?, source_in_ms?, source_out_ms?, position? | index? } */
export function placeSceneClip(body, label = 'Place scene clip', { replaces = null } = {}) {
  return standsFor({
    label,
    requests: [{ method: 'post', path: '/scene-clips', body }],
    undo: ([r]) => removeSceneClip({ ...body, id: r.scene_clip_id }, `Undo: ${label.toLowerCase()}`),
  }, replaces, 'scene_clip_id');
}

/**
 * Deletes a scene clip; undo puts it back at its place among the beat's clips
 * by index (the server inserts it there and renumbers), so a reorder or split
 * since the delete never leaves its old position "taken".
 */
export function removeSceneClip(clip, label = 'Delete scene clip') {
  const index = clip.index ?? clip.position;
  const back = {
    beat_number: clip.beat_number, source_kind: clip.source_kind, source_id: clip.source_id, duration_ms: clip.duration_ms,
    ...(clip.source_kind === 'angle_still' ? {} : { source_in_ms: clip.source_in_ms, source_out_ms: clip.source_out_ms }),
    ...(index != null ? { index } : {}),
  };
  return {
    label,
    requests: [{ method: 'delete', path: `/scene-clips/${clip.id}` }],
    undo: () => placeSceneClip(back, 'Put back scene clip', { replaces: clip.id }),
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

/**
 * Splits a scene clip `atMs` into its own length (P4): two clips whose
 * lengths add up to the old one. Undone in one batch: the new part removed
 * and the first part given back its length and trim.
 */
export function splitSceneClip(clip, atMs) {
  const back = { duration_ms: clip.duration_ms, ...(clip.source_kind === 'angle_still' ? {} : { source_in_ms: clip.source_in_ms, source_out_ms: clip.source_out_ms }) };
  return {
    label: 'Split scene clip',
    requests: [{ method: 'post', path: `/scene-clips/${clip.id}/split`, body: { at_ms: atMs } }],
    undo: ([r]) => ({
      label: 'Undo: split scene clip',
      requests: [batchRequest([
        { op: 'remove', id: r.new_scene_clip_id, body: { what: 'scene_clip' } },
        { op: 'scene-clip.update', id: clip.id, body: back },
      ])],
      undo: () => splitSceneClip(clip, atMs),
    }),
  };
}

/** Moves a scene clip to `index` among its beat's clips (P4); undone by moving it back to `fromIndex`. */
export function reorderSceneClip(clip, index, fromIndex, label = 'Move scene clip in its beat') {
  return {
    label,
    requests: [{ method: 'post', path: `/scene-clips/${clip.id}/reorder`, body: { index } }],
    undo: () => reorderSceneClip(clip, fromIndex, index, `Undo: ${label.toLowerCase()}`),
  };
}

// ── Prime segments ──────────────────────────────────────────────────────

const SEGMENT_PLACE = ['raw_clip_id', 'source_in_ms', 'source_out_ms', ...ANCHOR, 'layout', 'audio_in_ms', 'audio_out_ms',
  'audio_gain_db', 'audio_muted', 'audio_fade_in_ms', 'audio_fade_out_ms'];

/** body: { raw_clip_id, anchor_kind, anchor_beat?, offset_ms, source_in_ms?, source_out_ms?, layout?, ... } */
export function placeSegment(body, label = 'Place Prime segment', { replaces = null } = {}) {
  return standsFor({
    label,
    requests: [{ method: 'post', path: '/segments', body }],
    undo: ([r]) => removeSegment({ ...body, id: r.segment_id }, `Undo: ${label.toLowerCase()}`),
  }, replaces, 'segment_id');
}

/**
 * The body that places a segment as `seg` stores it. A stretch with no
 * commentary (audio range null, e.g. a split's outer half) says so with
 * no_commentary: without it the server gives the whole video range her voice.
 * Her gain and mute go with it.
 */
export function segmentPlaceBody(seg) {
  const body = Object.fromEntries(Object.entries(pick(seg, SEGMENT_PLACE)).filter(([, v]) => v !== undefined));
  if (seg.no_commentary || seg.audio_in_ms == null || seg.audio_out_ms == null) {
    delete body.audio_in_ms;
    delete body.audio_out_ms;
    delete body.audio_fade_in_ms;
    delete body.audio_fade_out_ms;
    body.no_commentary = true;
  }
  if (body.anchor_ref == null) delete body.anchor_ref;
  if (body.anchor_beat == null) delete body.anchor_beat;
  return body;
}

export function removeSegment(seg, label = 'Delete Prime segment') {
  const back = segmentPlaceBody(seg);
  return {
    label,
    requests: [{ method: 'delete', path: `/segments/${seg.id}` }],
    undo: () => placeSegment(back, 'Put back Prime segment', { replaces: seg.id }),
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
      const steps = [{ op: 'segment.trim-video', id: seg.id, body: { source_in_ms: seg.source_in_ms, source_out_ms: seg.source_out_ms } }];
      if (seg.audio_in_ms != null && seg.audio_out_ms != null) {
        steps.push({ op: 'segment.trim-audio', id: seg.id, body: { audio_in_ms: seg.audio_in_ms, audio_out_ms: seg.audio_out_ms } });
        steps.push({ op: 'segment.audio', id: seg.id, body: { audio_fade_in_ms: seg.audio_fade_in_ms ?? 0, audio_fade_out_ms: seg.audio_fade_out_ms ?? 0 } });
      }
      return { label: `Undo: ${label.toLowerCase()}`, requests: [batchRequest(steps)], undo: () => trimSegment(seg, { source_in_ms, source_out_ms }, label) };
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
export function placeDialogue(body, label = 'Place dialogue', { replaces = null } = {}) {
  return standsFor({
    label,
    requests: [{ method: 'post', path: '/dialogue', body }],
    undo: ([r]) => removeDialogue({ id: r.item_id, voice_approval_id: body.approval_id, voice_association_id: body.association_id, ...pick(body, ANCHOR) }, `Undo: ${label.toLowerCase()}`),
  }, replaces, 'item_id');
}

export function removeDialogue(item, label = 'Delete dialogue') {
  const back = { approval_id: item.voice_approval_id, association_id: item.voice_association_id, ...anchorOfRow(item) };
  return {
    label,
    requests: [{ method: 'delete', path: `/dialogue/${item.id}` }],
    undo: () => placeDialogue(back, 'Put back dialogue', { replaces: item.id }),
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

export function addAudioItem(body, label = 'Place sound', { replaces = null } = {}) {
  return standsFor({
    label,
    requests: [{ method: 'post', path: '/audio-items', body }],
    undo: ([r]) => removeAudioItem({ ...body, id: r.audio_item_id }, `Undo: ${label.toLowerCase()}`),
  }, replaces, 'audio_item_id');
}

export function removeAudioItem(item, label = 'Delete sound') {
  const back = Object.fromEntries(Object.entries(pick(item, AUDIO_PLACE)).filter(([, v]) => v !== undefined && v !== null));
  return {
    label,
    requests: [{ method: 'delete', path: `/audio-items/${item.id}` }],
    undo: () => addAudioItem(back, 'Put back sound', { replaces: item.id }),
  };
}

/**
 * Changes a music or SFX item in place (P4): any of its anchor (a move),
 * source in and out (a trim), gain, fades and ducking. Undone with the
 * stored values of exactly the fields it changed.
 */
export function updateAudioItem(item, changes, label = 'Change sound') {
  const keys = Object.keys(changes);
  const before = pick(item, keys.some((k) => ANCHOR.includes(k)) ? [...new Set([...keys, ...ANCHOR])] : keys);
  if (before.anchor_ref === undefined) delete before.anchor_ref;
  return {
    label,
    requests: [{ method: 'patch', path: `/audio-items/${item.id}`, body: changes }],
    undo: () => updateAudioItem({ ...item, ...changes }, before, `Undo: ${label.toLowerCase()}`),
  };
}

// ── C1b items: Lala and guest clips, captions and titles, mode changes (Gate 2a) ──

const ITEM_NAMES = { performer_clip: 'performer clip', caption: 'caption', visual_mode: 'mode change' };
const itemName = (kind) => ITEM_NAMES[kind] || 'item';

/**
 * body: { kind, anchor_kind, anchor_beat?, anchor_ref?, offset_ms, values, duration_ms? }.
 * A performer clip's length is its source in to out (the server measures it);
 * a caption's is duration_ms; a mode change has none.
 */
export function addItem(body, label = `Place ${itemName(body.kind)}`, { replaces = null } = {}) {
  return standsFor({
    label,
    requests: [{ method: 'post', path: '/items', body }],
    undo: ([r]) => removeItem({ ...body, id: r.item_id, duration_ms: r.duration_ms ?? body.duration_ms ?? null }, `Undo: ${label.toLowerCase()}`),
  }, replaces, 'item_id');
}

export function removeItem(item, label = `Delete ${itemName(item.kind)}`) {
  const back = { kind: item.kind, ...anchorOfRow(item), values: item.values || {} };
  if (back.anchor_ref == null) delete back.anchor_ref;
  if (back.anchor_beat == null) delete back.anchor_beat;
  if (item.kind === 'caption' && item.duration_ms != null) back.duration_ms = item.duration_ms;
  return {
    label,
    requests: [{ method: 'delete', path: `/items/${item.id}` }],
    undo: () => addItem(back, `Put back ${itemName(item.kind)}`, { replaces: item.id }),
  };
}

/**
 * Changes a C1b item in place: any of its anchor (a move), some of its values
 * (merged by the server and checked again), and a caption's duration_ms. The
 * undo sends the stored value of exactly what changed. A performer clip's
 * length follows its source in and out, so it is never sent.
 */
export function updateItem(item, changes, label = `Change ${itemName(item.kind)}`) {
  const before = {};
  if (Object.keys(changes).some((k) => ANCHOR.includes(k))) Object.assign(before, anchorOfRow(item));
  if (changes.values) before.values = Object.fromEntries(Object.keys(changes.values).map((k) => [k, item.values?.[k] ?? null]));
  if (changes.duration_ms !== undefined) before.duration_ms = item.duration_ms;
  if (before.anchor_ref == null) delete before.anchor_ref;
  const after = { ...item, ...changes, values: { ...(item.values || {}), ...(changes.values || {}) } };
  return {
    label,
    requests: [{ method: 'patch', path: `/items/${item.id}`, body: changes }],
    undo: () => updateItem(after, before, `Undo: ${label.toLowerCase()}`),
  };
}

/** A beat's own visual mode (R8.2: gameplay or cinematic; null is "not chosen", which plays as gameplay). */
export function setBeatVisualMode(beat, mode, before) {
  return {
    label: `Beat ${beat}: ${mode ? `${mode} mode` : 'mode not chosen'}`,
    requests: [{ method: 'post', path: `/beats/${beat}/mode`, body: { visual_mode: mode } }],
    undo: () => setBeatVisualMode(beat, before ?? null, mode),
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
export function setBeatPipVisible(beat, visible, { replaces = null } = {}) {
  return standsFor({
    label: `Beat ${beat}: ${visible ? 'show' : 'hide'} Prime`,
    requests: [{ method: 'post', path: '/visibility', body: { scope: 'beat', beat_number: beat, visible } }],
    undo: ([r]) => removeVisibility({ id: r.rule_id, scope: 'beat', beat_number: beat, visible }),
  }, replaces, 'rule_id');
}

export function removeVisibility(rule) {
  return {
    label: `Beat ${rule.beat_number}: remove the Prime ${rule.visible ? 'show' : 'hide'} rule`,
    requests: [{ method: 'delete', path: `/visibility/${rule.id}` }],
    undo: () => setBeatPipVisible(rule.beat_number, rule.visible, { replaces: rule.id }),
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
