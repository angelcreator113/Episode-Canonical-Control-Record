'use strict';

/**
 * sceneModelComparisonService — base-still model comparison (Task #2396).
 *
 * Evoni, 2026-09-30: "generate base stills only, 2 sets per model, using the
 * same two scene prompts, and put them side by side in the comparison view
 * with their logged costs. I'll choose the default from that."
 *
 * A comparison is one group of scene sets: for each model and each of the
 * two prompts, one set whose base_model is that model. The group is keyed by
 * scene_sets.base_generation.comparison_group (a UUID); each set also carries
 * comparison_prompt_index and the prompt. Only base stills are generated (no
 * angles, no Claude Vision analysis or style lock). Every image call goes
 * through imageCostService.runImageCall (budget-gated, logged to
 * ai_usage_logs); generateBaseScene stores the logged row ids and cost on the
 * set, and the comparison view reads the cost back from ai_usage_logs.
 */

const crypto = require('crypto');
const imageCost = require('./imageCostService');
const sceneGen = require('./sceneGenerationService');

const PROMPTS_PER_COMPARISON = 2;
const MAX_PROMPT_LENGTH = 4000;
const NAME_PREFIX = '[Compare';

// Parts of a comparison run the rate table does not price; shown with the
// estimate so the total is never presented as complete.
const UNPRICED_NOTES = {
  'gpt-image-1.5': 'gpt-image-1.5 prompt (text) input tokens are not in the rate table; only the per-image output price is estimated and logged.',
};

function badRequest(message, extra = {}) {
  const err = new Error(message);
  err.status = 400;
  Object.assign(err, extra);
  return err;
}

/** The model keys to compare: the request's (validated, de-duplicated) or all of them. */
function normalizeModels(models) {
  if (models === undefined || models === null) return Object.keys(sceneGen.SCENE_BASE_MODELS);
  if (!Array.isArray(models) || models.length === 0) throw badRequest('models must be a non-empty array');
  const unique = [...new Set(models)];
  const unknown = unique.filter((m) => !sceneGen.isBaseModelKey(m));
  if (unknown.length) {
    throw badRequest(`Unknown model(s): ${unknown.join(', ')}. Allowed: ${Object.keys(sceneGen.SCENE_BASE_MODELS).join(', ')}`);
  }
  return unique;
}

/** Up-front cost of a comparison: per model, the estimate × prompts. */
function estimateComparison(modelKeys, promptCount = PROMPTS_PER_COMPARISON) {
  let total = 0;
  const unpriced = [];
  const perModel = modelKeys.map((key) => {
    const est = sceneGen.estimateBaseStillCost(key);
    const cfg = sceneGen.SCENE_BASE_MODELS[key];
    const usd = typeof est.usd === 'number' ? Math.round(est.usd * promptCount * 1e6) / 1e6 : null;
    if (usd === null) unpriced.push(`${key}: no price in the rate table for ${cfg.width}x${cfg.height}${cfg.quality ? ` ${cfg.quality}` : ''}`);
    else total += usd;
    if (UNPRICED_NOTES[key]) unpriced.push(UNPRICED_NOTES[key]);
    return {
      model_key: key, label: cfg.label, model: cfg.model, provider: cfg.provider,
      width: cfg.width, height: cfg.height, quality: cfg.quality,
      per_still_usd: est.usd, stills: promptCount, usd,
    };
  });
  return { per_model: perModel, total_usd: Math.round(total * 1e6) / 1e6, unpriced };
}

/**
 * Validate a request and resolve its two sources.
 * body: { prompts: [p1, p2] } or { scene_set_ids: [id1, id2] }, models?.
 * Returns { sources: [{ prompt, fields }], modelKeys, estimate }.
 */
async function planComparison(body, db) {
  const { prompts, scene_set_ids: sceneSetIds } = body || {};
  const modelKeys = normalizeModels(body ? body.models : undefined);
  let sources;
  if (Array.isArray(prompts)) {
    if (sceneSetIds) throw badRequest('Send prompts or scene_set_ids, not both');
    if (prompts.length !== PROMPTS_PER_COMPARISON) throw badRequest(`prompts must have exactly ${PROMPTS_PER_COMPARISON} entries`);
    sources = prompts.map((p, i) => {
      const text = typeof p === 'string' ? p.trim() : '';
      if (!text) throw badRequest(`prompts[${i}] must be a non-empty string`);
      if (text.length > MAX_PROMPT_LENGTH) throw badRequest(`prompts[${i}] is longer than ${MAX_PROMPT_LENGTH} characters`);
      return { prompt: text, source_scene_set_id: null, fields: { scene_type: 'OTHER' } };
    });
  } else if (Array.isArray(sceneSetIds)) {
    if (sceneSetIds.length !== PROMPTS_PER_COMPARISON) throw badRequest(`scene_set_ids must have exactly ${PROMPTS_PER_COMPARISON} entries`);
    sources = [];
    for (const id of sceneSetIds) {
      const src = await db.SceneSet.findByPk(id, {
        attributes: ['id', 'name', 'scene_type', 'canonical_description', 'visual_language', 'time_of_day', 'season'],
      });
      if (!src) throw badRequest(`Scene set ${id} not found`, { status: 404 });
      const text = (src.canonical_description || '').trim();
      if (!text) throw badRequest(`Scene set ${id} has no description to use as the prompt`);
      const roomProperties = src.visual_language && src.visual_language.room_properties;
      sources.push({
        prompt: text,
        source_scene_set_id: src.id,
        source_name: src.name,
        fields: {
          scene_type: src.scene_type || 'OTHER',
          time_of_day: src.time_of_day || null,
          season: src.season || null,
          ...(roomProperties ? { visual_language: { room_properties: roomProperties } } : {}),
        },
      });
    }
  } else {
    throw badRequest(`Send prompts: [${PROMPTS_PER_COMPARISON} scene prompts] or scene_set_ids: [${PROMPTS_PER_COMPARISON} ids]`);
  }
  return { sources, modelKeys, estimate: estimateComparison(modelKeys, sources.length) };
}

/** Provider keys the chosen models need that are not configured. */
function missingProviderKeys(modelKeys) {
  const missing = new Set();
  for (const key of modelKeys) {
    const cfg = sceneGen.SCENE_BASE_MODELS[key];
    if (cfg.provider === 'fal' && !process.env.FAL_KEY) missing.add('FAL_KEY');
    if (cfg.provider === 'openai' && !process.env.OPENAI_API_KEY) missing.add('OPENAI_API_KEY');
  }
  return [...missing];
}

/** Refuse (429) before any set is created when the whole run would pass a budget cap. */
async function assertComparisonBudget(estimate) {
  await imageCost.assertImageBudget({ model: 'scene-model-comparison', usd: estimate.total_usd });
}

/** Create the comparison's scene sets (one per model per prompt). */
async function createComparisonSets(plan, db, { requestedBy = null } = {}) {
  const group = crypto.randomUUID();
  const created = [];
  for (const modelKey of plan.modelKeys) {
    const cfg = sceneGen.SCENE_BASE_MODELS[modelKey];
    for (let i = 0; i < plan.sources.length; i += 1) {
      const src = plan.sources[i];
      const set = await db.SceneSet.create({
        name: `${NAME_PREFIX} ${group.slice(0, 8)}] P${i + 1} · ${cfg.label}`,
        canonical_description: src.prompt,
        ...src.fields,
        base_model: modelKey,
        generation_status: 'pending',
        base_generation: {
          comparison_group: group,
          comparison_prompt_index: i,
          comparison_prompt: src.prompt,
          source_scene_set_id: src.source_scene_set_id,
          requested_by: requestedBy,
        },
      });
      created.push(set);
    }
  }
  return { group, sets: created };
}

/**
 * Generate each set's base still in turn (stills only). A failure is logged
 * and marks that set failed; a budget refusal stops the run and marks the
 * rest failed, since every later call would be refused too.
 */
async function runComparison(sets, db) {
  const results = [];
  let stopped = null;
  for (const set of sets) {
    if (stopped) {
      await db.SceneSet.update({ generation_status: 'failed' }, { where: { id: set.id } });
      results.push({ id: set.id, ok: false, error: stopped });
      continue;
    }
    try {
      const out = await sceneGen.generateBaseScene(set, db, { skipAnalysis: true });
      results.push({ id: set.id, ok: true, cost: out.cost });
    } catch (err) {
      console.error(`[ModelComparison] base still for ${set.id} (${set.base_model}) failed: ${err.message}`);
      results.push({ id: set.id, ok: false, error: err.message });
      if (imageCost.isBudgetError(err)) stopped = err.message;
    }
  }
  return results;
}

/** The logged ai_usage_logs rows for the given ids, keyed by id. */
async function loadUsageRows(ids, db) {
  if (!ids.length || !db.AIUsageLog) return new Map();
  const rows = await db.AIUsageLog.findAll({
    where: { id: ids },
    attributes: ['id', 'model_name', 'cost_usd', 'input_tokens', 'created_at'],
  });
  return new Map(rows.map((r) => [String(r.id), r]));
}

/** One comparison group laid out per model column, with logged costs. */
async function getComparison(group, db) {
  const sets = await db.SceneSet.findAll({
    where: { base_generation: { comparison_group: group } },
    attributes: ['id', 'name', 'base_model', 'base_generation', 'base_still_url', 'generation_status', 'generation_cost', 'created_at'],
    order: [['created_at', 'ASC']],
  });
  if (!sets.length) return null;

  const ids = [];
  for (const s of sets) for (const id of ((s.base_generation || {}).usage_log_ids || [])) ids.push(id);
  const usage = await loadUsageRows(ids, db);

  const columns = new Map();
  for (const s of sets) {
    const bg = s.base_generation || {};
    const key = s.base_model;
    const cfg = sceneGen.SCENE_BASE_MODELS[key] || { label: key, model: key };
    if (!columns.has(key)) {
      columns.set(key, {
        model_key: key, label: cfg.label, model: cfg.model, provider: cfg.provider,
        width: cfg.width, height: cfg.height, quality: cfg.quality || null,
        estimate_usd: sceneGen.isBaseModelKey(key) ? sceneGen.estimateBaseStillCost(key).usd : null,
        logged_total_usd: 0, logged_complete: true, sets: [],
      });
    }
    const col = columns.get(key);
    const rows = (bg.usage_log_ids || []).map((id) => usage.get(String(id))).filter(Boolean);
    let logged = null;
    if (rows.length) {
      const priced = rows.filter((r) => r.cost_usd !== null && r.cost_usd !== undefined);
      logged = priced.length === rows.length
        ? Math.round(priced.reduce((sum, r) => sum + Number(r.cost_usd), 0) * 1e6) / 1e6
        : null;
    }
    if (typeof logged === 'number') col.logged_total_usd = Math.round((col.logged_total_usd + logged) * 1e6) / 1e6;
    else col.logged_complete = false;
    col.sets.push({
      id: s.id,
      name: s.name,
      prompt_index: bg.comparison_prompt_index,
      prompt: bg.comparison_prompt,
      base_still_url: s.base_still_url,
      generation_status: s.generation_status,
      generated_width: bg.width || null,
      generated_height: bg.height || null,
      logged_cost_usd: logged,
      usage_log_ids: bg.usage_log_ids || [],
      input_tokens_unpriced: Boolean(bg.input_tokens_unpriced),
    });
  }
  const out = [...columns.values()];
  for (const col of out) col.sets.sort((a, b) => (a.prompt_index || 0) - (b.prompt_index || 0));
  const prompts = [];
  for (const col of out) for (const s of col.sets) if (prompts[s.prompt_index] === undefined) prompts[s.prompt_index] = s.prompt;
  return {
    group,
    created_at: sets[0].created_at,
    prompts,
    columns: out,
    default_model: sceneGen.defaultBaseModel(),
  };
}

/** Recent comparison groups, newest first. */
async function listComparisons(db, limit = 10) {
  const rows = await db.sequelize.query(
    `SELECT base_generation->>'comparison_group' AS comparison_group,
            MIN(created_at) AS created_at,
            COUNT(*)::int AS set_count
       FROM scene_sets
      WHERE deleted_at IS NULL AND base_generation->>'comparison_group' IS NOT NULL
      GROUP BY base_generation->>'comparison_group'
      ORDER BY MIN(created_at) DESC
      LIMIT :limit`,
    { replacements: { limit }, type: db.sequelize.QueryTypes.SELECT },
  );
  return rows.map((r) => ({ group: r.comparison_group, created_at: r.created_at, set_count: r.set_count }));
}

module.exports = {
  PROMPTS_PER_COMPARISON,
  UNPRICED_NOTES,
  normalizeModels,
  estimateComparison,
  planComparison,
  missingProviderKeys,
  assertComparisonBudget,
  createComparisonSets,
  runComparison,
  getComparison,
  listComparisons,
};
