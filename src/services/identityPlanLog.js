'use strict';

/**
 * The identity plan of a script write, logged as counts only (A1c R1, Evoni,
 * 2026-10-27; docs/reads/2026-10-27-a1c-r1-spec.md, design R4.2). R1 stores
 * no line identities; after each write this logs how many lines the strict
 * rules (utils/lineKeys.js planLineIdentity) would keep, move, leave
 * uncertain, add or remove, so the policy can be checked against real edits
 * before identities are switched on (R3).
 *
 * The line is counts and ids only: never script text, dialogue, beat or line
 * labels, line hashes, keys, character or event names. It never throws and
 * never affects the write it describes.
 *
 * On by default; SCRIPT_IDENTITY_PLAN_LOG=off (or 0, false, no) turns it off
 * without a deploy of code.
 */

const { planLineIdentity } = require('../utils/lineKeys');

const PREFIX = '[line-identity-plan]';

/** Whether the plan is logged (SCRIPT_IDENTITY_PLAN_LOG; on unless set to off, 0, false or no). */
function planLogEnabled(env = process.env) {
  return !/^(off|0|false|no)$/i.test(String(env.SCRIPT_IDENTITY_PLAN_LOG ?? '').trim());
}

/** The log line for a write, or null when there is nothing to describe. */
function identityPlanLine({ episodeId, writer, source, state, prevText, nextText, now = Date.now }) {
  const started = now();
  const { counts } = planLineIdentity(typeof prevText === 'string' ? prevText : '', typeof nextText === 'string' ? nextText : '');
  return {
    v: 1,
    episode: String(episodeId),
    writer: String(writer || 'unknown'),
    source: String(source || 'save'),
    state: String(state || 'unkeyed'),
    ...counts,
    ms: now() - started,
  };
}

function logIdentityPlan(args, log = console.log, env = process.env) {
  try {
    if (!planLogEnabled(env)) return null;
    if (typeof args?.prevText === 'string' && typeof args?.nextText === 'string' && args.prevText === args.nextText) return null;
    const line = identityPlanLine(args);
    log(`${PREFIX} ${JSON.stringify(line)}`);
    return line;
  } catch (err) {
    // The message only: an error from the plan could quote the script.
    console.error(`${PREFIX} could not be computed (the write is unaffected): ${err?.name || 'Error'}`);
    return null;
  }
}

module.exports = { logIdentityPlan, identityPlanLine, planLogEnabled, PREFIX };
