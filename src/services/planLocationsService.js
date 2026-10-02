/**
 * The planner's beat-to-location mapping and its missing angles (Evoni's
 * ruling L4 and her answers Q17-Q19, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 * Each beat goes to the episode's location of its role (BEAT_LOCATIONS:
 * Q17), and to that set's zone it asks for (L14): arrival (beat 10) its
 * Front, the event (11-12) its Inside, which is the set's base unless an
 * Inside angle has an image (answer 1), so Inside is never missing. A beat
 * whose zone is missing, or has no image, says so (Q19, in L14's words:
 * "Front zone missing — Upload image / Generate angle").
 *
 * Read by createScenePlanRows (Start Episode), generateScenePlan (the AI
 * planner), GET /episode-brief/:id/plan and the Episode Locations step.
 */
const {
  BEAT_LOCATIONS, ANGLE_KIND_LABELS, LABEL_FOR_KIND, BASE_KINDS, kindsText, kindNoun,
} = require('../constants/beatLocations');

const hasImage = (a) => Boolean(a?.still_image_url) && (!a.generation_status || a.generation_status === 'complete');

/** The sets' live angles, by set id, in order. */
async function loadSetAngles(sequelize, setIds, transaction) {
  const ids = [...new Set((setIds || []).filter(Boolean))];
  const bySet = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return bySet;
  const [rows] = await sequelize.query(
    `SELECT id, scene_set_id, angle_label, angle_name, angle_kind, still_image_url, generation_status, sort_order
       FROM scene_angles WHERE scene_set_id IN (:ids) AND deleted_at IS NULL
      ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
    { replacements: { ids }, transaction });
  for (const r of rows) bySet.get(r.scene_set_id)?.push(r);
  return bySet;
}

/** The set's angle of the first kind it has, an imaged one first; else null. */
function angleForKinds(angles, kinds) {
  for (const kind of kinds || []) {
    const ofKind = (angles || []).filter((a) => a.angle_kind === kind);
    const pick = ofKind.find(hasImage) || ofKind[0];
    if (pick) return pick;
  }
  return null;
}

/** Kinds the set's base image serves when no angle of them has an image (L14, answer 1). */
const baseServes = (kinds) => (kinds || []).length > 0 && kinds.every((k) => BASE_KINDS.includes(k));

/** The location's set for each role: { home, closet, event }; extras are not mapped. */
function setsByRole(locations) {
  const out = {};
  for (const l of locations || []) {
    if (l.role !== 'extra' && l.scene_set_id && !out[l.role]) out[l.role] = l.scene_set_id;
  }
  return out;
}

/**
 * Where a beat goes: { role, kinds, scene_set_id, angle } from the
 * locations. The closet beat falls back to home when there is no closet.
 */
function placeBeat(beatNumber, roleSets, anglesBySet) {
  const spot = BEAT_LOCATIONS[beatNumber] || { role: 'home', kinds: [] };
  const sceneSetId = roleSets[spot.role] || (spot.role === 'closet' ? roleSets.home : null) || null;
  let angle = sceneSetId && spot.kinds.length ? angleForKinds(anglesBySet.get(sceneSetId), spot.kinds) : null;
  if (angle && !hasImage(angle) && baseServes(spot.kinds)) angle = null; // the base is Inside
  return { role: spot.role, kinds: spot.kinds, scene_set_id: sceneSetId, angle };
}

/**
 * A plan row's angle and what is missing:
 *   { role, kinds, angle: {id,label,name,kind,still_image_url}|null,
 *     missing: null | { reason: 'no_angle'|'no_image', kind, label, text, angle_id } }
 * A row with a label uses the set's angle of that label; a row without
 * one, on a beat that asks for kinds, the set's angle of those kinds.
 */
function rowAngleStatus(row, anglesBySet, dressing = null) {
  const spot = BEAT_LOCATIONS[row.beat_number] || { role: 'home', kinds: [] };
  const look = (row.scene_set_id && dressing?.looks?.get(row.scene_set_id)) || null;
  const base = { role: spot.role, kinds: spot.kinds, angle: null, missing: null, ...(look ? { look: { id: look.id, image_url: look.image_url } } : {}) };
  if (!row.scene_set_id) return { role: spot.role, kinds: spot.kinds, angle: null, missing: null };
  const angles = anglesBySet.get(row.scene_set_id) || [];
  const label = row.angle_label ? String(row.angle_label).toUpperCase() : null;
  let angle = null;
  if (label) {
    const ofLabel = angles.filter((a) => String(a.angle_label).toUpperCase() === label);
    angle = ofLabel.find(hasImage) || ofLabel[0] || null;
  } else if (spot.kinds.length) {
    angle = angleForKinds(angles, spot.kinds);
    if (angle && !hasImage(angle) && baseServes(spot.kinds)) angle = null; // the base is Inside
  }
  const view = angle && {
    id: angle.id, label: angle.angle_label, name: angle.angle_name, kind: angle.angle_kind || null, still_image_url: angle.still_image_url || null,
  };
  // L10, answer 3 (§8(hh)): at the look's set, the dressed angle is shown
  // and counted when there is one, else the plain angle.
  const dressed = look && angle ? dressing.angles.get(`${look.id}:${angle.id}`) || null : null;
  if (view && dressed) {
    base.generating = dressed.status === 'generating';
    view.dressed = { id: dressed.id, status: dressed.status, image_url: dressed.image_url || null, error: dressed.error || null };
    view.plain_image_url = view.still_image_url;
    if (dressed.status === 'complete' && dressed.image_url) return { ...base, angle: { ...view, still_image_url: dressed.image_url } };
  }
  // Display bug 3 (Evoni, 2026-10-02): the page refreshes while this is true.
  base.generating = angle?.generation_status === 'generating' || dressed?.status === 'generating';
  if (angle && hasImage(angle)) return { ...base, angle: view };
  const kind = angle?.angle_kind || (label ? null : spot.kinds[0] || null);
  const what = angle ? (angle.angle_name || angle.angle_label)
    : label ? label.charAt(0) + label.slice(1).toLowerCase()
      : kindsText(spot.kinds);
  if (!angle && !label && (!spot.kinds.length || baseServes(spot.kinds))) return base; // the set's base image serves
  const noun = angle?.angle_kind ? kindNoun([angle.angle_kind]) : (label ? 'angle' : kindNoun(spot.kinds));
  return {
    ...base,
    angle: view || null,
    missing: {
      reason: angle ? 'no_image' : 'no_angle',
      kind,
      kinds: angle ? [] : (label ? [] : spot.kinds),
      label: angle ? angle.angle_label : (label || LABEL_FOR_KIND[spot.kinds[0]] || null),
      angle_id: angle?.id || null,
      // The name a new angle is created with ("Entrance"), or the angle's own.
      name: angle ? (angle.angle_name || angle.angle_label)
        : label ? what : (ANGLE_KIND_LABELS[spot.kinds[0]] || what),
      text: angle ? `${what} ${noun} has no image` : `${what} ${noun} missing`,
    },
  };
}

/**
 * The episode's looks and their dressed angles (L10), for rowAngleStatus:
 * { looks: Map<setId, look>, angles: Map<'lookId:angleId', row> }.
 */
async function loadDressing(sequelize, episodeId) {
  const { episodeLooks, lookAngles } = require('./dressedAngleService');
  const looks = await episodeLooks(sequelize, episodeId);
  const angles = await lookAngles(sequelize, [...looks.values()].map((l) => l.id));
  return { looks, angles };
}

/**
 * The beats' sets, read directly (removed ones too, flagged), by id. Display
 * bug 2 (Evoni, 2026-10-02): "'No scene assigned' shows on beats that have
 * a set" — the page named a beat's set only from the plan read's include,
 * which comes back empty for a set removed from Scene Sets.
 */
async function loadPlanSets(sequelize, setIds) {
  const ids = [...new Set((setIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const [rows] = await sequelize.query(
    `SELECT id, name, scene_type, script_context, base_still_url, generation_status, deleted_at
       FROM scene_sets WHERE id IN (:ids)`,
    { replacements: { ids } });
  return new Map(rows.map((s) => [s.id, s]));
}

/**
 * The picture a beat shows and its label (display bug 1, Evoni 2026-10-02:
 * "A beat with a set but no specific angle ... must show the set's base
 * image (per Q21), labelled e.g. "Lala's Closet · base""): its angle (the
 * dressed one at the look's set, L10), else the event's look on its set,
 * else the set's base image. { url, source, label } or null.
 */
function beatPicture(location, set) {
  if (!set) return null;
  const removed = set.deleted_at ? ' (removed from Scene Sets)' : '';
  const name = set.name || 'Scene set';
  const angle = location?.angle;
  if (angle?.still_image_url) {
    const dressed = angle.dressed?.status === 'complete';
    return {
      url: angle.still_image_url,
      source: dressed ? 'dressed' : 'angle',
      label: `${name} · ${angle.name || angle.label}${dressed ? ' (event look)' : ''}${removed}`,
    };
  }
  if (location?.look?.image_url) return { url: location.look.image_url, source: 'look', label: `${name} · event look${removed}` };
  if (set.base_still_url) return { url: set.base_still_url, source: 'base', label: `${name} · base${removed}` };
  return null;
}

/**
 * The plan rows with their angle status (GET /episode-brief/:id/plan).
 * A beat at a set the episode's event has a finished look on carries
 * location.look, and its angle its dressed version (L10). Each beat also
 * carries its set (sceneSet, read directly), the picture it shows
 * (location.image) and whether what it waits on is still generating
 * (location.generating), for the Beat Plan and the Scenes tab.
 */
async function planWithAngles(sequelize, rows) {
  const anglesBySet = await loadSetAngles(sequelize, rows.map((r) => r.scene_set_id));
  const setsById = await loadPlanSets(sequelize, rows.map((r) => r.scene_set_id));
  const episodeId = rows.find((r) => r.episode_id)?.episode_id || null;
  const dressing = episodeId ? await loadDressing(sequelize, episodeId) : null;
  return rows.map((r) => {
    const set = r.scene_set_id ? setsById.get(r.scene_set_id) || null : null;
    const location = rowAngleStatus(r, anglesBySet, dressing);
    location.generating = Boolean(location.generating) || set?.generation_status === 'generating';
    location.image = beatPicture(location, set);
    const sceneSet = set ? {
      ...(r.sceneSet || {}),
      id: set.id, name: set.name, scene_type: set.scene_type, script_context: set.script_context,
      base_still_url: set.base_still_url, removed: Boolean(set.deleted_at),
    } : null;
    return { ...r, sceneSet, location };
  });
}

/**
 * Production readiness (Evoni's ruling L5 and her answer Q21, 2026-10-02):
 * "every planned beat has an angle with an image. Flag it on the production
 * checklist and the planner header; never block." L5: "A written venue look
 * is enough to keep planning and writing; missing scene images are flagged
 * for production readiness, never blocking."
 * A beat that asks for no angle kind and names no label is shot on its
 * set's base image, so that image counts as its angle.
 * rows: the plan rows with `location` (planWithAngles) and `sceneSet`.
 * S9 (a) (Evoni, 2026-10-02; §8(hh)): "The count should reflect usable
 * assignments, including missing views and removed sets": a beat at a
 * removed set needs attention too. Each item carries its fix: the removed
 * set's "Move my beats" (removed_set), the set and zone in Scene Sets
 * (scene_set), or the episode's locations (locations).
 * { ready, total, not_ready: [{ beat_number, beat_name, text, fix }] }
 */
function planReadiness(rows) {
  const notReady = [];
  for (const r of rows || []) {
    let text = null;
    let fix = null;
    const setFix = (zone = null) => ({ kind: 'scene_set', scene_set_id: r.scene_set_id, zone });
    if (!r.scene_set_id) {
      text = 'No location';
      fix = { kind: 'locations' };
    } else if (r.sceneSet?.removed) {
      // S9 (a): a removed set is not a usable background, whatever image it had.
      text = `${r.sceneSet.name || 'The scene set'} was removed`;
      fix = { kind: 'removed_set', scene_set_id: r.scene_set_id };
    } else if (r.location?.missing) {
      text = r.location.missing.text;
      fix = setFix(r.location.missing.angle_id || r.location.missing.kind || null);
    } else if (!r.location?.angle && !r.sceneSet?.base_still_url) {
      text = `${r.sceneSet?.name || 'The scene set'} has no base image`;
      fix = setFix();
    }
    if (text) notReady.push({ beat_number: r.beat_number, beat_name: r.beat_name, text, fix });
  }
  const total = (rows || []).length;
  return { ready: total - notReady.length, total, not_ready: notReady };
}

/**
 * The angles the locations still need for the planner (Q19's summary in
 * the Episode Locations step): per role whose beats ask for kinds, each
 * beat's kinds the set has no imaged angle of.
 * [{ role, scene_set_id, kinds, angle_id, text, beats }]
 */
async function locationAngleGaps(sequelize, locations, transaction) {
  const roleSets = setsByRole(locations);
  const anglesBySet = await loadSetAngles(sequelize, Object.values(roleSets), transaction);
  const gaps = new Map();
  for (const [beat, spot] of Object.entries(BEAT_LOCATIONS)) {
    if (!spot.kinds.length || baseServes(spot.kinds)) continue;
    const setId = roleSets[spot.role];
    if (!setId) continue;
    const angle = angleForKinds(anglesBySet.get(setId) || [], spot.kinds);
    if (angle && hasImage(angle)) continue;
    const key = `${spot.role}:${spot.kinds.join('|')}`;
    const noun = kindNoun(spot.kinds);
    const text = angle ? `${angle.angle_name || kindsText(spot.kinds)} ${noun} has no image` : `${kindsText(spot.kinds)} ${noun} missing`;
    const gap = gaps.get(key) || { role: spot.role, scene_set_id: setId, kinds: [...spot.kinds], angle_id: angle?.id || null, text, beats: [] };
    gap.beats.push(Number(beat));
    gaps.set(key, gap);
  }
  return [...gaps.values()];
}

module.exports = {
  ANGLE_KIND_LABELS,
  loadSetAngles,
  angleForKinds,
  setsByRole,
  placeBeat,
  rowAngleStatus,
  loadDressing,
  planWithAngles,
  planReadiness,
  locationAngleGaps,
};
