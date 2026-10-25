/**
 * World Events routes — creating an event
 *
 * POST   /api/v1/world/:showId/events
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../../middleware/auth');
const { withAutoScheduledDate } = require('../../utils/eventDateDefault');
const { syncDraftedDealType } = require('../../services/dealTypeDraftService');
const { getModels } = require('./helpers');

// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events
// ═══════════════════════════════════════════

router.post('/world/:showId/events', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      name, event_type = 'invite', category = null, format = null, host, host_brand, description,
      prestige = 5, cost_coins = 100, strictness = 5,
      deadline_type = 'medium', deadline_minutes,
      dress_code, dress_code_keywords = [],
      location_hint, narrative_stakes, canon_consequences = {},
      seeds_future_events = [],
      overlay_template = 'luxury_invite',
      required_ui_overlays = ['MailPanel', 'InviteLetterOverlay', 'ToDoList'],
      browse_pool_bias = 'balanced', browse_pool_size = 8,
      rewards = {},
      season_id, arc_id,
      is_paid = false, payment_amount = 0,
      requirements = {}, career_tier = 1,
      career_milestone, fail_consequence, success_unlock,
      // New venue fields (stored in event even pre-migration)
      venue_location_id, venue_name, venue_address, event_date, event_time,
      // Task #2158: the creator link (WorldAdmin's form sends it).
      source_profile_id,
      guest_list: _guest_list, invitation_details: _invitation_details, scene_set_id,
      // Narrative chain — see PUT allowlist for details. Optional on create.
      parent_event_id = null, chain_position = null, chain_reason = null,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, error: 'Event name is required' });

    // Date and time (Task #1755). A date or time the creator typed is kept
    // (this route used to discard both). With no date, the event is
    // auto-scheduled 45 days out and flagged in automation.event_date_auto
    // so the Event Package can label it (src/utils/eventDateDefault.js).
    const dated = withAutoScheduledDate(event_date, canon_consequences);
    const createEventTime = typeof event_time === 'string' && event_time.trim() ? event_time.trim() : null;

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // If venue_location_id provided, auto-populate venue details from WorldLocation
    let resolvedVenueName = venue_name || null;
    let resolvedVenueAddress = venue_address || null;
    const resolvedSceneSetId = scene_set_id || null;
    // Task #2158: the venue link is saved when it names an existing
    // WorldLocation (the lookup below), and left unsaved otherwise.
    let savedVenueLocationId = null;
    if (venue_location_id && models.WorldLocation) {
      try {
        const venue = await models.WorldLocation.findByPk(venue_location_id);
        if (venue) {
          savedVenueLocationId = venue_location_id;
          if (!resolvedVenueName) resolvedVenueName = venue.name;
          if (!resolvedVenueAddress) {
            const parts = [venue.street_address, venue.district, venue.city].filter(Boolean);
            resolvedVenueAddress = parts.length > 0 ? parts.join(', ') : null;
          }
          // No scene set is linked from the venue by itself (S3, S7): the
          // first set found at the location was linked here, with no order.
          // The Event Package's Place section is where the set is chosen.
        }
      } catch { /* non-blocking */ }
    }

    // Task #2158: the creator link is saved when it names an existing
    // SocialProfile, looked up the same way as the venue; an unknown or
    // failed lookup is ignored and the event saves without it. Once saved,
    // Suggest names frames names with this creator's niche, and the Event
    // Package shows them as the organizer when no brand is set.
    let savedSourceProfileId = null;
    if (source_profile_id && models.SocialProfile) {
      try {
        const profile = await models.SocialProfile.findByPk(source_profile_id, { attributes: ['id'] });
        if (profile) savedSourceProfileId = profile.id;
        else console.warn(`[CreateEvent] source_profile_id ${JSON.stringify(source_profile_id)} names no SocialProfile; saving the event without it`);
      } catch (err) {
        console.warn('[CreateEvent] source_profile_id lookup failed; saving the event without it:', err.message);
      }
    }
    // Only the links that validated, so a request with neither saves as before.
    const savedLinks = {
      ...(savedVenueLocationId ? { venue_location_id: savedVenueLocationId } : {}),
      ...(savedSourceProfileId ? { source_profile_id: savedSourceProfileId } : {}),
    };

    if (models.WorldEvent) {
      const event = await models.WorldEvent.create({
        show_id: showId,
        season_id: season_id || null,
        arc_id: arc_id || null,
        name, event_type,
        category, format,
        host: host || null,
        host_brand: host_brand || null,
        description: description || null,
        prestige, cost_coins, strictness,
        deadline_type, deadline_minutes: deadline_minutes || null,
        dress_code: dress_code || null,
        dress_code_keywords,
        location_hint: location_hint || resolvedVenueAddress || null,
        narrative_stakes: narrative_stakes || null,
        event_date: dated.event_date || null,
        event_time: createEventTime,
        canon_consequences: dated.canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays,
        browse_pool_bias, browse_pool_size,
        rewards,
        is_paid, payment_amount,
        requirements, career_tier,
        career_milestone: career_milestone || null,
        fail_consequence: fail_consequence || null,
        success_unlock: success_unlock || null,
        scene_set_id: resolvedSceneSetId,
        parent_event_id: parent_event_id || null,
        chain_position: chain_position || null,
        chain_reason: chain_reason || null,
        status: 'draft',
        ...savedLinks,
      });
      // The deal type's first draft (Task #2330; dealTypeDraftService).
      const dealDraft = await syncDraftedDealType(models.sequelize, event.id, { initial: true });
      if (dealDraft.deal_type) {
        event.set('deal_type', dealDraft.deal_type);
        event.set('deal_components', dealDraft.deal_components);
      }

      return res.status(201).json({ success: true, event: event.toJSON() });
    }

    // Fallback: raw SQL. The saved links (Task #2158) are appended only
    // when present, so the statement is otherwise as before.
    const linkColumns = Object.keys(savedLinks);
    const linkCols = linkColumns.map((c) => `, ${c}`).join('');
    const linkVals = linkColumns.map((c) => `, :${c}`).join('');
    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO world_events
        (id, show_id, season_id, arc_id, name, event_type, category, format, host, host_brand, description,
        prestige, cost_coins, strictness, deadline_type, deadline_minutes,
        dress_code, dress_code_keywords, location_hint, narrative_stakes,
        event_date, event_time,
        canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays, browse_pool_bias, browse_pool_size,
        rewards, is_paid, payment_amount, requirements, career_tier,
        career_milestone, fail_consequence, success_unlock,
        scene_set_id, parent_event_id, chain_position, chain_reason${linkCols},
        status, created_at, updated_at)
       VALUES
      (:id, :showId, :season_id, :arc_id, :name, :event_type, :category, :format, :host, :host_brand, :description,
        :prestige, :cost_coins, :strictness, :deadline_type, :deadline_minutes,
        :dress_code, :dress_code_keywords, :location_hint, :narrative_stakes,
        :event_date, :event_time,
        :canon_consequences, :seeds_future_events,
        :overlay_template, :required_ui_overlays, :browse_pool_bias, :browse_pool_size,
        :rewards, :is_paid, :payment_amount, :requirements, :career_tier,
        :career_milestone, :fail_consequence, :success_unlock,
        :scene_set_id, :parent_event_id, :chain_position, :chain_reason${linkVals},
        'draft', NOW(), NOW())`,
      {
        replacements: {
          id, showId,
          season_id: season_id || null,
          arc_id: arc_id || null,
          name, event_type,
          category: category || null, format: format || null,
          host: host || null,
          host_brand: host_brand || null,
          description: description || null,
          prestige, cost_coins, strictness,
          deadline_type, deadline_minutes: deadline_minutes || null,
          dress_code: dress_code || null,
          dress_code_keywords: JSON.stringify(dress_code_keywords),
          location_hint: location_hint || resolvedVenueAddress || null,
          narrative_stakes: narrative_stakes || null,
          event_date: dated.event_date || null,
          event_time: createEventTime,
          canon_consequences: JSON.stringify(dated.canon_consequences),
          seeds_future_events: JSON.stringify(seeds_future_events),
          overlay_template,
          required_ui_overlays: JSON.stringify(required_ui_overlays),
          browse_pool_bias, browse_pool_size,
          rewards: JSON.stringify(rewards),
          is_paid, payment_amount,
          requirements: JSON.stringify(requirements),
          career_tier,
          career_milestone: career_milestone || null,
          fail_consequence: fail_consequence || null,
          success_unlock: success_unlock || null,
          scene_set_id: resolvedSceneSetId,
          parent_event_id: parent_event_id || null,
          chain_position: chain_position || null,
          chain_reason: chain_reason || null,
          ...savedLinks,
        },
      }
    );

    // The deal type's first draft (Task #2330; dealTypeDraftService).
    await syncDraftedDealType(models.sequelize, id, { initial: true });

    const [created] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :id`, { replacements: { id } }
    );

    return res.status(201).json({ success: true, event: created[0] });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create event', message: error.message });
  }
});

module.exports = router;
