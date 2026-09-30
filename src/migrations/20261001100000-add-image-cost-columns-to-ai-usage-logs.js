'use strict';

/**
 * Image generation cost columns on ai_usage_logs (Task #2387).
 *
 * Every image generation call (fal.ai Flux, OpenAI images, Replicate) now
 * writes a row to ai_usage_logs, the table aiCostTracker's daily budget sums.
 * Anthropic rows leave these three columns NULL; image rows set all three:
 *
 *   provider      'fal' | 'openai' | 'replicate'
 *   billing_unit  'megapixel' | 'image' (the unit the rate table prices by)
 *   billed_units  how many of that unit the call was billed (megapixels are
 *                 rounded up to whole megapixels; see imageCostService)
 *
 * The image budget (AI_DAILY_IMAGE_BUDGET_USD) sums cost_usd over rows whose
 * billing_unit IS NOT NULL. cost_usd itself is already nullable (canon capture
 * docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt L13: numeric,
 * YES); an image row whose model has no price yet is written with cost_usd
 * NULL, never 0.
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
    if (!(await tableExists(queryInterface, 'ai_usage_logs'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS provider character varying(50)');
    await q('ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS billing_unit character varying(20)');
    await q('ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS billed_units numeric(12,4)');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'ai_usage_logs'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE ai_usage_logs DROP COLUMN IF EXISTS billed_units');
    await q('ALTER TABLE ai_usage_logs DROP COLUMN IF EXISTS billing_unit');
    await q('ALTER TABLE ai_usage_logs DROP COLUMN IF EXISTS provider');
  },
};
