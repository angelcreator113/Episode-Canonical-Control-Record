'use strict';

/**
 * AI egress gateway (G1 decision core): starting limits.
 *
 * These are test and design defaults from the accepted M0 specification
 * (docs/design/2026-11-ai-egress-gateway-m0.md), NOT approved production
 * operating limits. Every consumer receives them through withLimits(), so a
 * caller can pass different values explicitly. Nothing here reads the
 * environment.
 */

const DEFAULT_LIMITS = Object.freeze({
  permitTtlMs: 30_000,
  jsonBodyMax: 1024 * 1024,              // 1 MiB, read in memory
  uploadBodyMax: 25 * 1024 * 1024,       // 25 MiB per multipart upload, spooled
  spoolTotalMax: 1024 * 1024 * 1024,     // 1 GiB of spooled bytes in total
  spoolConcurrency: 4,                   // spooled uploads at once
  bodyReadDeadlineMs: 60_000,            // a slow body cannot hold a slot forever
  stateStaleMs: 3_000,                   // 3 x the 1 s state poll
  emergencyClockSkewMs: 5 * 60_000,      // signed emergency commands: +/- 5 min
  recoveryChallengeTtlMs: 15 * 60_000,   // a RECOVER challenge expires after 15 min
  anchorStaleMs: 3_000,                  // the emergency log's anchor must have been read this recently
});

function withLimits(overrides = {}) {
  const out = { ...DEFAULT_LIMITS };
  for (const [k, v] of Object.entries(overrides || {})) {
    if (!(k in DEFAULT_LIMITS)) throw new Error(`aiGateway: unknown limit "${k}"`);
    if (!Number.isFinite(v) || v < 0) throw new Error(`aiGateway: limit "${k}" must be a non-negative number`);
    out[k] = v;
  }
  return Object.freeze(out);
}

module.exports = { DEFAULT_LIMITS, withLimits };
