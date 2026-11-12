'use strict';

/**
 * anthropicClient.js: the one place Anthropic SDK clients are built
 * (AI egress gateway, G3 milestone P0a).
 *
 * WHAT THIS IS
 *   A routing seam. Every caller that needs a client calls
 *   createAnthropicClient(options) instead of `new Anthropic(options)`, so a
 *   later, separately approved change can route all of them through the AI
 *   egress gateway by editing this file alone.
 *
 * WHAT THIS IS NOT
 *   It is NOT gateway enforcement. It adds no base URL, no transport, no
 *   permit, no retry policy and no model policy, and it does not consult the
 *   emergency Stop or the gateway ledger. A client built here behaves exactly
 *   like one built with `new Anthropic(options)`:
 *     - options are passed through unchanged (maxRetries, timeout, apiKey ...);
 *     - with no options the SDK reads ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL
 *       itself, when the client is constructed, as it does today;
 *     - SDK defaults are kept (maxRetries 2, so up to 3 requests per call;
 *       10-minute timeout);
 *     - the client is an instance of the same SDK class, so the
 *       Messages.prototype.create patch in aiCostTracker (budget gate and
 *       usage log) and the aiResponseCache wrapper still apply.
 *   Client lifetimes stay with the caller: this returns a new client on every
 *   call and keeps none.
 *
 * NO SIDE EFFECTS ON LOAD
 *   Requiring this module builds no client, reads no environment variable,
 *   starts no timer and opens nothing. Its only dependency is the SDK, so it
 *   cannot form a require cycle with application code.
 *
 * JEST
 *   The SDK module is resolved when a client is built, not when this module
 *   loads, so jest.mock('@anthropic-ai/sdk', ...) and jest.doMock in
 *   isolateModules apply to clients built here exactly as they do to a
 *   caller's own `new Anthropic()`. When the module export is a function (the
 *   real SDK, and every mock in tests/), it is the constructor, as at the 138
 *   call sites that use `require('@anthropic-ai/sdk')` directly; otherwise its
 *   `default` (or `Anthropic`) export is.
 *
 * Exempt from the direct-construction guard
 * (tests/unit/guards/anthropicDirectConstruction.test.js) together with
 * aiCostTracker and aiResponseCache, which reach the SDK prototype themselves.
 */

function sdkConstructor() {
  // eslint-disable-next-line global-require
  const sdk = require('@anthropic-ai/sdk');
  const Ctor = typeof sdk === 'function' ? sdk : (sdk && (sdk.default || sdk.Anthropic));
  if (typeof Ctor !== 'function') throw new TypeError('anthropicClient: @anthropic-ai/sdk exports no client constructor');
  return Ctor;
}

/**
 * Build an Anthropic client. `options` go to the SDK constructor unchanged;
 * omitting them is the same as `new Anthropic()`.
 */
function createAnthropicClient(options) {
  const Anthropic = sdkConstructor();
  return options === undefined ? new Anthropic() : new Anthropic(options);
}

module.exports = { createAnthropicClient };
