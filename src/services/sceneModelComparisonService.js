'use strict';

/**
 * sceneModelComparisonService — base-still model comparison (Task #2396).
 *
 * Evoni, 2026-09-30: "generate base stills only, 2 sets per model, using the
 * same two scene prompts, and put them side by side in the comparison view
 * with their logged costs. I'll choose the default from that."
 *
 * Evoni, 2026-10-02: "make sure 'Compare base models' builds each image
 * from a real scene set's Scene Brief (place layer, environment, no-people
 * rule), not free text". So a comparison takes two scene set ids, never free
 * prompts. Each source set's Scene Brief is built once (S1: its World
 * Location's place layer, the environment, the rules; WIDE, no event, its
 * own last overrides, as its own base would be drawn) and every model draws
 * from that same prompt.
 *
 * Evoni, 2026-10-02: "Allow any of the show's sets with a description; the
 * World Location's place layer is used when linked, otherwise the set's own
 * description." So only a set with no description is refused.
 *
 * A comparison is one group of scene sets: for each model and each of the
 * two source sets, one copy whose base_model is that model. The group is
 * keyed by scene_sets.base_generation.comparison_group (a UUID); each copy
 * also carries comparison_prompt_index, the prompt, the source set and its
 * brief. The copies carry no World Location, so they never join the venue's
 * sets or touch its approved base; the sources are never written. Only base
 * stills are generated (no angles, no Claude Vision analysis or style
 * lock). Every image call goes
 * through imageCostService.runImageCall (budget-gated, logged to
 * ai_usage_logs); generateBaseScene stores the logged row ids and cost on the
 * set, and the comparison view reads the cost back from ai_usage_logs.
 */

const crypto = require('crypto');
const imageCost = require('./imageCostService');
const sceneGen = require('./sceneGenerationService');
const { prepareSceneBrief, briefToPrompt } = require('./sceneBriefService');

const PROMPTS_PER_COMPARISON = 2;
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
 * Validate a request and build its two sources' Scene Briefs.
 * body: { scene_set_ids: [id1, id2], models? }.
 * Returns { sources: [{ prompt, brief, source_scene_set_id, source_name, fields }], modelKeys, estimate }.
 */
async function planComparison(body, db) {
  const { prompts, scene_set_ids: sceneSetIds } = body || {};
  if (prompts !== undefined) {
    throw badRequest(`Free prompts are not taken: send scene_set_ids, ${PROMPTS_PER_COMPARISON} scene sets whose Scene Briefs are drawn`);
  }
  const modelKeys = normalizeModels(body ? body.models : undefined);
  if (!Array.isArray(sceneSetIds) || sceneSetIds.length !== PROMPTS_PER_COMPARISON) {
    throw badRequest(`scene_set_ids must have exactly ${PROMPTS_PER_COMPARISON} entries`);
  }
  if (new Set(sceneSetIds).size !== sceneSetIds.length) throw badRequest('Choose two different scene sets');
  const sources = [];
  for (const id of sceneSetIds) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw badRequest(`Scene set id ${id} is not a UUID`);
    const src = await db.SceneSet.findByPk(id);
    if (!src) throw badRequest(`Scene set ${id} not found`, { status: 404 });
    if (String(src.name || '').startsWith(NAME_PREFIX)) throw badRequest(`Scene set "${src.name}" is a comparison still, not a scene set`);
    const brief = await prepareSceneBrief(db.sequelize, src, {
      angleLabel: 'WIDE',
      eventId: null,
      overrides: (src.base_generation && src.base_generation.brief && src.base_generation.brief.overrides) || {},
    });
    // A World Location is used when linked; without one the set's own
    // description is the place. Without a description there is no place.
    if (brief.missing.some((m) => m.key === 'description')) {
      throw badRequest(`Scene set "${src.name}" has no Description: its Scene Brief would not describe the place`);
    }
    sources.push({
      prompt: briefToPrompt(brief),
      brief,
      source_scene_set_id: src.id,
      source_name: src.name,
      fields: {
        scene_type: src.scene_type || 'OTHER',
        time_of_day: src.time_of_day || null,
        season: src.season || null,
        style_reference_url: src.style_reference_url || null,
      },
    });
  }
  return { sources, modelKeys, estimate: estimateComparison(modelKeys, sources.length) };
}

/** What the estimate step shows of each source: its name and the prompt every model is sent. */
function describeSources(plan) {
  return plan.sources.map((s) => ({
    scene_set_id: s.source_scene_set_id,
    name: s.source_name,
    prompt: s.prompt,
    missing: s.brief.missing,
  }));
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
        canonical_description: src.brief.lines.find((l) => l.key === 'description')?.text || null,
        ...src.fields,
        base_model: modelKey,
        generation_status: 'pending',
        base_generation: {
          comparison_group: group,
          comparison_prompt_index: i,
          comparison_prompt: src.prompt,
          source_scene_set_id: src.source_scene_set_id,
          source_name: src.source_name,
          comparison_brief: src.brief,
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
      // The source set's brief, built once at planning: every model draws
      // the same prompt.
      const out = await sceneGen.generateBaseScene(set, db, {
        skipAnalysis: true,
        brief: (set.base_generation || {}).comparison_brief || null,
      });
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
      source_scene_set_id: bg.source_scene_set_id || null,
      source_name: bg.source_name || null,
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
  const sources = [];
  for (const col of out) {
    for (const s of col.sets) {
      if (prompts[s.prompt_index] === undefined) prompts[s.prompt_index] = s.prompt;
      if (sources[s.prompt_index] === undefined) sources[s.prompt_index] = { scene_set_id: s.source_scene_set_id, name: s.source_name };
    }
  }
  return {
    group,
    created_at: sets[0].created_at,
    prompts,
    sources,
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
  describeSources,
  missingProviderKeys,
  assertComparisonBudget,
  createComparisonSets,
  runComparison,
  getComparison,
  listComparisons,
};
