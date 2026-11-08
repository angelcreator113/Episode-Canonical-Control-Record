'use strict';

/**
 * Provider operation allowlist (M0 design section 5). An upstream request is
 * either a paid `submission` (needs a single-use permit; refused under Stop)
 * or a `status` read for an already-submitted task (allowed under Stop).
 * Anything that does not match an entry here is refused.
 *
 * billingFields(json, params) returns the request characteristics a permit
 * binds (M0 addendum A). It is defined only for JSON bodies; a multipart body
 * is bound by its exact SHA-256 alone.
 *
 * Deliberately absent (so refused): cancellation endpoints, Anthropic
 * count_tokens and batches, Runway remove-background (its existence is
 * unverified, S5), and every unused provider endpoint.
 */

function cacheTtls(json) {
  const ttls = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.cache_control && typeof node.cache_control === 'object') {
      ttls.add(String(node.cache_control.ttl || '5m'));
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') visit(v);
  };
  visit(json);
  return [...ttls].sort();
}

const OPERATIONS = Object.freeze([
  {
    id: 'anthropic.messages', provider: 'anthropic', host: 'api.anthropic.com', service: 'writing',
    cls: 'submission', method: 'POST', path: /^\/v1\/messages$/, bodyKind: 'json',
    billingHeaders: ['anthropic-version', 'anthropic-beta'],
    billingFields: (j) => ({
      model: j.model,
      max_tokens: j.max_tokens,
      stream: j.stream === true,
      service_tier: j.service_tier || null,
      tools: Array.isArray(j.tools) ? j.tools.length : 0,
      cache_ttls: cacheTtls(j),
    }),
  },
  {
    id: 'openai.images.generations', provider: 'openai', host: 'api.openai.com', service: 'images',
    cls: 'submission', method: 'POST', path: /^\/v1\/images\/generations$/, bodyKind: 'json',
    billingFields: (j) => ({ model: j.model, n: j.n == null ? 1 : j.n, size: j.size || null, quality: j.quality || null }),
  },
  {
    id: 'openai.images.edits', provider: 'openai', host: 'api.openai.com', service: 'images',
    cls: 'submission', method: 'POST', path: /^\/v1\/images\/edits$/, bodyKind: 'multipart',
  },
  {
    id: 'fal.run', provider: 'fal', host: 'fal.run', service: 'images',
    cls: 'submission', method: 'POST',
    path: /^\/(fal-ai\/flux\/dev|fal-ai\/flux-pro\/v1\.1|fal-ai\/flux-pro\/kontext)$/, bodyKind: 'json',
    billingFields: (j, p) => ({ model: p[1], num_images: j.num_images == null ? 1 : j.num_images, image_size: j.image_size || null }),
  },
  {
    id: 'runway.image_to_video', provider: 'runway', host: 'api.dev.runwayml.com', service: 'video',
    cls: 'submission', method: 'POST', path: /^\/v1\/image_to_video$/, bodyKind: 'json',
    billingHeaders: ['x-runway-version'],
    billingFields: (j) => ({ model: j.model, duration: j.duration == null ? null : j.duration }),
  },
  {
    id: 'runway.task_status', provider: 'runway', host: 'api.dev.runwayml.com', service: 'video',
    cls: 'status', method: 'GET', path: /^\/v1\/tasks\/([A-Za-z0-9-]{1,128})$/, taskRefGroup: 1,
  },
  {
    id: 'replicate.predictions.create', provider: 'replicate', host: 'api.replicate.com', service: 'images',
    cls: 'submission', method: 'POST', path: /^\/v1\/predictions$/, bodyKind: 'json',
    billingFields: (j) => ({ model: j.version || j.model || null }),
  },
  {
    id: 'replicate.models.predictions.create', provider: 'replicate', host: 'api.replicate.com', service: 'images',
    cls: 'submission', method: 'POST', path: /^\/v1\/models\/([A-Za-z0-9._-]{1,100})\/([A-Za-z0-9._-]{1,100})\/predictions$/, bodyKind: 'json',
    billingFields: (j, p) => ({ model: `${p[1]}/${p[2]}` }),
  },
  {
    id: 'replicate.prediction_status', provider: 'replicate', host: 'api.replicate.com', service: 'images',
    cls: 'status', method: 'GET', path: /^\/v1\/predictions\/([A-Za-z0-9]{1,64})$/, taskRefGroup: 1,
  },
  {
    id: 'elevenlabs.tts', provider: 'elevenlabs', host: 'api.elevenlabs.io', service: 'voice',
    cls: 'submission', method: 'POST', path: /^\/v1\/text-to-speech\/([A-Za-z0-9]{1,64})$/, bodyKind: 'json',
    billingFields: (j, p) => ({
      model: j.model_id || null, voice_id: p[1], characters: typeof j.text === 'string' ? j.text.length : 0,
    }),
  },
  {
    id: 'removebg', provider: 'removebg', host: 'api.remove.bg', service: 'images',
    cls: 'submission', method: 'POST', path: /^\/v1\.0\/removebg$/, bodyKind: 'multipart',
  },
]);

/**
 * Find the operation for an upstream request. A query string is never
 * allowed. Returns { operation, params } or null.
 */
function resolveOperation({ host, method, path } = {}) {
  if (typeof path !== 'string' || path.includes('?') || path.includes('#')) return null;
  const m = String(method || '').toUpperCase();
  for (const op of OPERATIONS) {
    if (op.host !== host || op.method !== m) continue;
    const params = op.path.exec(path);
    if (params) return { operation: op, params };
  }
  return null;
}

function operationById(id) {
  return OPERATIONS.find((op) => op.id === id) || null;
}

module.exports = { OPERATIONS, resolveOperation, operationById, cacheTtls };
