/**
 * Search Routes
 * Phase 4A - Advanced Search Integration Endpoints
 * Provides search capabilities for activities, episodes, suggestions, and audit trails
 */
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

const router = express.Router();

/**
 * GET /api/v1/search
 * Global search across all resources
 * Query params: q (search query), type (resource type filter)
 */
router.get('/', searchController.globalSearch);

/**
 * GET /api/v1/search/activities
 * Search activity logs with advanced filtering
 * Requires authentication
 */
router.get('/activities', authenticateToken, searchController.searchActivities);

/**
 * GET /api/v1/search/episodes
 * Search episodes by title, description, or other fields
 * Requires authentication
 */
router.get('/episodes', authenticateToken, searchController.searchEpisodes);

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions based on partial query
 * Requires authentication
 */
router.get('/suggestions', authenticateToken, searchController.searchSuggestions);

/**
 * GET /api/v1/search/audit-trail/:id
 * Get detailed audit trail for a specific episode
 * Shows all activities related to the episode
 * Requires authentication
 */
router.get('/audit-trail/:id', authenticateToken, searchController.getAuditTrail);

/**
 * GET /api/v1/search/stats
 * Get search statistics (activity types, user counts, etc)
 * Requires authentication
 */
router.get('/stats', authenticateToken, searchController.getSearchStats);

/**
 * POST /api/v1/search/reindex
 * Reindex all activities (admin only)
 * Requires authentication + admin role
 */
router.post('/reindex', authenticateToken, searchController.reindexActivities);

/**
 * GET /api/v1/search/scripts
 * Search episode scripts with full-text search
 * Searches content, notes, version labels, and author names
 * Requires authentication
 */
router.get('/scripts', authenticateToken, searchController.searchScripts);

/**
 * GET /api/v1/search/history
 * Get user's recent search history
 * Requires authentication
 */
router.get('/history', authenticateToken, searchController.getSearchHistory);

/**
 * DELETE /api/v1/search/history
 * Clear user's search history
 * Requires authentication
 */
router.delete('/history', authenticateToken, searchController.clearSearchHistory);

module.exports = router;
