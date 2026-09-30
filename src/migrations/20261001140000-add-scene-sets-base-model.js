'use strict';

/**
 * Per-scene-set base still model (Task #2396; Evoni, 2026-09-30).
 *
 *   base_model       VARCHAR(40) NULL — which image model draws the set's base
 *                    still. NULL = the default (env SCENE_BASE_MODEL_DEFAULT,
 *                    else 'flux-dev', today's behaviour). Allowed values are
 *                    enforced in code (sceneGenerationService.SCENE_BASE_MODELS):
 *                      'flux-dev'       fal-ai/flux/dev,       1024x576
 *                      'flux-pro-1.1'   fal-ai/flux-pro/v1.1,  1024x576
 *                      'gpt-image-1.5'  OpenAI gpt-image-1.5,  1536x1024 high
 *   base_generation  JSONB NULL — what the last base still generation actually
 *                    used and cost: model key, provider model id, size,
 *                    quality, the ai_usage_logs row id and cost, and (for the
 *                    base-model comparison) comparison_group / prompt_index.
 *                    Its own column rather than a key in visual_language,
 *                    because the style auto-lock writes visual_language from
 *                    a snapshot taken before generation and would drop it.
 *
 * ADD COLUMN IF NOT EXISTS, and skipped when the table is absent, so a re-run
 * or a partial database never fails here.
 */
const tableExists = async (queryInterface, table) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT to_regclass(:name) AS reg',
    { replacements: { name: `public.${table}` } },
  );
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'scene_sets'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS base_model character varying(40)');
    await q('ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS base_generation jsonb');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'scene_sets'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE scene_sets DROP COLUMN IF EXISTS base_generation');
    await q('ALTER TABLE scene_sets DROP COLUMN IF EXISTS base_model');
  },
};
