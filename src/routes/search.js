/**
 * Search Routes
 * Phase 4A - Advanced Search Integration Endpoints
 * Provides search capabilities for activities, episodes, suggestions, and audit trails
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

const router = express.Router();

/**
 * GET /api/v1/search
 * Global search across all resources
 * Query params: q (search query), type (resource type filter)
 */
router.get('/', requireAuth, searchController.globalSearch);

/**
 * GET /api/v1/search/activities
 * Search activity logs with advanced filtering
 * Requires authentication
 */
router.get('/activities', requireAuth, searchController.searchActivities);

/**
 * GET /api/v1/search/episodes
 * Search episodes by title, description, or other fields
 * Requires authentication
 */
router.get('/episodes', requireAuth, searchController.searchEpisodes);

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions based on partial query
 * Requires authentication
 */
router.get('/suggestions', requireAuth, searchController.searchSuggestions);

/**
 * GET /api/v1/search/audit-trail/:id
 * Get detailed audit trail for a specific episode
 * Shows all activities related to the episode
 * Requires authentication
 */
router.get('/audit-trail/:id', requireAuth, searchController.getAuditTrail);

/**
 * GET /api/v1/search/stats
 * Get search statistics (activity types, user counts, etc)
 * Requires authentication
 */
router.get('/stats', requireAuth, searchController.getSearchStats);

/**
 * POST /api/v1/search/reindex
 * Reindex all activities (admin only)
 * Requires authentication + admin role
 */
router.post('/reindex', requireAuth, searchController.reindexActivities);

/**
 * GET /api/v1/search/scripts
 * Search episode scripts with full-text search
 * Searches content, notes, version labels, and author names
 * ADMIN only (Evoni, 2026-11-22): each hit carries the first 200 characters
 * of the script's text, and a non-admin account is never sent script text
 * (docs/audit/F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md).
 */
router.get('/scripts', requireAuth, authorize(['ADMIN']), searchController.searchScripts);

/**
 * GET /api/v1/search/history
 * Get user's recent search history
 * Requires authentication
 */
router.get('/history', requireAuth, searchController.getSearchHistory);

/**
 * DELETE /api/v1/search/history
 * Clear user's search history
 * Requires authentication
 */
router.delete('/history', requireAuth, searchController.clearSearchHistory);

module.exports = router;
