/**
 * Season Rhythm Validator — v1.1 (field-corrected)
 *
 * Reads outcome from evaluation_json.tier_final (JSONB)
 * Reads score from evaluation_json.score (JSONB)
 * Filters accepted episodes via evaluation_status = 'accepted'
 *
 * Healthy rhythm per 8-episode arc:
 *   SLAY: 1 major win
 *   PASS: 4 wins
 *   SAFE: 2 moderate setbacks
 *   FAIL: 1 real failure
 */

const { Episode } = require('../models');
const { Op } = require('sequelize');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ARC_SIZE = 8;

const TARGET_DISTRIBUTION = {
  slay: 1,
  pass: 4,
  safe: 2,
  fail: 1,
};

const OUTCOME_WEIGHT = {
  slay: 4,
  pass: 3,
  safe: 2,
  fail: 1,
};

const SEVERITY = {
  BLOCK:   'BLOCK',
  WARN:    'WARN',
  SUGGEST: 'SUGGEST',
};

// ─── MAIN VALIDATOR ───────────────────────────────────────────────────────────

/**
 * Validate a proposed episode outcome against season rhythm rules.
 *
 * @param {string} showId
 * @param {number} episodeNumber
 * @param {string} proposedOutcome - slay | pass | safe | fail (lowercase)
 * @param {string} proposedIntent
 * @returns {object} { valid, severity, violations, suggestions, arcHealth }
 */
async function validateRhythm(showId, episodeNumber, proposedOutcome, proposedIntent) {
  const normalizedOutcome = proposedOutcome.toLowerCase();

  // Load all accepted episodes for this show, reading tier_final from JSONB
  // evaluation_status = 'accepted' means stat changes have been applied
  const acceptedEpisodes = await Episode.findAll({
    where: {
      show_id: showId,
      evaluation_status: 'accepted',
      // Ensure evaluation_json exists and has a tier_final
      evaluation_json: { [Op.ne]: null },
    },
    order: [['episode_number', 'ASC']],
    attributes: ['id', 'episode_number', 'evaluation_json'],
  });

  // Extract tier_final and score from JSONB for each episode
  const episodesWithResults = acceptedEpisodes
    .map(ep => ({
      episode_number: ep.episode_number,
      tier_final: ep.evaluation_json?.tier_final?.toLowerCase() || null,
      score: parseFloat(ep.evaluation_json?.score) || 0,
      event_prestige: ep.evaluation_json?.breakdown?.event_prestige || null,
    }))
    .filter(ep => ep.tier_final && ['slay', 'pass', 'safe', 'fail'].includes(ep.tier_final));

  const violations = [];
  const suggestions = [];

  // Determine arc position
  const arcIndex = Math.floor((episodeNumber - 1) / ARC_SIZE);
  const positionInArc = ((episodeNumber - 1) % ARC_SIZE) + 1;
  const arcStart = arcIndex * ARC_SIZE + 1;
  const arcEnd = arcStart + ARC_SIZE - 1;

  // Episodes in current arc already accepted
  const arcEpisodes = episodesWithResults.filter(
    ep => ep.episode_number >= arcStart && ep.episode_number < episodeNumber
  );

  // ── CHECK 1: Distribution balance ────────────────────────────────────────
  const currentDist = countDistribution(arcEpisodes);
  const projectedDist = { ...currentDist };
  projectedDist[normalizedOutcome] = (projectedDist[normalizedOutcome] || 0) + 1;

  const remainingEpisodes = arcEnd - episodeNumber;
  const distViolations = checkDistributionFeasibility(
    projectedDist,
    remainingEpisodes,
    TARGET_DISTRIBUTION,
    positionInArc
  );
  violations.push(...distViolations);

  // ── CHECK 2: Consecutive same outcome ────────────────────────────────────
  const recentOutcomes = arcEpisodes.slice(-2).map(ep => ep.tier_final);

  if (recentOutcomes.length === 2 &&
      recentOutcomes.every(r => r === normalizedOutcome) &&
      normalizedOutcome !== 'pass') {
    violations.push({
      severity: SEVERITY.BLOCK,
      code: 'CONSECUTIVE_SAME_OUTCOME',
      message: `3 consecutive ${normalizedOutcome.toUpperCase()} episodes breaks rhythm. The arc needs contrast here.`,
      detail: `Last 2: ${recentOutcomes.join(', ')}. Proposed: ${normalizedOutcome}.`,
    });
  }

  if (recentOutcomes.length === 2 &&
      recentOutcomes.every(r => r === 'pass') &&
      normalizedOutcome === 'pass') {
    violations.push({
      severity: SEVERITY.WARN,
      code: 'CONSECUTIVE_PASS_PLATEAU',
      message: `3 consecutive PASS episodes creates a plateau. Consider SLAY or SAFE for contrast.`,
      detail: 'Monotonous wins reduce emotional stakes.',
    });
  }

  // ── CHECK 3: FAIL missing late in arc ────────────────────────────────────
  const arcHasFail = (currentDist.fail || 0) > 0;
  if (!arcHasFail && positionInArc >= 5 && normalizedOutcome !== 'fail') {
    const episodesLeft = ARC_SIZE - positionInArc;
    if (episodesLeft <= 2) {
      violations.push({
        severity: SEVERITY.BLOCK,
        code: 'FAIL_MISSING_LATE_ARC',
        message: `Arc requires 1 real FAIL by episode ${arcEnd}. Only ${episodesLeft} episodes remain after this one.`,
        detail: 'Franchise law: 1 real failure per 8-episode arc. This arc has none yet.',
      });
    } else {
      violations.push({
        severity: SEVERITY.WARN,
        code: 'FAIL_PENDING',
        message: `Arc has no FAIL yet. ${episodesLeft} episodes remain to deliver it.`,
        detail: 'Plan your failure episode deliberately — it should not feel accidental.',
      });
    }
  }

  // ── CHECK 4: SLAY too early ───────────────────────────────────────────────
  if (normalizedOutcome === 'slay' && positionInArc < 4) {
    violations.push({
      severity: SEVERITY.WARN,
      code: 'SLAY_TOO_EARLY',
      message: `SLAY in position ${positionInArc}/8 is too early. Major wins land in second half of arc.`,
      detail: 'Early SLAY removes stakes. Save it for positions 6-8.',
    });
  }

  // ── CHECK 5: Consecutive FAIL ─────────────────────────────────────────────
  const lastOutcome = arcEpisodes.length > 0
    ? arcEpisodes[arcEpisodes.length - 1].tier_final
    : null;

  if (lastOutcome === 'fail' && normalizedOutcome === 'fail') {
    if ((currentDist.fail || 0) >= TARGET_DISTRIBUTION.fail) {
      violations.push({
        severity: SEVERITY.BLOCK,
        code: 'EXCESS_FAIL',
        message: `Arc already has ${currentDist.fail} FAIL episode(s). Target is ${TARGET_DISTRIBUTION.fail}. Second consecutive FAIL violates franchise rhythm.`,
        detail: 'Lala needs a recovery beat after failure.',
      });
    } else {
      violations.push({
        severity: SEVERITY.WARN,
        code: 'CONSECUTIVE_FAIL',
        message: `Consecutive FAIL episodes risk audience detachment. Is this intentional crisis design?`,
        detail: 'If yes, ensure Episode Brief has explicit recovery hook seeded.',
      });
    }
  }

  // ── CHECK 6: Emotional contrast ───────────────────────────────────────────
  if (lastOutcome && normalizedOutcome) {
    const lastWeight = OUTCOME_WEIGHT[lastOutcome] || 2;
    const proposedWeight = OUTCOME_WEIGHT[normalizedOutcome] || 2;

    if (Math.abs(lastWeight - proposedWeight) === 0 && arcEpisodes.length > 1) {
      const twoBack = arcEpisodes[arcEpisodes.length - 2]?.tier_final;
      if (twoBack && OUTCOME_WEIGHT[twoBack] === proposedWeight) {
        suggestions.push({
          severity: SEVERITY.SUGGEST,
          code: 'LOW_CONTRAST_RUN',
          message: `3 episodes at similar emotional weight. Consider raising or lowering the stakes.`,
        });
      }
    }
  }

  // ── BUILD RESULT ──────────────────────────────────────────────────────────
  const blockingViolations = violations.filter(v => v.severity === SEVERITY.BLOCK);
  const warningViolations  = violations.filter(v => v.severity === SEVERITY.WARN);

  const arcHealth = buildArcHealth(
    currentDist,
    projectedDist,
    arcEpisodes.length + 1,
    ARC_SIZE,
    arcIndex + 1
  );

  return {
    valid: blockingViolations.length === 0,
    severity: blockingViolations.length > 0 ? SEVERITY.BLOCK
            : warningViolations.length > 0  ? SEVERITY.WARN
            : SEVERITY.SUGGEST,
    violations: [...blockingViolations, ...warningViolations],
    suggestions,
    arcHealth,
    meta: {
      arcNumber: arcIndex + 1,
      positionInArc,
      arcStart,
      arcEnd,
      episodesCompleted: arcEpisodes.length,
      proposedOutcome: normalizedOutcome,
      proposedIntent,
    },
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function countDistribution(episodes) {
  return episodes.reduce((acc, ep) => {
    const t = ep.tier_final;
    if (t) acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, { slay: 0, pass: 0, safe: 0, fail: 0 });
}

function checkDistributionFeasibility(projected, remaining, target, positionInArc) {
  const violations = [];

  for (const [outcome, targetCount] of Object.entries(target)) {
    const current = projected[outcome] || 0;
    const deficit = targetCount - current;

    if (deficit > remaining) {
      violations.push({
        severity: SEVERITY.BLOCK,
        code: `DISTRIBUTION_INFEASIBLE_${outcome.toUpperCase()}`,
        message: `Arc needs ${targetCount} ${outcome.toUpperCase()} episode(s). At ${current} with only ${remaining} remaining — mathematically impossible.`,
        detail: `Adjust designed_intent for upcoming episodes.`,
      });
    }

    if (current > targetCount + 1) {
      violations.push({
        severity: SEVERITY.WARN,
        code: `DISTRIBUTION_EXCEEDED_${outcome.toUpperCase()}`,
        message: `Arc has ${current} ${outcome.toUpperCase()} episodes. Target is ${targetCount}. Arc is overweight.`,
        detail: `Remaining episodes should avoid ${outcome.toUpperCase()} to rebalance.`,
      });
    }
  }

  return violations;
}

function buildArcHealth(current, projected, completedCount, arcSize, arcNumber) {
  const remaining = arcSize - completedCount;
  const completionPct = Math.round((completedCount / arcSize) * 100);

  let score = 100;
  for (const [outcome, target] of Object.entries(TARGET_DISTRIBUTION)) {
    const proj = projected[outcome] || 0;
    score -= Math.abs(proj - target) * 12;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    arcNumber,
    completedCount,
    remaining,
    completionPct,
    currentDistribution: current,
    projectedDistribution: projected,
    targetDistribution: TARGET_DISTRIBUTION,
    rhythmScore: score,
    rhythmGrade: score >= 85 ? 'EXCELLENT'
               : score >= 70 ? 'GOOD'
               : score >= 55 ? 'AT_RISK'
               : 'CRITICAL',
  };
}

async function getArcHealthSummary(showId, episodeNumber) {
  const arcIndex = Math.floor((episodeNumber - 1) / ARC_SIZE);
  const arcStart = arcIndex * ARC_SIZE + 1;

  const arcEpisodes = await Episode.findAll({
    where: {
      show_id: showId,
      episode_number: { [Op.between]: [arcStart, episodeNumber - 1] },
      evaluation_status: 'accepted',
      evaluation_json: { [Op.ne]: null },
    },
    order: [['episode_number', 'ASC']],
    attributes: ['episode_number', 'evaluation_json'],
  });

  const mapped = arcEpisodes
    .map(ep => ({ tier_final: ep.evaluation_json?.tier_final?.toLowerCase() }))
    .filter(ep => ep.tier_final);

  const dist = countDistribution(mapped);
  const health = buildArcHealth(dist, dist, mapped.length, ARC_SIZE, arcIndex + 1);

  return {
    ...health,
    suggestedNextOutcome: suggestNextOutcome(dist, mapped.length, ARC_SIZE),
  };
}

function suggestNextOutcome(dist, completed, arcSize) {
  const remaining = arcSize - completed;
  if (remaining <= 0) return null;

  const deficits = Object.entries(TARGET_DISTRIBUTION).map(([outcome, target]) => ({
    outcome,
    deficit: target - (dist[outcome] || 0),
  }));

  deficits.sort((a, b) => b.deficit - a.deficit);
  const mostNeeded = deficits[0];

  if (mostNeeded.deficit <= 0) return 'ARC_BALANCED';
  return mostNeeded.outcome.toUpperCase();
}

module.exports = {
  validateRhythm,
  getArcHealthSummary,
  suggestNextOutcome,
  TARGET_DISTRIBUTION,
  ARC_SIZE,
};
