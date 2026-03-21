// ════════════════════════════════════════════════════════════════════════════
// SEASON RHYTHM ROUTES — v1.1
// Mount at: /api/v1/season-rhythm
// ════════════════════════════════════════════════════════════════════════════

const express = require('express');
const seasonRhythmRouter = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { validateRhythm, getArcHealthSummary } = require('../services/seasonRhythmValidator');

/**
 * POST /api/v1/season-rhythm/validate
 * Body: { showId, episodeNumber, proposedOutcome, proposedIntent }
 * proposedOutcome: 'slay' | 'pass' | 'safe' | 'fail' (case-insensitive)
 */
seasonRhythmRouter.post('/validate', optionalAuth, async (req, res) => {
  try {
    const { showId, episodeNumber, proposedOutcome, proposedIntent } = req.body;

    if (!showId || !episodeNumber || !proposedOutcome) {
      return res.status(400).json({
        error: 'showId, episodeNumber, and proposedOutcome are required',
      });
    }

    const validOutcomes = ['slay', 'pass', 'safe', 'fail'];
    if (!validOutcomes.includes(proposedOutcome.toLowerCase())) {
      return res.status(400).json({
        error: `proposedOutcome must be one of: ${validOutcomes.join(', ')}`,
      });
    }

    const result = await validateRhythm(
      showId,
      parseInt(episodeNumber, 10),
      proposedOutcome,
      proposedIntent || proposedOutcome
    );

    return res.json(result);
  } catch (err) {
    console.error('[SeasonRhythm] validate error:', err);
    return res.status(500).json({ error: 'Rhythm validation failed', detail: err.message });
  }
});

/**
 * GET /api/v1/season-rhythm/arc-health/:showId/:episodeNumber
 */
seasonRhythmRouter.get('/arc-health/:showId/:episodeNumber', optionalAuth, async (req, res) => {
  try {
    const health = await getArcHealthSummary(
      req.params.showId,
      parseInt(req.params.episodeNumber, 10)
    );
    return res.json(health);
  } catch (err) {
    console.error('[SeasonRhythm] arc-health error:', err);
    return res.status(500).json({ error: 'Arc health check failed', detail: err.message });
  }
});

/**
 * GET /api/v1/season-rhythm/season-health/:showId
 */
seasonRhythmRouter.get('/season-health/:showId', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { Episode } = require('../models');
    const { Op } = require('sequelize');
    const { ARC_SIZE, TARGET_DISTRIBUTION } = require('../services/seasonRhythmValidator');

    const allEpisodes = await Episode.findAll({
      where: {
        show_id: showId,
        evaluation_status: 'accepted',
        evaluation_json: { [Op.ne]: null },
      },
      order: [['episode_number', 'ASC']],
      attributes: ['episode_number', 'evaluation_json'],
    });

    const mapped = allEpisodes
      .map(ep => ({
        episode_number: ep.episode_number,
        tier_final: ep.evaluation_json?.tier_final?.toLowerCase(),
      }))
      .filter(ep => ep.tier_final);

    const arcs = [1, 2, 3].map(arcNum => {
      const arcStart = (arcNum - 1) * ARC_SIZE + 1;
      const arcEnd = arcStart + ARC_SIZE - 1;
      const arcEps = mapped.filter(
        ep => ep.episode_number >= arcStart && ep.episode_number <= arcEnd
      );

      const dist = arcEps.reduce((acc, ep) => {
        acc[ep.tier_final] = (acc[ep.tier_final] || 0) + 1;
        return acc;
      }, { slay: 0, pass: 0, safe: 0, fail: 0 });

      let score = 100;
      for (const [outcome, target] of Object.entries(TARGET_DISTRIBUTION)) {
        score -= Math.abs((dist[outcome] || 0) - target) * 12;
      }
      score = Math.max(0, Math.min(100, score));

      return {
        arcNumber: arcNum,
        theme: ['The Rise', 'The Pressure', 'The Legacy Move'][arcNum - 1],
        episodes: `${arcStart}–${arcEnd}`,
        completed: arcEps.length,
        remaining: ARC_SIZE - arcEps.length,
        distribution: dist,
        target: TARGET_DISTRIBUTION,
        rhythmScore: score,
        rhythmGrade: score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 55 ? 'AT_RISK' : 'CRITICAL',
        status: arcEps.length === 0 ? 'NOT_STARTED' : arcEps.length === ARC_SIZE ? 'COMPLETE' : 'IN_PROGRESS',
      };
    });

    const avgScore = Math.round(arcs.reduce((s, a) => s + a.rhythmScore, 0) / 3);

    return res.json({
      showId,
      totalEpisodesAccepted: mapped.length,
      seasonRhythmScore: avgScore,
      seasonGrade: avgScore >= 85 ? 'EXCELLENT' : avgScore >= 70 ? 'GOOD' : avgScore >= 55 ? 'AT_RISK' : 'CRITICAL',
      arcs,
    });
  } catch (err) {
    console.error('[SeasonRhythm] season-health error:', err);
    return res.status(500).json({ error: 'Season health check failed', detail: err.message });
  }
});

module.exports = seasonRhythmRouter;
