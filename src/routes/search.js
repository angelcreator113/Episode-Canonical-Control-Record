/**
 * Search Routes
 * Endpoints for searching and filtering episodes
 */
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const searchLogger = require('../middleware/searchLogger');
const searchController = require('../controllers/searchController');

const router = express.Router();

/**
 * GET /api/search
 * Search episodes with filters
 */
router.get('/', authenticateToken, searchLogger, (req, res) => searchController.search(req, res));

/**
 * GET /api/search/filters
 * Get available filters for UI
 */
router.get('/filters', authenticateToken, (req, res) => searchController.getFilters(req, res));

/**
 * GET /api/search/aggregations
 * Get aggregations for advanced filtering
 */
router.get('/aggregations', authenticateToken, (req, res) => searchController.getAggregations(req, res));

/**
 * GET /api/search/suggest
 * Get search suggestions
 */
router.get('/suggest', authenticateToken, (req, res) => searchController.suggest(req, res));

module.exports = router;
