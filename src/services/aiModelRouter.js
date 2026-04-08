/**
 * aiModelRouter.js — Smart model selection for cost optimization
 *
 * Instead of hardcoding models in every route, use selectModel(task) to
 * automatically pick the cheapest model capable of handling the task.
 *
 * TIERS:
 *   Haiku  ($0.80/$4)   — classification, scoring, short JSON, simple rewrites
 *   Sonnet ($3/$15)     — creative writing, complex analysis, long generation
 *
 * USAGE:
 *   const { selectModel, HAIKU, SONNET } = require('../services/aiModelRouter');
 *
 *   // Auto-select based on task characteristics:
 *   const model = selectModel({ maxTokens: 200, taskType: 'classification' });
 *
 *   // Or use constants directly:
 *   model: HAIKU   // for known-simple tasks
 *   model: SONNET  // for known-complex tasks
 */

const HAIKU  = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

// Tasks that are safe for Haiku
const HAIKU_TASK_TYPES = new Set([
  'classification',    // yes/no, category selection, scoring
  'extraction',        // pull structured data from text
  'summarization',     // short summaries
  'rewrite_simple',    // dialogue rewrites, brief enhancements
  'json_generation',   // simple JSON output
  'validation',        // checking/verifying data
  'scoring',           // numerical scoring/rating
]);

// Tasks that need Sonnet
const SONNET_TASK_TYPES = new Set([
  'creative_writing',  // stories, prose, narrative
  'complex_analysis',  // deep character analysis, continuity checking
  'long_generation',   // >2000 token outputs
  'vision',            // image analysis
  'voice_matching',    // matching specific character voice/register
  'multi_step',        // complex multi-step reasoning
]);

/**
 * Select the optimal model based on task characteristics.
 *
 * @param {Object} opts
 * @param {number} [opts.maxTokens=4096] — max_tokens for the call
 * @param {string} [opts.taskType] — one of the task types above
 * @param {number} [opts.temperature=0] — if >0.3, implies creative task
 * @param {boolean} [opts.hasImages=false] — vision tasks need Sonnet
 * @returns {string} model ID
 */
function selectModel(opts = {}) {
  const { maxTokens = 4096, taskType, temperature = 0, hasImages = false } = opts;

  // Vision tasks always need Sonnet
  if (hasImages) return SONNET;

  // High temperature = creative = Sonnet
  if (temperature > 0.3) return SONNET;

  // Explicit task type routing
  if (taskType && HAIKU_TASK_TYPES.has(taskType)) return HAIKU;
  if (taskType && SONNET_TASK_TYPES.has(taskType)) return SONNET;

  // Heuristic: small output = likely classification/extraction
  if (maxTokens <= 500) return HAIKU;

  // Heuristic: medium output could go either way, default Sonnet for safety
  if (maxTokens <= 1000) return SONNET;

  // Large output = complex generation
  return SONNET;
}

module.exports = { selectModel, HAIKU, SONNET, HAIKU_TASK_TYPES, SONNET_TASK_TYPES };
