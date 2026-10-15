'use strict';

/**
 * A venue's everyday look at each time of day and in each season (Evoni,
 * 2026-10-15: "Each venue needs its everyday look and then its event look
 * ... also the time of day and seasons"; her answer the same day: time of
 * day changes every view, season only exterior views;
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 2).
 *
 *   time:   a re-light of the everyday look (the location's approved base)
 *   season: a re-season of the venue's Front view (the everyday set's Front
 *           zone angle): season shows outside, so it needs that view
 *
 * Each variant is uploaded, or generated as a Flux Kontext edit of its
 * source image (generateDressedStill), so the place stays the same and only
 * the light or the season changes. The cost is shown first (S2). Rows live
 * in location_look_variants, one per everyday set, kind and value: another
 * everyday look starts with none of the old one's.
 *
 * The everyday set is the scene set the location approved
 * (world_locations.approved_base_scene_set_id); the routes take its id.
 */

const { TIME_LIGHT, SEASON_TEXT, BRIEF_RULES } = require('./sceneBriefService');

const KINDS = Object.freeze({
  time: Object.freeze(['morning', 'afternoon', 'golden_hour', 'evening', 'night']),
  season: Object.freeze(['spring', 'summer', 'fall', 'winter']),
});
const LABELS = Object.freeze({
  morning: 'Morning', afternoon: 'Afternoon', golden_hour: 'Golden hour', evening: 'Evening', night: 'Night',
  spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter',
});
const STUCK_AFTER_MS = 10 * 60 * 1000;
const STUCK_REASON = 'Timed out: no image after 10 minutes';

class LookVariantError extends Error {
  constructor(message, status = 400, code = 'LOOK_VARIANT_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readKindValue(kind, value) {
  if (!KINDS[kind]) throw new LookVariantError('kind must be time or season', 400, 'BAD_KIND');
  if (!KINDS[kind].includes(value)) throw new LookVariantError(`${kind} must be one of ${KINDS[kind].join(', ')}`, 400, 'BAD_VALUE');
}

/**
 * The edit prompt for a variant. Pure. The place and the view stay as the
 * reference shows them; only the light (time) or the season outside changes.
 */
function variantPrompt(kind, value) {
  readKindValue(kind, value);
  const keep = kind === 'time'
    ? 'The same place and the same view as the reference image, exactly: the same architecture, furniture, decor, objects and framing. Only the light and the time of day change: the sky, the daylight, the shadows and which lamps are lit.'
    : `The same place and the same view as the reference image, exactly: the same building, architecture and framing. Only the season changes outside: the trees, plants, ground, sky and weather show ${LABELS[value].toLowerCase()}.`;
  const lead = kind === 'time' ? TIME_LIGHT[value] : SEASON_TEXT[value];
  return [lead, keep, 'Photorealistic.', ...BRIEF_RULES].join(' ');
}

/** The everyday set and its location; throws unless the set is the location's approved one. */
async function loadEveryday(sequelize, setId) {
  const [[set]] = await sequelize.query(
    `SELECT s.id, s.name, s.world_location_id, l.approved_base_scene_set_id, l.approved_base_image_url
       FROM scene_sets s LEFT JOIN world_locations l ON l.id = s.world_location_id AND l.deleted_at IS NULL
      WHERE s.id = :setId AND s.deleted_at IS NULL`,
    { replacements: { setId } });
  if (!set) throw new LookVariantError('Scene set not found', 404, 'SET_NOT_FOUND');
  if (!set.world_location_id || String(set.approved_base_scene_set_id) !== String(set.id) || !set.approved_base_image_url) {
    throw new LookVariantError('Time and season variants are made from the location\'s everyday look: use this set as the everyday look first', 409, 'NOT_EVERYDAY_LOOK');
  }
  return set;
}

/** The Front view a season shows: the set's first Front zone with an image ({ id, url }), else null. */
async function frontView(sequelize, setId) {
  const [[angle]] = await sequelize.query(
    `SELECT id, still_image_url FROM scene_angles
      WHERE scene_set_id = :setId AND angle_kind = 'front' AND still_image_url IS NOT NULL AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
    { replacements: { setId } });
  return angle ? { id: angle.id, url: angle.still_image_url } : null;
}

/**
 * The source of a variant: { url, angleId }. A time re-lights the everyday
 * look; a season re-seasons the Front view, and is refused without one.
 */
async function sourceImage(sequelize, set, kind) {
  if (kind === 'time') return { url: set.approved_base_image_url, angleId: null };
  const front = await frontView(sequelize, set.id);
  if (!front) {
    throw new LookVariantError('Season variants show the outside: make this set\'s Front zone image first', 409, 'NO_FRONT_VIEW');
  }
  return { url: front.url, angleId: front.id };
}

const isStuck = (row) => row?.status === 'generating' && row.updated_at && Date.now() - new Date(row.updated_at).getTime() > STUCK_AFTER_MS;

/**
 * The venue's variants as the page shows them: every slot of both kinds,
 * each with its row or null, and whether seasons can be made yet. A run
 * left generating for 10 minutes is marked failed here.
 */
async function listVariants(sequelize, setId) {
  const set = await loadEveryday(sequelize, setId);
  const [rows] = await sequelize.query(
    `SELECT id, kind, value, status, source, image_url, error, cost_usd, generated_at, updated_at
       FROM location_look_variants WHERE scene_set_id = :setId AND deleted_at IS NULL`,
    { replacements: { setId: set.id } });
  for (const row of rows.filter(isStuck)) {
    console.warn(`[LookVariants] ${row.kind} ${row.value} for location ${set.world_location_id} stuck; marked failed`);
    await sequelize.query(
      `UPDATE location_look_variants SET status = 'failed', error = :error, updated_at = NOW() WHERE id = :id AND status = 'generating'`,
      { replacements: { id: row.id, error: STUCK_REASON } });
    row.status = 'failed';
    row.error = STUCK_REASON;
  }
  const slot = (kind) => KINDS[kind].map((value) => {
    const row = rows.find((r) => r.kind === kind && r.value === value);
    return {
      value,
      label: LABELS[value],
      variant: row ? {
        id: row.id, status: row.status, source: row.source, image_url: row.image_url, error: row.error,
        cost_usd: row.cost_usd == null ? null : Number(row.cost_usd), generated_at: row.generated_at,
      } : null,
    };
  });
  return {
    world_location_id: set.world_location_id,
    everyday_image_url: set.approved_base_image_url,
    front_view_url: (await frontView(sequelize, set.id))?.url || null,
    time: slot('time'),
    season: slot('season'),
  };
}

/** The prompt, source image and estimate of a variant (read only; S2's cost first). */
async function planVariant(sequelize, { setId, kind, value }) {
  readKindValue(kind, value);
  const set = await loadEveryday(sequelize, setId);
  const sceneGen = require('./sceneGenerationService');
  const source = await sourceImage(sequelize, set, kind);
  return {
    kind, value, label: LABELS[value],
    source_image_url: source.url,
    source_angle_id: source.angleId,
    prompt: variantPrompt(kind, value),
    estimate: { ...sceneGen.estimateDressingCost(), model: sceneGen.SCENE_DRESSING_MODEL.key },
  };
}

/**
 * Generate a variant after the cost was confirmed. Returns { result, run }:
 * result is what the route answers now; run() does the paid work after it.
 */
async function startVariant(sequelize, { setId, kind, value }) {
  if (!process.env.FAL_KEY) throw new LookVariantError('Variants use Flux Kontext, which needs FAL_KEY, which is not configured.', 503, 'PROVIDER_NOT_CONFIGURED');
  const plan = await planVariant(sequelize, { setId, kind, value });
  const set = await loadEveryday(sequelize, setId);
  // One run per slot: a slot already generating (and not stuck) is refused,
  // so a second click is never a second paid run.
  const [[row]] = await sequelize.query(
    `INSERT INTO location_look_variants (id, world_location_id, scene_set_id, kind, value, status, source, source_image_url, source_angle_id, prompt, estimate_usd, error, created_at, updated_at)
     VALUES (gen_random_uuid(), :loc, :setId, :kind, :value, 'generating', 'generated', :src, :angleId, :prompt, :estimate, NULL, NOW(), NOW())
     ON CONFLICT (scene_set_id, kind, value) WHERE deleted_at IS NULL
     DO UPDATE SET status = 'generating', source = 'generated', source_image_url = EXCLUDED.source_image_url,
                   source_angle_id = EXCLUDED.source_angle_id, prompt = EXCLUDED.prompt,
                   estimate_usd = EXCLUDED.estimate_usd, error = NULL, updated_at = NOW()
       WHERE location_look_variants.status <> 'generating'
          OR location_look_variants.updated_at < NOW() - INTERVAL '10 minutes'
     RETURNING id`,
    { replacements: { loc: set.world_location_id, setId: set.id, kind, value, src: plan.source_image_url, angleId: plan.source_angle_id, prompt: plan.prompt, estimate: plan.estimate?.usd ?? null } });
  if (!row) throw new LookVariantError(`${LABELS[value]} is already being generated`, 409, 'VARIANT_GENERATING');
  // The run's result lands only on its own generation: an upload, a removal
  // or a newer run made meanwhile is never overwritten.
  const ownRun = `id = :id AND status = 'generating' AND source = 'generated' AND deleted_at IS NULL`;
  const run = async () => {
    try {
      const sceneGen = require('./sceneGenerationService');
      const out = await sceneGen.generateDressedStill(set, plan.prompt, plan.source_image_url, { suffix: `variant-${kind}-${value}` });
      await sequelize.query(
        `UPDATE location_look_variants SET status = 'complete', image_url = :url, cost_usd = :cost, generated_at = NOW(), updated_at = NOW()
          WHERE ${ownRun}`,
        { replacements: { id: row.id, url: out.stillUrl, cost: out.cost } });
    } catch (err) {
      console.error(`[LookVariants] ${kind} ${value} for "${set.name}" failed:`, err.message);
      await sequelize.query(
        `UPDATE location_look_variants SET status = 'failed', error = :error, updated_at = NOW() WHERE ${ownRun}`,
        { replacements: { id: row.id, error: String(err.message || err).slice(0, 500) } });
    }
  };
  return { result: { variant_id: row.id, kind, value, status: 'generating' }, run };
}

/**
 * A variant from Evoni's own image: complete at once, source 'uploaded',
 * no cost. storeImage(set) puts the file in S3 and returns its URL (the
 * route's job, as for other uploads). A season needs no Front view here:
 * her image is the outside.
 */
async function uploadVariant(sequelize, { setId, kind, value, storeImage }) {
  readKindValue(kind, value);
  const set = await loadEveryday(sequelize, setId);
  // A season shows the Front view it stands for (the set's current one),
  // so the beat planner swaps that view only.
  const angleId = kind === 'season' ? (await frontView(sequelize, set.id))?.id || null : null;
  const url = await storeImage(set);
  const [[row]] = await sequelize.query(
    `INSERT INTO location_look_variants (id, world_location_id, scene_set_id, kind, value, status, source, image_url, source_angle_id, cost_usd, generated_at, created_at, updated_at)
     VALUES (gen_random_uuid(), :loc, :setId, :kind, :value, 'complete', 'uploaded', :url, :angleId, 0, NOW(), NOW(), NOW())
     ON CONFLICT (scene_set_id, kind, value) WHERE deleted_at IS NULL
     DO UPDATE SET status = 'complete', source = 'uploaded', image_url = EXCLUDED.image_url, source_image_url = NULL,
                   source_angle_id = EXCLUDED.source_angle_id, prompt = NULL, estimate_usd = NULL, cost_usd = 0,
                   error = NULL, generated_at = NOW(), updated_at = NOW()
     RETURNING id, kind, value, status, source, image_url`,
    { replacements: { loc: set.world_location_id, setId: set.id, kind, value, url, angleId } });
  return row;
}

/** Removes a variant (soft delete); the slot is empty again. */
async function removeVariant(sequelize, { setId, kind, value }) {
  readKindValue(kind, value);
  const set = await loadEveryday(sequelize, setId);
  const [, meta] = await sequelize.query(
    `UPDATE location_look_variants SET deleted_at = NOW(), updated_at = NOW()
      WHERE scene_set_id = :setId AND kind = :kind AND value = :value AND deleted_at IS NULL`,
    { replacements: { setId: set.id, kind, value } });
  return { removed: (meta?.rowCount ?? 0) > 0 };
}

module.exports = {
  KINDS,
  LABELS,
  STUCK_AFTER_MS,
  STUCK_REASON,
  LookVariantError,
  variantPrompt,
  listVariants,
  planVariant,
  startVariant,
  uploadVariant,
  removeVariant,
};
