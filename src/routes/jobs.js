/**
 * Job Queue Routes
 * Endpoints for job management
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

/**
 * POST /api/jobs
 * Create and enqueue a new job
 */
router.post('/', requireAuth, (req, res) => jobController.createJob(req, res));

/**
 * GET /api/jobs/:jobId
 * Get job status
 */
router.get('/:jobId', requireAuth, (req, res) => jobController.getJobStatus(req, res));

/**
 * GET /api/jobs
 * List jobs with filtering
 */
router.get('/', requireAuth, (req, res) => jobController.listJobs(req, res));

/**
 * POST /api/jobs/:jobId/retry
 * Retry failed job
 */
router.post('/:jobId/retry', requireAuth, (req, res) => jobController.retryJob(req, res));

/**
 * POST /api/jobs/:jobId/cancel
 * Cancel pending job
 */
router.post('/:jobId/cancel', requireAuth, (req, res) => jobController.cancelJob(req, res));

module.exports = router;
