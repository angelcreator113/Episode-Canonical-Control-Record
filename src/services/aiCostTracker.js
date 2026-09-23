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
  
  // Skip these service files — they're wrappers, not the actual callers
  const skipServices = ['aiCostTracker', 'anthropic', 'index'];
  
  let foundRoute = null;
  let foundService = null;
  
  for (const line of lines) {
    // Look for route files (highest priority)
    const routeMatch = line.match(/\broutes[\\/]([a-zA-Z0-9_-]+)\.js/);
    if (routeMatch && !foundRoute) {
      foundRoute = routeMatch[1];
    }
    
    // Look for service files (lower priority, skip wrapper services)
    const svcMatch = line.match(/\bservices[\\/]([a-zA-Z0-9_-]+)\.js/);
    if (svcMatch && !foundService && !skipServices.includes(svcMatch[1])) {
      foundService = svcMatch[1];
    }
    
    // Look for workers
    const workerMatch = line.match(/\bworkers[\\/]([a-zA-Z0-9_-]+)\.js/);
    if (workerMatch) {
      return `worker:${workerMatch[1]}`;
    }
  }
  
  // Prefer route over service
  if (foundRoute) return foundRoute;
  if (foundService) return `svc:${foundService}`;
  
  return 'unknown';
}

// ── Daily budget limiter ──────────────────────────────────────────────────
// Hard stop. Set AI_DAILY_BUDGET_USD to the daily cap in USD; if it is unset
// or not a number, the cap is $50. When a call's worst-case estimate would
// take today's spend past the cap, the call is refused before it is made
// (429). The check runs once, before each call starts: a call already in
// flight, including a stream, completes; the next call is refused. Days are
// UTC.
//
// Today's spend is read from ai_usage_logs, the rows this tracker writes, so
// it survives restarts and is the same figure in every process that writes
// there (#1735). create() must stay synchronous (see trackedCreate), so the
// check reads a cached figure:
//   - dbSpend: SUM(cost_usd) for today, re-read at most every SPEND_CACHE_MS,
//     in the background, when a check or record finds it stale;
//   - pendingSpend: spend this process recorded whose ai_usage_logs row has
//     not been written yet (rows are written fire-and-forget), so its own
//     calls count at once;
//   - persistedSpend: spend whose row this process has written but no read
//     has summed yet. A read that succeeds subtracts only the rows written
//     before it started, so a call is never counted twice or dropped.
// If a read fails, the last figure is kept and local spend keeps adding to it
// (fail open, degrading to an in-process counter): refusing every AI call
// because the usage log could not be read would turn a logging fault into an
// outage. At a UTC day change both parts reset to zero and a read is started.
const DAILY_BUDGET = parseFloat(process.env.AI_DAILY_BUDGET_USD) || 50;
const SPEND_CACHE_MS = 30_000;

const spendCache = {
  date: null,       // 'YYYY-MM-DD' (UTC) the figures below belong to
  dbSpend: 0,          // last SUM(cost_usd) read for that day
  pendingSpend: 0,     // recorded here, row not yet written
  persistedSpend: 0,   // row written here, not yet summed by a read
  fetchedAt: 0,     // when the last read started (ms)
  inFlight: null,   // the pending read, if any
};

function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function rollDay() {
  const today = utcDay();
  if (spendCache.date !== today) {
    spendCache.date = today;
    spendCache.dbSpend = 0;
    spendCache.pendingSpend = 0;
    spendCache.persistedSpend = 0;
    spendCache.fetchedAt = 0;
  }
  return today;
}

function refreshSpend() {
  if (spendCache.inFlight) return spendCache.inFlight;
  const day = rollDay();
  const startedAt = Date.now();
  const persistedAtStart = spendCache.persistedSpend;
  spendCache.fetchedAt = startedAt;
  spendCache.inFlight = (async () => {
    try {
      const db = require('../models');
      if (!db.AIUsageLog) throw new Error('AIUsageLog model not loaded');
      const { Op } = require('sequelize');
      const total = await db.AIUsageLog.sum('cost_usd', {
        where: { created_at: { [Op.gte]: new Date(`${day}T00:00:00.000Z`) } },
      });
      if (spendCache.date === day) {
        spendCache.dbSpend = Number(total) || 0;
        // Rows written before this read started are in the sum it returned.
        spendCache.persistedSpend = Math.max(0, spendCache.persistedSpend - persistedAtStart);
      }
    } catch (err) {
      console.warn(`[AI Cost] could not read today's spend from ai_usage_logs; keeping $${getDailySpend().toFixed(2)}: ${err.message}`);
    } finally {
      spendCache.inFlight = null;
    }
  })();
  return spendCache.inFlight;
}

function refreshIfStale() {
  rollDay();
  if (Date.now() - spendCache.fetchedAt >= SPEND_CACHE_MS) refreshSpend();
}

function getDailySpend() {
  rollDay();
  return spendCache.dbSpend + spendCache.pendingSpend + spendCache.persistedSpend;
}

function checkBudget(costEstimate) {
  refreshIfStale();
  return (getDailySpend() + costEstimate) <= DAILY_BUDGET;
}

// Returns a callback to run once the call's ai_usage_logs row is written.
function recordSpend(cost) {
  const day = rollDay();
  spendCache.pendingSpend += cost;
  refreshIfStale();
  const spent = getDailySpend();
  // Warn at 80% budget
  if (DAILY_BUDGET < Infinity && spent >= DAILY_BUDGET * 0.8) {
    console.warn(`[AI Cost] Daily spend $${spent.toFixed(2)} / $${DAILY_BUDGET} (${Math.round(spent / DAILY_BUDGET * 100)}%)`);
  }
  return () => {
    if (spendCache.date !== day) return;
    spendCache.pendingSpend = Math.max(0, spendCache.pendingSpend - cost);
    spendCache.persistedSpend += cost;
  };
}

let patchApplied = false;

function errorTypeOf(err) {
  return err?.error?.type || err?.status?.toString() || err?.constructor?.name || 'unknown';
}

// Streamed calls (messages.stream(), or create({ stream: true })) resolve to a
// Stream before any tokens exist. Wrap its iterator so the usage the API
// reports while streaming is collected, and write exactly one row when the
// stream ends — completed, errored, or abandoned by its consumer.
//
// Input tokens arrive in message_start; the final output count arrives only in
// message_delta, near the end. A stream that stops before message_delta is
// logged with its input tokens and the output count message_start reported,
// which undercounts the output actually generated.
function trackStreamUsage(stream, logUsage) {
  const originalIterator = stream.iterator;
  const usage = {};
  let completed = false;
  let logged = false;

  stream.iterator = async function* trackedIterator() {
    let failure = null;
    try {
      for await (const event of originalIterator.call(stream)) {
        if (event?.type === 'message_start' && event.message?.usage) {
          Object.assign(usage, event.message.usage);
        } else if (event?.type === 'message_delta' && event.usage) {
          for (const [key, value] of Object.entries(event.usage)) {
            if (value != null) usage[key] = value;
          }
        } else if (event?.type === 'message_stop') {
          completed = true;
        }
        yield event;
      }
    } catch (err) {
      failure = err;
      throw err;
    } finally {
      if (!logged) {
        logged = true;
        if (completed) logUsage(usage, false, null);
        else logUsage(usage, true, failure ? errorTypeOf(failure) : 'stream_incomplete', true);
      }
    }
  };
}

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
        const err = new Error(`AI daily budget exceeded ($${getDailySpend().toFixed(2)} / $${DAILY_BUDGET}). Call blocked.`);
        err.status = 429;
        console.error(`[AI Cost] BLOCKED ${routeName} — budget exceeded`);
        return Promise.reject(err);
      }
    }

    // `charged` is false only for calls that failed before any tokens were
    // billed; an interrupted stream is an error that still used tokens.
    const logUsage = (usage, isError, errorType, charged = !isError) => {
      const duration = Date.now() - startTime;
      const cost = charged ? calculateCost(model, usage) : 0;

      // Track daily spend for budget limiter
      // Once the row below is written, a later read of the log counts it instead.
      const markPersisted = charged && cost > 0 ? recordSpend(cost) : null;

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
            }).then(() => {
              if (markPersisted) markPersisted();
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
      (response) => {
        // A streamed call resolves to a Stream with no usage yet; its row is
        // written once, when the stream ends (see trackStreamUsage).
        if (params?.stream && response && typeof response.iterator === 'function') {
          trackStreamUsage(response, logUsage);
          return;
        }
        logUsage(response?.usage || {}, false, null);
      },
      (err) => logUsage({}, true, errorTypeOf(err)),
    );

    return result;
  };

  patchApplied = true;
  // Load today's spend once models are available (they may load after this file).
  setImmediate(() => { refreshIfStale(); });
  console.log('💰 AI cost tracking enabled — all Anthropic API calls will be logged');
}

// Auto-apply on require
applyPatch();

module.exports = { calculateCost, MODEL_PRICING, getDailySpend, DAILY_BUDGET, SPEND_CACHE_MS, refreshSpend };
