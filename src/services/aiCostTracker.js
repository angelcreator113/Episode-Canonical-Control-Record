/**
 * aiCostTracker.js — Universal Anthropic API cost tracking
 *
 * HOW IT WORKS:
 *   Monkey-patches the Anthropic SDK's Messages.create() method so every
 *   single API call across the entire app is automatically logged to the
 *   ai_usage_logs table — no changes needed in any route file.
 *
 * PRICING (per 1M tokens, as of 2025):
 *   claude-opus-4      → $15 input / $75 output
 *   claude-sonnet-4    → $3 input / $15 output
 *   claude-haiku-4     → $0.80 input / $4 output
 *   Cache-creation     → 1.25× input price
 *   Cache-read         → 0.10× input price
 *
 * USAGE:
 *   Just require() this file once at app startup BEFORE any routes load.
 *   require('./services/aiCostTracker');
 */

/* eslint-disable no-console */

// Pricing per 1M tokens (USD)
const MODEL_PRICING = {
  // Opus 4
  'claude-opus-4-20250514':     { input: 15,   output: 75 },
  'claude-opus-4':              { input: 15,   output: 75 },
  // Sonnet 4
  'claude-sonnet-4-20250514':   { input: 3,    output: 15 },
  'claude-sonnet-4-6':          { input: 3,    output: 15 },
  'claude-sonnet-4':            { input: 3,    output: 15 },
  // Haiku 4
  'claude-haiku-4-5-20251001':  { input: 0.80, output: 4 },
  'claude-haiku-4':             { input: 0.80, output: 4 },
  // Older models (fallback)
  'claude-3-5-sonnet-20241022': { input: 3,    output: 15 },
  'claude-3-haiku-20240307':    { input: 0.25, output: 1.25 },
};

// Default if model not recognized
const DEFAULT_PRICING = { input: 3, output: 15 };

function calculateCost(model, usage) {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputTokens       = usage.input_tokens || 0;
  const outputTokens      = usage.output_tokens || 0;
  const cacheCreation     = usage.cache_creation_input_tokens || 0;
  const cacheRead         = usage.cache_read_input_tokens || 0;

  // Standard tokens (subtract cached tokens from input count)
  const standardInput = Math.max(0, inputTokens - cacheCreation - cacheRead);

  const cost =
    (standardInput   / 1_000_000) * pricing.input +
    (outputTokens    / 1_000_000) * pricing.output +
    (cacheCreation   / 1_000_000) * pricing.input * 1.25 +
    (cacheRead       / 1_000_000) * pricing.input * 0.10;

  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places
}

// Try to figure out which route triggered this call from the call stack
function inferRouteName() {
  const stack = new Error().stack || '';
  const lines = stack.split('\n');
  for (const line of lines) {
    // Look for route files
    const match = line.match(/\broutes[\\/]([a-zA-Z_-]+)\b/);
    if (match) return match[1];
    // Look for service files
    const svcMatch = line.match(/\bservices[\\/]([a-zA-Z_-]+)\b/);
    if (svcMatch) return svcMatch[1];
  }
  return 'unknown';
}

// ── Daily budget limiter ──────────────────────────────────────────────────
// Set AI_DAILY_BUDGET_USD to cap daily spending (default: no limit).
// When the budget is exceeded, API calls are blocked and return an error.
// The counter resets at midnight UTC.
let dailySpend = 0;
let dailySpendDate = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
const DAILY_BUDGET = parseFloat(process.env.AI_DAILY_BUDGET_USD) || 50;

function checkBudget(costEstimate) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailySpendDate) {
    dailySpend = 0;
    dailySpendDate = today;
  }
  return (dailySpend + costEstimate) <= DAILY_BUDGET;
}

function recordSpend(cost) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailySpendDate) {
    dailySpend = 0;
    dailySpendDate = today;
  }
  dailySpend += cost;
  // Warn at 80% budget
  if (DAILY_BUDGET < Infinity && dailySpend >= DAILY_BUDGET * 0.8) {
    console.warn(`[AI Cost] Daily spend $${dailySpend.toFixed(2)} / $${DAILY_BUDGET} (${Math.round(dailySpend / DAILY_BUDGET * 100)}%)`);
  }
}

function getDailySpend() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailySpendDate) return 0;
  return dailySpend;
}

let patchApplied = false;

function applyPatch() {
  if (patchApplied) return;

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    console.log('⚠️  @anthropic-ai/sdk not installed — AI cost tracking disabled');
    return;
  }

  // The SDK exports a default class. Instances have a `.messages` property
  // which is an instance of Messages. We patch the Messages prototype.
  // In the Anthropic SDK, Anthropic.default or Anthropic itself is the class.
  const AnthropicClass = Anthropic.default || Anthropic;

  // Create a temporary instance to access the Messages prototype
  let MessagesProto;
  try {
    // Some SDK versions expose an internal Messages class
    const tempClient = new AnthropicClass({ apiKey: 'temp-for-proto-access' });
    MessagesProto = Object.getPrototypeOf(tempClient.messages);
  } catch {
    console.log('⚠️  Could not access Anthropic Messages prototype — cost tracking disabled');
    return;
  }

  if (!MessagesProto || !MessagesProto.create) {
    console.log('⚠️  Messages.create not found on prototype — cost tracking disabled');
    return;
  }

  const originalCreate = MessagesProto.create;

  // IMPORTANT: Must NOT be async — async functions always return plain Promises,
  // which strips the SDK's APIPromise (which has .withResponse(), .asResponse(), etc.).
  // The SDK's messages.stream() internally calls create(...).withResponse(),
  // so wrapping create() in async breaks all streaming.
  MessagesProto.create = function trackedCreate(params, ...rest) {
    const startTime = Date.now();
    const routeName = inferRouteName();
    const model = params?.model || 'unknown';

    // Budget gate — estimate worst-case cost before making the call
    if (DAILY_BUDGET < Infinity) {
      const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
      const maxTokens = params?.max_tokens || 4096;
      const estimatedCost = (maxTokens / 1_000_000) * pricing.output; // worst-case: full output
      if (!checkBudget(estimatedCost)) {
        const err = new Error(`AI daily budget exceeded ($${dailySpend.toFixed(2)} / $${DAILY_BUDGET}). Call blocked.`);
        err.status = 429;
        console.error(`[AI Cost] BLOCKED ${routeName} — budget exceeded`);
        return Promise.reject(err);
      }
    }

    const logUsage = (response, isError, errorType) => {
      const duration = Date.now() - startTime;
      const usage = response?.usage || {};
      const cost = isError ? 0 : calculateCost(model, usage);

      // Track daily spend for budget limiter
      if (!isError && cost > 0) recordSpend(cost);

      // Fire-and-forget DB write — never block the caller
      setImmediate(() => {
        try {
          const db = require('../models');
          if (db.AIUsageLog) {
            db.AIUsageLog.create({
              route_name: routeName,
              model_name: model,
              input_tokens: usage.input_tokens || 0,
              output_tokens: usage.output_tokens || 0,
              cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
              cache_read_input_tokens: usage.cache_read_input_tokens || 0,
              cost_usd: cost,
              duration_ms: duration,
              is_error: isError,
              error_type: errorType,
            }).catch(dbErr => {
              if (process.env.NODE_ENV !== 'production') {
                console.log('⚠️  AI cost log write failed:', dbErr.message);
              }
            });
          }
        } catch {
          // models not loaded yet or table missing — skip silently
        }
      });
    };

    // Call original — returns APIPromise (which has .withResponse, .asResponse, etc.)
    // We must return THIS object, not a new Promise wrapper.
    const result = originalCreate.call(this, params, ...rest);

    // Hook into the promise chain for logging without changing the return type.
    // APIPromise.then() returns a new plain Promise, so we can't use that as our return.
    // Instead, attach a side-effect via .then() on a SEPARATE chain.
    Promise.resolve(result).then(
      (response) => logUsage(response, false, null),
      (err) => logUsage(null, true, err?.error?.type || err?.status?.toString() || err.constructor?.name || 'unknown'),
    );

    return result;
  };

  patchApplied = true;
  console.log('💰 AI cost tracking enabled — all Anthropic API calls will be logged');
}

// Auto-apply on require
applyPatch();

module.exports = { calculateCost, MODEL_PRICING, getDailySpend, DAILY_BUDGET };
