/**
 * phoneConditionSchema — validation for phone zone conditions + actions.
 *
 * Shared between:
 *   - save handlers in uiOverlayRoutes.js (reject invalid zones on PUT)
 *   - phoneAIRoutes.js confirm step (reject invalid AI proposals)
 *   - phoneRuntime.js evaluator (server-side safety net)
 *
 * Design notes:
 *   - Conditions are flat in v1: an array of {key, op, value} ANDed together. Tree
 *     operators are intentionally NOT supported yet — start simple so both creators
 *     and the AI can produce reliable rules.
 *   - Action `type` is an ALLOWLIST. New types must be added here AND in phoneRuntime's
 *     action dispatch. This is the primary defense against AI hallucinating destructive
 *     actions like "delete_character".
 *   - Every conditions/actions array may include a `schema_version: 1` sibling field
 *     on the containing zone, allowing future grammar evolution via dispatch.
 */
const Joi = require('joi');

// ── Condition grammar ────────────────────────────────────────────────────────

const CONDITION_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'];

/**
 * A single condition. `key` is a free-form state flag name; v1 accepts anything that
 * matches a loose identifier. PR3 will introduce a registry with autocomplete.
 */
const conditionSchema = Joi.object({
  key: Joi.string().trim().min(1).max(80).pattern(/^[a-z][a-z0-9_.]*$/i).required(),
  op: Joi.string().valid(...CONDITION_OPS).required(),
  // `value` is optional for `exists`/`not_exists`; otherwise any JSON primitive.
  value: Joi.alternatives(Joi.boolean(), Joi.number(), Joi.string().max(500), Joi.valid(null)),
}).unknown(false);

const conditionsArraySchema = Joi.array().items(conditionSchema).max(16);

// ── Action grammar ───────────────────────────────────────────────────────────

/**
 * ALLOWLIST — any `type` not in this object is rejected. Order matches phoneRuntime's
 * dispatch; keep them in sync.
 */
const ACTION_SCHEMAS = {
  navigate: Joi.object({
    type: Joi.string().valid('navigate').required(),
    target: Joi.string().trim().min(1).max(120).required(),
  }).unknown(false),

  set_state: Joi.object({
    type: Joi.string().valid('set_state').required(),
    key: Joi.string().trim().min(1).max(80).pattern(/^[a-z][a-z0-9_.]*$/i).required(),
    value: Joi.alternatives(Joi.boolean(), Joi.number(), Joi.string().max(500), Joi.valid(null)).required(),
  }).unknown(false),

  show_toast: Joi.object({
    type: Joi.string().valid('show_toast').required(),
    text: Joi.string().trim().min(1).max(200).required(),
    tone: Joi.string().valid('info', 'success', 'warning', 'error').default('info'),
  }).unknown(false),

  complete_episode: Joi.object({
    type: Joi.string().valid('complete_episode').required(),
  }).unknown(false),
};

const ALLOWED_ACTION_TYPES = Object.keys(ACTION_SCHEMAS);

const actionSchema = Joi.object({ type: Joi.string().required() })
  .unknown(true)
  .custom((value, helpers) => {
    const schema = ACTION_SCHEMAS[value.type];
    if (!schema) {
      return helpers.message(`action type "${value.type}" not in allowlist`);
    }
    const { error, value: clean } = schema.validate(value, { abortEarly: false, stripUnknown: false });
    if (error) return helpers.message(error.message);
    return clean;
  });

const actionsArraySchema = Joi.array().items(actionSchema).max(8);

// ── Zone wrapper ─────────────────────────────────────────────────────────────

/**
 * Validate a single screen_link entry's optional `conditions` + `actions`. The caller
 * is responsible for passing only the condition/action-relevant fields; we don't
 * validate x/y/w/h/label/target here (existing validation covers those).
 */
function validateZoneRules(zone) {
  const result = {};
  if (zone.conditions !== undefined) {
    const { error, value } = conditionsArraySchema.validate(zone.conditions, { abortEarly: false });
    if (error) return { error: `zone ${zone.id || '?'} conditions: ${error.message}` };
    result.conditions = value;
  }
  if (zone.actions !== undefined) {
    const { error, value } = actionsArraySchema.validate(zone.actions, { abortEarly: false });
    if (error) return { error: `zone ${zone.id || '?'} actions: ${error.message}` };
    result.actions = value;
  }
  return { value: result };
}

/**
 * Validate an entire screen_links array. Returns { error } or { value: validatedZones }.
 */
function validateScreenLinks(links) {
  if (!Array.isArray(links)) return { error: 'screen_links must be an array' };
  const out = [];
  const zoneErrors = [];
  links.forEach((zone, index) => {
    const { error, value } = validateZoneRules(zone);
    if (error) {
      zoneErrors.push({ zone_id: zone?.id || null, index, error });
      return;
    }
    out.push({ ...zone, ...value });
  });
  if (zoneErrors.length) {
    // Keep the top-level `error` string back-compatible: embed the first zone's
    // detail (which contains the original Joi message — "allowlist"/"invalid"
    // etc.) so existing callers matching on the raw text still work. The
    // per-zone array under `zone_errors` gives the UI everything it needs to
    // highlight specific zones.
    const summary = zoneErrors.length === 1
      ? zoneErrors[0].error
      : `Validation failed on ${zoneErrors.length} zones (${zoneErrors.map(z => z.zone_id || `#${z.index}`).join(', ')}); first: ${zoneErrors[0].error}`;
    return { error: summary, zone_errors: zoneErrors };
  }
  return { value: out };
}

// ── Mission objective + payload ─────────────────────────────────────────────
// Missions are read-only observers (PR4). Each objective is just a labeled
// conditions array — no actions, no rewards yet. Reusing conditionsArraySchema
// keeps the grammar consistent with zones + content zones.

const objectiveSchema = Joi.object({
  id: Joi.string().trim().max(60).required(),
  label: Joi.string().trim().min(1).max(160).required(),
  condition: conditionsArraySchema.required(),
}).unknown(false);

const missionPayloadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  icon_url: Joi.string().trim().max(500).allow('', null),
  start_condition: conditionsArraySchema.optional(),
  objectives: Joi.array().items(objectiveSchema).max(12).default([]),
  // Rewards reuse the zone-action allowlist — same validator, same schema,
  // same server-side guarantees. Defaults to an empty array so existing
  // missions keep working.
  reward_actions: actionsArraySchema.default([]),
  display_order: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
  episode_id: Joi.string().trim().max(64).allow(null),
}).unknown(false);

function validateMissionPayload(payload) {
  const { error, value } = missionPayloadSchema.validate(payload || {}, { abortEarly: false });
  if (error) return { error: error.message };
  return { value };
}

module.exports = {
  CONDITION_OPS,
  ALLOWED_ACTION_TYPES,
  conditionSchema,
  conditionsArraySchema,
  actionSchema,
  actionsArraySchema,
  validateZoneRules,
  validateScreenLinks,
  objectiveSchema,
  missionPayloadSchema,
  validateMissionPayload,
};
