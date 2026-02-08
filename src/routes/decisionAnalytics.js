const express = require('express');
const router = express.Router();
const decisionAnalyticsService = require('../services/decisionAnalyticsService');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/decision-analytics/stats
 * Get overall decision statistics
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const stats = await decisionAnalyticsService.getOverallStats(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/decision-analytics/by-type
 * Get decisions grouped by type
 */
router.get('/by-type', optionalAuth, async (req, res) => {
  try {
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const results = await decisionAnalyticsService.getDecisionsByType(filters);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get by type error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/decision-analytics/top-choices/:type
 * Get most frequent choices for a decision type
 */
router.get('/top-choices/:type', optionalAuth, async (req, res) => {
  try {
    const decisionType = req.params.type;
    const limit = parseInt(req.query.limit) || 10;
    
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const results = await decisionAnalyticsService.getTopChoices(
      decisionType,
      limit,
      filters
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get top choices error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/decision-analytics/timeline
 * Get decision timeline (decisions over time)
 */
router.get('/timeline', optionalAuth, async (req, res) => {
  try {
    const interval = req.query.interval || 'day'; // hour, day, week, month
    
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      decision_type: req.query.decision_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const results = await decisionAnalyticsService.getDecisionTimeline(
      interval,
      filters
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/decision-analytics/patterns
 * Detect decision patterns
 */
router.get('/patterns', optionalAuth, async (req, res) => {
  try {
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const patterns = await decisionAnalyticsService.detectPatterns(filters);

    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    console.error('Detect patterns error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/decision-analytics/distribution/:type
 * Get decision value distribution for charts
 */
router.get('/distribution/:type', optionalAuth, async (req, res) => {
  try {
    const decisionType = req.params.type;
    
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const results = await decisionAnalyticsService.getDecisionDistribution(
      decisionType,
      filters
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get distribution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/decision-analytics/export
 * Export decision data for AI training
 */
router.get('/export', optionalAuth, async (req, res) => {
  try {
    const format = req.query.format || 'json'; // json or csv
    
    const filters = {
      user_id: req.query.user_id,
      episode_id: req.query.episode_id,
      decision_type: req.query.decision_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const exportData = await decisionAnalyticsService.exportForTraining(filters);

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(exportData.decisions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=decisions-export.csv');
      res.send(csv);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=decisions-export.json');
      res.json(exportData);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper: Convert to CSV
 */
function convertToCSV(decisions) {
  if (decisions.length === 0) return '';

  const headers = Object.keys(decisions[0]).join(',');
  const rows = decisions.map(d => 
    Object.values(d).map(v => 
      typeof v === 'object' ? JSON.stringify(v) : v
    ).join(',')
  );

  return [headers, ...rows].join('\n');
}

module.exports = router;
