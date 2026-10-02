/**
 * The planner's beat-to-location mapping and its missing angles (Evoni's
 * ruling L4 and her answers Q17-Q19, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 * Each beat goes to the episode's location of its role (BEAT_LOCATIONS:
 * Q17), and to that set's angle of the kind it asks for (Q18): arrival
 * (beat 10) an entrance or exterior, the event (11-12) its main interior.
 * A beat whose angle is missing, or has no image, says so with the kind
 * (Q19: "<Kind> angle missing — Upload image / Generate angle").
 *
 * Read by createScenePlanRows (Start Episode), generateScenePlan (the AI
 * planner), GET /episode-brief/:id/plan and the Episode Locations step.
 */
const { BEAT_LOCATIONS, ANGLE_KIND_LABELS, LABEL_FOR_KIND, kindsText } = require('../constants/beatLocations');

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
  const angle = sceneSetId && spot.kinds.length ? angleForKinds(anglesBySet.get(sceneSetId), spot.kinds) : null;
  return { role: spot.role, kinds: spot.kinds, scene_set_id: sceneSetId, angle };
}

/**
 * A plan row's angle and what is missing:
 *   { role, kinds, angle: {id,label,name,kind,still_image_url}|null,
 *     missing: null | { reason: 'no_angle'|'no_image', kind, label, text, angle_id } }
 * A row with a label uses the set's angle of that label; a row without
 * one, on a beat that asks for kinds, the set's angle of those kinds.
 */
function rowAngleStatus(row, anglesBySet) {
  const spot = BEAT_LOCATIONS[row.beat_number] || { role: 'home', kinds: [] };
  const base = { role: spot.role, kinds: spot.kinds, angle: null, missing: null };
  if (!row.scene_set_id) return base;
  const angles = anglesBySet.get(row.scene_set_id) || [];
  const label = row.angle_label ? String(row.angle_label).toUpperCase() : null;
  let angle = null;
  if (label) {
    const ofLabel = angles.filter((a) => String(a.angle_label).toUpperCase() === label);
    angle = ofLabel.find(hasImage) || ofLabel[0] || null;
  } else if (spot.kinds.length) {
    angle = angleForKinds(angles, spot.kinds);
  }
  const view = angle && {
    id: angle.id, label: angle.angle_label, name: angle.angle_name, kind: angle.angle_kind || null, still_image_url: angle.still_image_url || null,
  };
  if (angle && hasImage(angle)) return { ...base, angle: view };
  const kind = angle?.angle_kind || (label ? null : spot.kinds[0] || null);
  const what = angle ? (angle.angle_name || angle.angle_label)
    : label ? label.charAt(0) + label.slice(1).toLowerCase()
      : kindsText(spot.kinds);
  if (!angle && !label && !spot.kinds.length) return base; // the set's base image serves
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
      text: angle ? `${what} angle has no image` : `${what} angle missing`,
    },
  };
}

/** The plan rows with their angle status (GET /episode-brief/:id/plan). */
async function planWithAngles(sequelize, rows) {
  const anglesBySet = await loadSetAngles(sequelize, rows.map((r) => r.scene_set_id));
  return rows.map((r) => ({ ...r, location: rowAngleStatus(r, anglesBySet) }));
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
 * { ready, total, not_ready: [{ beat_number, beat_name, text }] }
 */
function planReadiness(rows) {
  const notReady = [];
  for (const r of rows || []) {
    let text = null;
    if (!r.scene_set_id) text = 'No location';
    else if (r.location?.missing) text = r.location.missing.text;
    else if (!r.location?.angle && !r.sceneSet?.base_still_url) text = `${r.sceneSet?.name || 'The scene set'} has no base image`;
    if (text) notReady.push({ beat_number: r.beat_number, beat_name: r.beat_name, text });
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
    if (!spot.kinds.length) continue;
    const setId = roleSets[spot.role];
    if (!setId) continue;
    const angle = angleForKinds(anglesBySet.get(setId) || [], spot.kinds);
    if (angle && hasImage(angle)) continue;
    const key = `${spot.role}:${spot.kinds.join('|')}`;
    const text = angle ? `${angle.angle_name || kindsText(spot.kinds)} angle has no image` : `${kindsText(spot.kinds)} angle missing`;
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
  planWithAngles,
  planReadiness,
  locationAngleGaps,
};
