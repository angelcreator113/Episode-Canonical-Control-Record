/**
 * aiResponseCache.js — Redis-backed AI response cache
 *
 * HOW IT WORKS:
 *   Monkey-patches Anthropic SDK's Messages.create() (after aiCostTracker)
 *   to cache responses for identical (model + system + messages) inputs.
 *
 *   Cache hits skip the API call entirely → $0.00 cost.
 *
 * CACHE KEY:
 *   SHA-256 of JSON.stringify({ model, system, messages, max_tokens })
 *   Temperature > 0 calls are NOT cached (creative/varied output expected).
 *
 * TTL STRATEGY:
 *   - Classification/JSON tasks (max_tokens <= 500): 24 hours
 *   - Medium tasks (max_tokens <= 2000): 4 hours
 *   - Large generation tasks: 1 hour
 *   - Override with AI_CACHE_TTL_SECONDS env var
 *
 * USAGE:
 *   require('./services/aiResponseCache');
 *   Called AFTER aiCostTracker in server.js startup.
 *
 * DISABLE:
 *   Set AI_CACHE_ENABLED=false to bypass entirely.
 */

/* eslint-disable no-console */

const crypto = require('crypto');

// ── Configuration ──────────────────────────────────────────────────────────
const CACHE_ENABLED = process.env.AI_CACHE_ENABLED !== 'false'; // on by default
const DEFAULT_TTL   = parseInt(process.env.AI_CACHE_TTL_SECONDS, 10) || 0; // 0 = auto

// Stats for monitoring
const stats = { hits: 0, misses: 0, errors: 0, bypassed: 0 };
function getCacheStats() { return { ...stats }; }

// ── TTL selection ──────────────────────────────────────────────────────────
function getTTL(params) {
  if (DEFAULT_TTL > 0) return DEFAULT_TTL;
  const maxTokens = params?.max_tokens || 4096;
  if (maxTokens <= 500)  return 86400;  // 24h — small classification tasks
  if (maxTokens <= 2000) return 14400;  // 4h  — medium tasks
  return 3600;                           // 1h  — large generation
}

// ── Cache key generation ────────────────────────────────────────────────────
function buildCacheKey(params) {
  // Normalize system prompt format (string vs array of content blocks)
  let systemNorm = params.system || '';
  if (Array.isArray(systemNorm)) {
    systemNorm = systemNorm.map(b => b.text || JSON.stringify(b)).join('||');
  }
  const payload = JSON.stringify({
    model: params.model,
    system: systemNorm,
    messages: params.messages,
    max_tokens: params.max_tokens,
  });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `ai:resp:${hash}`;
}

// ── Should this call be cached? ─────────────────────────────────────────────
function shouldCache(params) {
  // Don't cache streaming calls (handled separately by stream())
  if (params?.stream) return false;
  // Don't cache high-temperature calls (creative/varied output)
  if (params?.temperature && params.temperature > 0.3) return false;
  // Don't cache if explicitly disabled per-call
  if (params?._noCache) return false;
  return true;
}

// ── Redis client (lazy init) ────────────────────────────────────────────────
let redisClient = null;
let redisAvailable = false;

async function getRedis() {
  if (redisClient) return redisAvailable ? redisClient : null;
  try {
    const { getRedisClient, testRedisConnection } = require('../config/redis');
    redisClient = getRedisClient();
    redisAvailable = await testRedisConnection();
    if (redisAvailable) {
      console.log('🗄️  AI response cache connected to Redis');
    }
    return redisAvailable ? redisClient : null;
  } catch {
    redisAvailable = false;
    return null;
  }
}

// ── Apply the monkey-patch ──────────────────────────────────────────────────
let patchApplied = false;

function applyPatch() {
  if (patchApplied || !CACHE_ENABLED) return;

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch { return; }

  const AnthropicClass = Anthropic.default || Anthropic;
  let MessagesProto;
  try {
    const tempClient = new AnthropicClass({ apiKey: 'temp-for-proto-access' });
    MessagesProto = Object.getPrototypeOf(tempClient.messages);
  } catch { return; }

  if (!MessagesProto || !MessagesProto.create) return;

  // Grab whatever create() currently points to (may already be the cost tracker wrapper)
  const wrappedCreate = MessagesProto.create;

  MessagesProto.create = function cachedCreate(params, ...rest) {
    if (!shouldCache(params)) {
      stats.bypassed++;
      return wrappedCreate.call(this, params, ...rest);
    }

    const cacheKey = buildCacheKey(params);

    // We need to check cache async, but must return an APIPromise-compatible object.
    // Strategy: return a Promise that either resolves from cache or falls through to real call.
    // Since the cost tracker's wrapper already handles APIPromise → Promise conversion,
    // and most non-streaming callers just await the result, a plain Promise works here.
    const cachePromise = (async () => {
      try {
        const redis = await getRedis();
        if (redis) {
          const cached = await redis.get(cacheKey);
          if (cached) {
            stats.hits++;
            const parsed = JSON.parse(cached);
            // Mark as cache hit for cost tracker (it will log $0)
            parsed._fromCache = true;
            return parsed;
          }
        }
      } catch (err) {
        stats.errors++;
        // Cache read failed — fall through to API
      }

      // Cache miss — make the real API call
      stats.misses++;
      const result = await wrappedCreate.call(this, params, ...rest);

      // Store in cache (fire-and-forget)
      try {
        const redis = await getRedis();
        if (redis && result && !result._fromCache) {
          const ttl = getTTL(params);
          // Only cache successful responses with content
          if (result.content && result.content.length > 0) {
            await redis.setEx(cacheKey, ttl, JSON.stringify({
              id: result.id,
              type: result.type,
              role: result.role,
              content: result.content,
              model: result.model,
              stop_reason: result.stop_reason,
              usage: result.usage,
            }));
          }
        }
      } catch {
        // Cache write failed — no big deal
      }

      return result;
    })();

    return cachePromise;
  };

  patchApplied = true;
  console.log('🗄️  AI response cache enabled — identical non-creative calls will be served from Redis');
}

// Auto-apply
applyPatch();

module.exports = { getCacheStats, CACHE_ENABLED };
