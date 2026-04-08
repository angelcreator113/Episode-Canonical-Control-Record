'use strict';

/**
 * promptCacheHelper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility for Anthropic prompt caching. Formats system prompts with
 * cache_control to reduce input costs by ~90% on repeated calls.
 *
 * Usage:
 *   const { withCaching, formatSystemPrompt } = require('./promptCacheHelper');
 *
 *   // Option 1: Format system prompt for caching
 *   const response = await client.messages.create({
 *     model: 'claude-sonnet-4-6',
 *     system: formatSystemPrompt(systemPromptText),
 *     messages: [...]
 *   });
 *
 *   // Option 2: Easy wrapper for entire request
 *   const response = await client.messages.create(
 *     withCaching({
 *       model: 'claude-sonnet-4-6',
 *       system: systemPromptText,
 *       messages: [...]
 *     })
 *   );
 *
 * Note: Caching is most effective for:
 * - System prompts > 1024 tokens (Anthropic minimum for caching)
 * - Repeated prompts within a 5-minute window
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Format a system prompt string as a cacheable content block.
 * @param {string} systemPrompt - The system prompt text
 * @returns {Array<object>} Content blocks with cache_control
 */
function formatSystemPrompt(systemPrompt) {
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return undefined;
  }
  return [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/**
 * Format multiple content blocks with caching on the last (largest) block.
 * Useful when you have a base system prompt + character context.
 * @param {string[]} blocks - Array of text blocks
 * @returns {Array<object>} Content blocks, with cache_control on last block
 */
function formatMultiBlockSystem(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return undefined;
  }
  return blocks.map((text, idx) => ({
    type: 'text',
    text: text,
    // Cache the last block (typically the largest/most stable)
    ...(idx === blocks.length - 1 && { cache_control: { type: 'ephemeral' } }),
  }));
}

/**
 * Wrap a messages.create params object to add caching to system prompt.
 * @param {object} params - The parameters for messages.create
 * @returns {object} Modified params with cached system prompt
 */
function withCaching(params) {
  if (!params.system || typeof params.system !== 'string') {
    return params;
  }
  return {
    ...params,
    system: formatSystemPrompt(params.system),
  };
}

/**
 * Estimate whether a prompt is worth caching (> 1024 tokens rough estimate).
 * Caching has overhead, so very short prompts may not benefit.
 * @param {string} text - The text to check
 * @returns {boolean} True if the text is long enough to benefit from caching
 */
function isWorthCaching(text) {
  if (!text) return false;
  // Rough estimate: 1 token ≈ 4 characters
  // Anthropic minimum for caching is 1024 tokens
  const estimatedTokens = Math.ceil(text.length / 4);
  return estimatedTokens >= 1024;
}

/**
 * Create a cached system prompt only if it's worth caching.
 * Falls back to plain string for short prompts.
 * @param {string} systemPrompt - The system prompt text
 * @returns {string|Array<object>} Either the original string or cached format
 */
function smartCacheSystemPrompt(systemPrompt) {
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return systemPrompt;
  }
  return isWorthCaching(systemPrompt)
    ? formatSystemPrompt(systemPrompt)
    : systemPrompt;
}

module.exports = {
  formatSystemPrompt,
  formatMultiBlockSystem,
  withCaching,
  isWorthCaching,
  smartCacheSystemPrompt,
};
