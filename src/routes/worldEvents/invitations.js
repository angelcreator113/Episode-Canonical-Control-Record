/**
 * World Events routes — reviewing invitations
 *
 * GET    /api/v1/world/:showId/events/:eventId/invitation-text
 * GET    /api/v1/world/:showId/events/:eventId/invitation
 * POST   /api/v1/world/:showId/events/:eventId/approve-invitation
 * POST   /api/v1/world/:showId/events/:eventId/reject-invitation
 * GET    /api/v1/world/:showId/events/:eventId/invitation-history
 * POST   /api/v1/world/:showId/events/batch-generate-invitations
 * GET    /api/v1/world/:showId/events/:eventId/invitation-print
 * GET    /api/v1/world/:showId/events/:eventId/invitation-pdf
 * POST   /api/v1/world/:showId/events/:eventId/animate-invitation
 * GET    /api/v1/world/:showId/events/:eventId/animate-invitation/:jobId
 * POST   /api/v1/world/:showId/events/:eventId/edit-invitation-text
 * POST   /api/v1/world/:showId/events/:eventId/unlink-invitation
 * DELETE /api/v1/world/:showId/events/:eventId/invitation/:assetId
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { isBudgetError } = require('../../services/imageCostService');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels, invitationService, invitationError, runInvitationWork } = require('./helpers');

// GET /world/:showId/events/:eventId/invitation-text?assetId= — a version's words
// (the approved version's when no assetId)
router.get('/world/:showId/events/:eventId/invitation-text', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    const text = await invitationService().getInvitationText(models, { showId, eventId, assetId: req.query.assetId || null });
    return res.json({ success: true, invitation_text: text });
  } catch (err) {
    return invitationError(res, err, 'GET invitation-text');
  }
});

// re-render-invitation was retired (2026-10-24): it duplicated
// edit-invitation-text, picked the newest asset even when rejected or
// deleted, and had no caller since Task #1654.

router.get('/world/:showId/events/:eventId/invitation', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const event = await loadScopedEvent(models.sequelize, { showId, eventId, columns: 'id, name, invitation_asset_id' });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    let asset = null;
    if (event.invitation_asset_id) {
      [asset] = await models.sequelize.query(
        'SELECT id, s3_url_processed FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1',
        { replacements: { id: event.invitation_asset_id }, type: models.sequelize.QueryTypes.SELECT }
      );
    }

    return res.json({
      data: {
        hasInvitation: !!asset,
        assetId: asset?.id || null,
        imageUrl: asset?.s3_url_processed || null,
        eventName: event.name,
      },
    });
  } catch (err) {
    return invitationError(res, err, 'GET invitation');
  }
});

// ── APPROVE / REJECT ─────────────────────────────────────────────────────────

// POST /world/:showId/events/:eventId/approve-invitation — { assetId }
router.post('/world/:showId/events/:eventId/approve-invitation', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    const r = await invitationService().approveInvitation(models, { showId, eventId, assetId: req.body?.assetId });
    return res.json({
      success: true,
      message: 'Invitation approved and linked to event',
      episodeId: r.episodeId,
      superseded: r.superseded,
      placement_id: r.placementId,
      placement_anchor: r.anchor,
    });
  } catch (err) {
    return invitationError(res, err, 'approve');
  }
});

// POST /world/:showId/events/:eventId/reject-invitation — { assetId } (a pending version)
router.post('/world/:showId/events/:eventId/reject-invitation', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    await invitationService().rejectInvitation(models, { showId, eventId, assetId: req.body?.assetId });
    return res.json({ success: true, message: 'Invitation rejected' });
  } catch (err) {
    return invitationError(res, err, 'reject');
  }
});

// ── INVITATION VERSION HISTORY ───────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/invitation-history', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    const versions = await invitationService().listInvitationVersions(models, { showId, eventId });
    return res.json({ data: versions, count: versions.length });
  } catch (err) {
    return invitationError(res, err, 'history');
  }
});

// ── BATCH GENERATE INVITATIONS ───────────────────────────────────────────────

// POST /world/:showId/events/batch-generate-invitations — { eventIds?, async? }
// At most IMAGE_CALLS_PER_OPERATION events, one after another.
router.post('/world/:showId/events/batch-generate-invitations', requireAuth, aiRateLimiter, (req, res) => {
  const { showId } = req.params;
  const { eventIds } = req.body || {};
  return runInvitationWork(req, res, { kind: 'batch', where: 'batch' }, (models, onProgress) =>
    invitationService().batchGenerateInvitations(models, { showId, eventIds, onProgress }));
});

// ── PRINT EXPORT ─────────────────────────────────────────────────────────────

// GET /world/:showId/events/:eventId/invitation-print — the approved card,
// full quality, with its own words (a PNG). invitation-pdf is the old path,
// kept so saved links work; it never was a PDF.
async function sendInvitationPrint(req, res) {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    const png = await invitationService().exportInvitationPrint(models, { showId, eventId });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="invitation-${eventId}.png"`);
    return res.send(png);
  } catch (err) {
    return invitationError(res, err, 'print export');
  }
}
router.get('/world/:showId/events/:eventId/invitation-print', requireAuth, sendInvitationPrint);
router.get('/world/:showId/events/:eventId/invitation-pdf', requireAuth, sendInvitationPrint);

// ── ANIMATED INVITATION (Runway image_to_video) ─────────────────────────────

router.post('/world/:showId/events/:eventId/animate-invitation', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;

    if (!process.env.RUNWAY_ML_API_KEY) {
      return res.status(503).json({ success: false, error: 'RUNWAY_ML_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Get the approved invitation image
    const event = await loadScopedEvent(models.sequelize, { showId, eventId, columns: 'invitation_asset_id' });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!event.invitation_asset_id) {
      return res.status(400).json({ success: false, error: 'No approved invitation to animate. Generate and approve one first.' });
    }

    const [asset] = await models.sequelize.query(
      'SELECT s3_url_processed FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: event.invitation_asset_id }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset?.s3_url_processed) {
      return res.status(404).json({ success: false, error: 'Invitation asset not found' });
    }

    // Use Runway image_to_video (same pattern as sceneGenerationService)
    const axios = require('axios');
    const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';

    // Budget-gated and logged through imageCostService, as every Runway
    // video call is (sceneGenerationService). Runway has no price in its rate
    // table, so the call is logged unpriced (cost_usd NULL), never a made-up
    // figure (audit Medium, 2026-10-23).
    const { runImageCall } = require('../../services/imageCostService');
    const videoResponse = await runImageCall({ model: 'gen3a_turbo', provider: 'runway' }, () => axios.post(
      `${RUNWAY_API_BASE}/image_to_video`,
      {
        model: 'gen3a_turbo',
        promptText: 'The invitation card materializes with a soft golden shimmer. Subtle light particles drift upward. The card gently floats and settles. Warm ambient glow. No camera movement.',
        promptImage: asset.s3_url_processed,
        duration: 5,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_ML_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
        timeout: 30000,
      }
    ));

    const jobId = videoResponse.data.id;

    return res.json({
      success: true,
      message: 'Animation job queued — poll for completion',
      jobId,
      pollUrl: `/api/v1/world/${req.params.showId}/events/${eventId}/animate-invitation/${jobId}`,
    });
  } catch (err) {
    console.error('[InviteGen] Animation error:', err.response?.data || err.message);
    return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, error: err.message });
  }
});

// ── POLL ANIMATION JOB ──────────────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/animate-invitation/:jobId', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;

    const axios = require('axios');
    const response = await axios.get(
      `https://api.dev.runwayml.com/v1/tasks/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_ML_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
        timeout: 15000,
      }
    );

    const task = response.data;

    if (task.status === 'SUCCEEDED') {
      const outputs = Array.isArray(task.output) ? task.output : [task.output];
      return res.json({ status: 'complete', videoUrl: outputs[0] });
    }
    if (task.status === 'FAILED') {
      return res.json({ status: 'failed', error: task.failure || 'Unknown failure' });
    }
    return res.json({ status: task.status });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── EDIT INVITATION TEXT (no AI, no image call) ──────────────────────────────

// POST /world/:showId/events/:eventId/edit-invitation-text — { assetId, opening, body, closing }
// Her words on that version's background, saved as a new pending version
// (the source, approved or not, is never changed). The money check comes
// back so the page can say when the words no longer state the terms.
router.post('/world/:showId/events/:eventId/edit-invitation-text', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    const { assetId, opening, body, closing } = req.body || {};
    const version = await invitationService().editInvitationText(models, { showId, eventId, assetId, opening, body, closing });
    return res.json({
      success: true,
      imageUrl: version.imageUrl,
      assetId: version.assetId,
      version: version.version,
      moneyCheck: version.moneyCheck,
      message: 'Saved as a new version for your approval.',
    });
  } catch (err) {
    return invitationError(res, err, 'edit text');
  }
});

// ── UNLINK INVITATION FROM EPISODE ───────────────────────────────────────────

router.post('/world/:showId/events/:eventId/unlink-invitation', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    await invitationService().unlinkInvitation(models, { showId, eventId, assetId: req.body?.assetId });
    return res.json({ success: true, message: 'Invitation unlinked from episode. Asset remains in show library.' });
  } catch (err) {
    return invitationError(res, err, 'unlink');
  }
});

// ── DELETE INVITATION VERSION ────────────────────────────────────────────────

router.delete('/world/:showId/events/:eventId/invitation/:assetId', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId, assetId } = req.params;
    const r = await invitationService().deleteInvitationVersion(models, { showId, eventId, assetId });
    return res.json({ success: true, wasCurrent: r.wasCurrent, message: 'Invitation deleted from system.' });
  } catch (err) {
    return invitationError(res, err, 'delete');
  }
});

module.exports = router;
