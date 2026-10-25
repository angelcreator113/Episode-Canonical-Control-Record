/**
 * World Events routes — overlays
 *
 * POST   /api/v1/world/:showId/events/:eventId/generate-overlay/:overlayType
 * POST   /api/v1/world/:showId/events/:eventId/approve-overlay
 * POST   /api/v1/world/:showId/events/:eventId/reject-overlay
 * POST   /api/v1/world/:showId/events/:eventId/re-render-overlay
 * GET    /api/v1/world/:showId/events/:eventId/overlay-tasks/:overlayType
 * GET    /api/v1/world/:showId/events/:eventId/overlay-history/:overlayType
 * POST   /api/v1/world/:showId/episodes/:episodeId/generate-title-overlay
 * GET    /api/v1/world/:showId/events/:eventId/overlay-suggestions
 * PUT    /api/v1/world/:showId/events/:eventId/overlay-selections
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
const { eventCreatorOrganizer } = require('../../utils/eventOrganizer');
const { listEventDeliverables } = require('../../services/eventTermsService');
const { withDeliverableTasks } = require('../../utils/socialTaskSource');
const { startedEpisodeFor, readEpisodeSocialTasks, writeEpisodeSocialTasks } = require('../../services/episodeTaskCopyService');

// ═══════════════════════════════════════════════════════════════════════
// OVERLAY APPROVAL WORKFLOW — generate → preview → edit → approve/reject
// Supports: wardrobe (UI.OVERLAY.WARDROBE_LIST), social (UI.OVERLAY.SOCIAL_TASKS)
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/events/:eventId/generate-overlay/:overlayType
router.post('/world/:showId/events/:eventId/generate-overlay/:overlayType', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { sequelize } = models;

    // Load event (include outfit_pieces for wardrobe list)
    const [event] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }

    // Parse outfit_pieces if stored
    let outfitPieces = event.outfit_pieces;
    if (typeof outfitPieces === 'string') {
      try { outfitPieces = JSON.parse(outfitPieces); } catch { outfitPieces = []; }
    }
    if (!Array.isArray(outfitPieces)) outfitPieces = [];

    const { v4: uuidv4 } = require('uuid');
    let tasks, buffer, assetUrl, assetRole, assetName, listType;

    if (overlayType === 'wardrobe') {
      const { renderTodoAsset } = require('../../services/todoListService');

      if (outfitPieces.length > 0) {
        // Build tasks from actual selected wardrobe items
        tasks = outfitPieces.map((piece, i) => ({
          slot: piece.category || piece.clothing_category || 'item',
          label: piece.name || `${piece.category || 'Outfit piece'}`,
          description: [piece.brand, piece.tier ? `${piece.tier} tier` : null, piece.color].filter(Boolean).join(' · ') || 'Selected for this event',
          required: ['dress', 'shoes', 'top', 'bottom'].includes(piece.category || piece.clothing_category),
          completed: !!piece.is_owned,
          order: i + 1,
          wardrobe_id: piece.id,
          image_url: piece.image_url || piece.s3_url_processed || piece.s3_url,
          price: piece.price || 0,
        }));
      } else {
        // No outfit selected — generate AI tasks from event context
        const { generateTasks } = require('../../services/todoListService');
        tasks = await generateTasks(event);
      }

      buffer = renderTodoAsset(tasks, event, { listType: 'wardrobe' });
      assetRole = 'UI.OVERLAY.WARDROBE_LIST';
      assetName = `${event.name} — Wardrobe List`;
      listType = 'wardrobe';
    } else if (overlayType === 'social') {
      const socialChecklistService = require('../../services/socialChecklistService');
      // Get tasks from existing or generate new
      let socialTasks = event.canon_consequences?.automation?.social_tasks || [];
      if (!Array.isArray(socialTasks) || socialTasks.length === 0) {
        try {
          const { buildSocialTasks } = require('../../services/episodeGeneratorService');
          let hostProfile = null;
          const creator = eventCreatorOrganizer(event);
          if (creator) {
            const [rows] = await sequelize.query(
              'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1',
              { replacements: { id: creator.profileId } }
            );
            hostProfile = rows?.[0] || null;
          }
          // T9 (§8(cc); Task #2395): the event row sets the goal count and text.
          socialTasks = buildSocialTasks(event.event_type || 'invite', hostProfile, outfitPieces, { event });
        } catch { socialTasks = []; }
      }
      // T1 (§8(bb); Task #2292): required only from the event's deliverables.
      let deliverables = [];
      try {
        deliverables = await listEventDeliverables(sequelize, event.id);
      } catch (delivErr) {
        console.error('[overlay-generate] Deliverables read failed (no social task is required):', delivErr.message);
      }
      tasks = withDeliverableTasks(socialTasks, deliverables);
      buffer = socialChecklistService.renderSocialChecklist(tasks, event);
      assetRole = 'UI.OVERLAY.SOCIAL_TASKS';
      assetName = `${event.name} — Social Tasks`;
      listType = 'social';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid overlay type. Use "wardrobe" or "social".' });
    }

    // Upload to S3
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const s3 = new S3Client({ region: AWS_REGION });
    const s3Key = `overlays/${eventId}/${overlayType}-${uuidv4()}.png`;

    if (S3_BUCKET && buffer) {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      assetUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    // Count existing versions
    let version = 1;
    try {
      const [versionRows] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM assets WHERE metadata->>'event_id' = :eventId AND asset_role = :assetRole AND deleted_at IS NULL`,
        { replacements: { eventId, assetRole } }
      );
      version = (parseInt(versionRows?.[0]?.cnt) || 0) + 1;
    } catch (vErr) { console.warn('[OverlayGen] Version count error:', vErr.message); }

    // Create Asset — raw SQL to avoid missing column errors
    const assetId = uuidv4();
    const metadataObj = {
      source: `${listType}-overlay-generator`,
      list_type: listType,
      event_id: eventId,
      event_name: event.name,
      task_count: tasks.length,
      version,
      tasks: JSON.stringify(tasks),
      has_outfit_pieces: outfitPieces.length > 0,
      generated_at: new Date().toISOString(),
    };

    try {
      // Try with approval_status first
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, approval_status, metadata, created_at, updated_at)
         VALUES (:id, :name, :assetType, :assetRole, 'EPISODE', 'SHOW', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, 'pending_review', :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId, name: assetName, assetType: overlayType === 'wardrobe' ? 'TODO_LIST' : 'SOCIAL_CHECKLIST',
          assetRole, url: assetUrl, showId, episodeId: event.used_in_episode_id || null,
          metadata: JSON.stringify(metadataObj),
        }}
      );
    } catch (assetErr) {
      // Fallback: insert without approval_status column
      console.warn('[OverlayGen] Asset insert with approval_status failed, retrying without:', assetErr.message);
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
         VALUES (:id, :name, :assetType, :assetRole, 'EPISODE', 'SHOW', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId, name: assetName, assetType: overlayType === 'wardrobe' ? 'TODO_LIST' : 'SOCIAL_CHECKLIST',
          assetRole, url: assetUrl, showId, episodeId: event.used_in_episode_id || null,
          metadata: JSON.stringify(metadataObj),
        }}
      );
    }

    return res.json({
      success: true,
      data: { assetId, imageUrl: assetUrl, tasks, version, hasOutfitPieces: outfitPieces.length > 0 },
      message: outfitPieces.length > 0
        ? `Wardrobe list generated from ${outfitPieces.length} selected pieces — pending approval`
        : `${overlayType} overlay generated — pending approval`,
    });
  } catch (err) {
    console.error(`[OverlayGen] ${req.params.overlayType} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/approve-overlay
router.post('/world/:showId/events/:eventId/approve-overlay', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId required' });

    const models = req.app?.get?.('models') || require('../../models');
    const { sequelize } = models;

    // Load event to get episode link
    const [event] = await sequelize.query(
      'SELECT id, used_in_episode_id, canon_consequences FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Load asset
    const [asset] = await sequelize.query(
      'SELECT id, asset_role, s3_url_processed, metadata FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : (asset.metadata || {});
    const startedEpisode = await startedEpisodeFor(sequelize, eventId);

    // Update asset: approved + link to episode (handle missing approval_status column)
    try {
      await sequelize.query(
        `UPDATE assets SET approval_status = 'approved', asset_scope = 'EPISODE',
         episode_id = :episodeId, updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId, episodeId: event.used_in_episode_id || null } }
      );
    } catch {
      await sequelize.query(
        `UPDATE assets SET asset_scope = 'EPISODE', episode_id = :episodeId, updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId, episodeId: event.used_in_episode_id || null } }
      );
    }

    // Store reference on event canon_consequences
    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    const auto = event.canon_consequences?.automation || {};
    if (asset.asset_role === 'UI.OVERLAY.WARDROBE_LIST') {
      auto.wardrobe_overlay_asset_id = assetId;
      auto.wardrobe_overlay_url = asset.s3_url_processed;
      if (meta.tasks) auto.wardrobe_tasks = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
    } else if (asset.asset_role === 'UI.OVERLAY.SOCIAL_TASKS') {
      auto.social_checklist_asset_id = assetId;
      auto.social_checklist_url = asset.s3_url_processed;
      // T5 (§8(bb); Task #2304): after Start Episode the edited tasks go to
      // the episode's copy (below), not the event's.
      if (meta.tasks && !startedEpisode) auto.social_tasks = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
    }

    await sequelize.query(
      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
      { replacements: { cc: JSON.stringify({ ...event.canon_consequences, automation: auto }), id: eventId } }
    );

    // T5: an approved social-task edit after Start Episode is saved to the
    // episode's copy, keeping completion for tasks that carry over.
    let savedTo = 'event';
    if (startedEpisode && asset.asset_role === 'UI.OVERLAY.SOCIAL_TASKS' && meta.tasks) {
      const edited = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
      await writeEpisodeSocialTasks(sequelize, { episodeId: startedEpisode.id, showId, eventId }, edited);
      savedTo = 'episode';
    }

    // If linked to episode, upsert episode_todo_lists for wardrobe
    if (event.used_in_episode_id && asset.asset_role === 'UI.OVERLAY.WARDROBE_LIST') {
      try {
        const tasks = meta.tasks ? (typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks) : [];
        const [existing] = await sequelize.query(
          'SELECT id FROM episode_todo_lists WHERE episode_id = :episodeId LIMIT 1',
          { replacements: { episodeId: event.used_in_episode_id }, type: sequelize.QueryTypes.SELECT }
        );
        if (existing) {
          await sequelize.query(
            `UPDATE episode_todo_lists SET tasks = :tasks, asset_id = :assetId, asset_url = :assetUrl, event_id = :eventId, status = 'generated', updated_at = NOW() WHERE episode_id = :episodeId`,
            { replacements: { tasks: JSON.stringify(tasks), assetId, assetUrl: asset.s3_url_processed, eventId, episodeId: event.used_in_episode_id } }
          );
        } else {
          const { v4: uuidv4 } = require('uuid');
          await sequelize.query(
            `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, asset_id, asset_url, status, generated_by, created_at, updated_at)
             VALUES (:id, :episodeId, :showId, :eventId, :tasks, :assetId, :assetUrl, 'generated', 'ai', NOW(), NOW())`,
            { replacements: { id: uuidv4(), episodeId: event.used_in_episode_id, showId, eventId, tasks: JSON.stringify(tasks), assetId, assetUrl: asset.s3_url_processed } }
          );
        }
      } catch (err) { console.warn('[OverlayApprove] episode_todo_lists upsert error:', err.message); }
    }

    return res.json({ success: true, message: 'Overlay approved', episodeId: event.used_in_episode_id, savedTo });
  } catch (err) {
    console.error('[OverlayApprove] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/reject-overlay
router.post('/world/:showId/events/:eventId/reject-overlay', requireAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId required' });

    const models = req.app?.get?.('models') || require('../../models');
    try {
      await models.sequelize.query(
        `UPDATE assets SET approval_status = 'rejected', deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId } }
      );
    } catch {
      await models.sequelize.query(
        `UPDATE assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId } }
      );
    }

    return res.json({ success: true, message: 'Overlay rejected' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/re-render-overlay
router.post('/world/:showId/events/:eventId/re-render-overlay', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { tasks, overlayType } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ success: false, error: 'tasks array required' });
    if (!overlayType) return res.status(400).json({ success: false, error: 'overlayType required' });

    const models = req.app?.get?.('models') || require('../../models');
    const { sequelize } = models;

    // Load event for context
    const [event] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Re-render with edited tasks
    let buffer;
    if (overlayType === 'wardrobe') {
      const { renderTodoAsset } = require('../../services/todoListService');
      buffer = renderTodoAsset(tasks, event, { listType: 'wardrobe' });
    } else if (overlayType === 'social') {
      const { renderSocialChecklist } = require('../../services/socialChecklistService');
      buffer = renderSocialChecklist(tasks, event);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid overlayType' });
    }

    // Upload re-rendered PNG
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { v4: uuidv4 } = require('uuid');
    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const s3 = new S3Client({ region: AWS_REGION });
    const s3Key = `overlays/${eventId}/${overlayType}-rerender-${uuidv4()}.png`;

    let imageUrl = null;
    if (S3_BUCKET && buffer) {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      imageUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    // Persist re-rendered asset to DB so it appears in history and survives refresh
    const assetId = uuidv4();
    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';
    try {
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
         VALUES (:id, :name, :assetType, :assetRole, 'EPISODE', 'SHOW', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId,
          name: `${event.name} — ${overlayType === 'wardrobe' ? 'Wardrobe List' : 'Social Tasks'} (edited)`,
          assetType: overlayType === 'wardrobe' ? 'TODO_LIST' : 'SOCIAL_CHECKLIST',
          assetRole, url: imageUrl, showId, episodeId: event.used_in_episode_id || null,
          metadata: JSON.stringify({
            source: `${overlayType}-overlay-rerender`,
            list_type: overlayType === 'wardrobe' ? 'wardrobe' : 'social',
            event_id: eventId, event_name: event.name,
            task_count: tasks.length, tasks: JSON.stringify(tasks),
            rerendered: true, generated_at: new Date().toISOString(),
          }),
        }}
      );
    } catch (err) { console.warn('[OverlayRerender] Asset persist failed (non-blocking):', err.message); }

    return res.json({ success: true, imageUrl, assetId, message: 'Overlay re-rendered with edited tasks' });
  } catch (err) {
    console.error('[OverlayRerender] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/overlay-tasks/:overlayType
router.get('/world/:showId/events/:eventId/overlay-tasks/:overlayType', requireAuth, async (req, res) => {
  try {
    const { showId, eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { sequelize } = models;

    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';

    // T5 (§8(bb); Task #2304): after Start Episode, social tasks are edited
    // from the episode's copy.
    if (overlayType !== 'wardrobe') {
      const episode = await startedEpisodeFor(sequelize, eventId);
      const onEpisode = episode ? await readEpisodeSocialTasks(sequelize, episode.id) : null;
      if (onEpisode && onEpisode.length > 0) return res.json({ success: true, tasks: onEpisode, source: 'episode', episodeId: episode.id });
    }

    // Find most recent asset for this overlay type
    const [asset] = await sequelize.query(
      `SELECT metadata FROM assets WHERE metadata->>'event_id' = :eventId AND asset_role = :assetRole AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { eventId, assetRole }, type: sequelize.QueryTypes.SELECT }
    );

    if (asset) {
      const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : (asset.metadata || {});
      let tasks = meta.tasks;
      if (typeof tasks === 'string') tasks = JSON.parse(tasks);
      if (tasks) return res.json({ success: true, tasks });
    }

    // Fallback: load from event canon_consequences
    const [event] = await sequelize.query(
      'SELECT canon_consequences FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (event) {
      let cc = event.canon_consequences;
      if (typeof cc === 'string') try { cc = JSON.parse(cc); } catch { cc = {}; }
      const auto = cc?.automation || {};
      const fallbackTasks = overlayType === 'wardrobe' ? auto.wardrobe_tasks : auto.social_tasks;
      if (fallbackTasks?.length > 0) return res.json({ success: true, tasks: fallbackTasks });
    }

    return res.json({ success: true, tasks: null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/overlay-history/:overlayType
router.get('/world/:showId/events/:eventId/overlay-history/:overlayType', requireAuth, async (req, res) => {
  try {
    const { eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { sequelize } = models;

    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';

    const [rows] = await sequelize.query(
      `SELECT id, s3_url_processed as image_url, approval_status, metadata, created_at
       FROM assets WHERE metadata->>'event_id' = :eventId AND asset_role = :assetRole AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      { replacements: { eventId, assetRole } }
    );

    const data = (rows || []).map((r, i) => {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {});
      return {
        id: r.id,
        image_url: r.image_url,
        approval_status: r.approval_status,
        version: meta.version || (rows.length - i),
        task_count: meta.task_count,
        created_at: r.created_at,
      };
    });

    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// EPISODE TITLE OVERLAY — generates title card with actual episode title
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/generate-title-overlay
// Producer Mode's "Generate Episode Title" button. Since Task #2386 (P11) it
// goes through the same service as the episode page: the title must be
// approved (409 TITLE_NOT_APPROVED otherwise), the card uses the show's style
// and the source event's visual direction, and a redesign replaces the
// episode's previous card.
router.post('/world/:showId/episodes/:episodeId/generate-title-overlay', requireAuth, aiRateLimiter, async (req, res) => {
  const { showId, episodeId } = req.params;
  const models = req.app?.get?.('models') || require('../../models');
  try {
    const { designTitleCard } = require('../../services/episodeTitleCardService');
    const result = await designTitleCard(models, episodeId, { showId });
    return res.json({
      success: true,
      data: { assetId: result.assetId, imageUrl: result.imageUrl, title: result.title, replaced: result.replaced },
      message: `Episode title card designed: "${result.title}"`,
    });
  } catch (err) {
    console.error('[EpisodeTitleOverlay] Error:', err.message);
    if (err.code === 'EPISODE_NOT_FOUND') {
      // Stale link: an event has used_in_episode_id pointing to an episode
      // that's been soft- or hard-deleted. Clear the FK so the next page
      // refresh stops showing the orphan button. Best-effort — never let
      // the cleanup throw mask the underlying 404.
      try {
        await models.sequelize.query(
          `UPDATE world_events SET used_in_episode_id = NULL
           WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL`,
          { replacements: { episodeId } }
        );
      } catch (cleanupErr) {
        console.error('[EpisodeTitleOverlay] stale link cleanup failed:', cleanupErr.message);
      }
      return res.status(404).json({
        success: false,
        error: 'Episode not found — it may have been deleted. Stale link cleared; refresh to update the panel.',
        stale_link_cleared: true,
      });
    }
    const status = isBudgetError(err) ? 429 : (err.status && err.status < 600 ? err.status : 500);
    return res.status(status).json({ success: false, error: err.message, code: err.code || null });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// OVERLAY SELECTION — show-level vs episode-level, auto-suggestions
// ═══════════════════════════════════════════════════════════════════════

// GET /world/:showId/events/:eventId/overlay-suggestions
router.get('/world/:showId/events/:eventId/overlay-suggestions', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');

    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    if (typeof event.outfit_pieces === 'string') {
      try { event.outfit_pieces = JSON.parse(event.outfit_pieces); } catch { event.outfit_pieces = []; }
    }

    const { getAllOverlayTypes, suggestOverlaysForEvent } = require('../../services/uiOverlayService');
    const suggestions = suggestOverlaysForEvent(event);

    // Get current selections from required_ui_overlays
    let currentSelections = event.required_ui_overlays;
    if (typeof currentSelections === 'string') try { currentSelections = JSON.parse(currentSelections); } catch { currentSelections = null; }

    // Get all overlay types from DB for this show
    const allTypes = await getAllOverlayTypes(event.show_id, models);
    const showOverlays = allTypes.filter(o => o.lifecycle === 'permanent');
    const episodeOverlays = allTypes.filter(o => o.lifecycle === 'per_episode' || o.lifecycle === 'variant');

    return res.json({
      success: true,
      data: {
        show_overlays: showOverlays.map(o => ({ id: o.id, name: o.name, category: o.category })),
        episode_overlays: episodeOverlays.map(o => {
          const suggestion = suggestions.find(s => s.id === o.id);
          const selected = currentSelections ? currentSelections.includes(o.id) : !!suggestion;
          return { id: o.id, name: o.name, category: o.category, selected, suggested: !!suggestion, reason: suggestion?.reason || null };
        }),
        current_selections: currentSelections,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/events/:eventId/overlay-selections — save selected overlays
router.put('/world/:showId/events/:eventId/overlay-selections', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { selected_overlays } = req.body;
    const models = req.app?.get?.('models') || require('../../models');

    await models.sequelize.query(
      `UPDATE world_events SET required_ui_overlays = :overlays, updated_at = NOW() WHERE id = :eventId AND show_id = :showId`,
      { replacements: { overlays: JSON.stringify(selected_overlays), eventId, showId } }
    );

    return res.json({ success: true, message: `${selected_overlays.length} overlays selected` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
