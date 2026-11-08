'use strict';

/**
 * Budget decisions and three-amount accounting (M0 decision record section 3;
 * Q1/U2). Pure. Money is integer micro-dollars (1 USD = 1,000,000) so sums
 * are exact and deterministic.
 *
 *   reserved   submissions not yet settled, at their estimate
 *   confirmed  settled and billed, at the confirmed amount
 *   uncertain  outcome unknown, at the estimate; never decays by age
 *   exposure = reserved + confirmed + uncertain; every limit uses exposure.
 */

const VERIFIED_PRICE_STATUSES = new Set(['verified_primary_doc', 'verified_billing_export']);
const TIME_BILLED_UNITS = new Set(['gpu_second', 'video_second']);

const RESERVED_PHASES = new Set(['authorized', 'dispatching', 'accepted', 'provider_succeeded']);

function bucketOf(row) {
  if (RESERVED_PHASES.has(row.phase)) return 'reserved';
  if (row.phase === 'unknown') return 'uncertain';
  if (row.phase === 'abandoned') return row.billed === 'no' ? 'released' : (row.billed === 'yes' ? 'confirmed' : 'uncertain');
  if (row.phase === 'succeeded' || row.phase === 'failed_confirmed') {
    if (row.billed === 'yes') return 'confirmed';
    if (row.billed === 'no') return 'released';
    return 'uncertain';
  }
  return 'released'; // not_sent
}

function amountOf(row, bucket) {
  if (bucket === 'released') return 0;
  if (bucket === 'confirmed' && Number.isInteger(row.confirmedMicros)) return row.confirmedMicros;
  return row.estimateMicros || 0;
}

function exposureOf(rows) {
  const out = { reserved: 0, confirmed: 0, uncertain: 0, exposure: 0 };
  for (const row of rows) {
    const bucket = bucketOf(row);
    if (bucket === 'released') continue;
    out[bucket] += amountOf(row, bucket);
  }
  out.exposure = out.reserved + out.confirmed + out.uncertain;
  return out;
}

/**
 * Decide whether a new submission may be authorized.
 *   { estimateMicros, strict, price, service, dayExposureMicros,
 *     imageDayExposureMicros, caps: { dailyMicros, imageDailyMicros } }
 * Returns { ok: true, unpriced } or { ok: false, code }.
 */
function checkAuthorization(p = {}) {
  const est = p.estimateMicros;
  if (p.strict) {
    if (!p.price || !VERIFIED_PRICE_STATUSES.has(p.price.status)) return { ok: false, code: 'PRICE_NOT_VERIFIED' };
    if (TIME_BILLED_UNITS.has(p.price.unit) && !(Number.isInteger(p.price.maxUnitsPerRequest) && p.price.maxUnitsPerRequest > 0)) {
      return { ok: false, code: 'PRICE_NO_MAX_UNITS' };
    }
    if (!Number.isInteger(est) || est < 0) return { ok: false, code: 'ESTIMATE_REQUIRED' };
  }
  if (est != null && (!Number.isInteger(est) || est < 0)) return { ok: false, code: 'ESTIMATE_INVALID' };
  const add = est || 0;
  const caps = p.caps || {};
  if (!Number.isInteger(caps.dailyMicros)) return { ok: false, code: 'CAP_UNAVAILABLE' };
  if ((p.dayExposureMicros || 0) + add > caps.dailyMicros) return { ok: false, code: 'DAILY_CAP' };
  if (p.service === 'images') {
    if (!Number.isInteger(caps.imageDailyMicros)) return { ok: false, code: 'CAP_UNAVAILABLE' };
    if ((p.imageDayExposureMicros || 0) + add > caps.imageDailyMicros) return { ok: false, code: 'IMAGE_DAILY_CAP' };
  }
  return { ok: true, unpriced: est == null };
}

module.exports = { exposureOf, bucketOf, checkAuthorization, VERIFIED_PRICE_STATUSES };
