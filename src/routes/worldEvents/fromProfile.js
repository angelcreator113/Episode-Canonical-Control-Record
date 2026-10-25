/**
 * World Events routes — an event from a social profile
 *
 * POST   /api/v1/world/:showId/events/from-profile
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { autoScheduledEventDate, AUTO_DATE_KEY } = require('../../utils/eventDateDefault');
const { draftEventConcept } = require('../../services/eventConceptDraftService');
const { syncDraftedDealType } = require('../../services/dealTypeDraftService');
const { getModels } = require('./helpers');

// POST /world/:showId/events/from-profile — Create event from a feed profile
router.post('/world/:showId/events/from-profile', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { profile_id, event_template } = req.body;
    const models = await getModels();
    if (!models?.SocialProfile) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const profile = await models.SocialProfile.findByPk(profile_id, {
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype', 'follower_tier', 'brand_partnerships', 'lala_relevance_score', 'aesthetic_dna', 'city', 'frequent_venues'],
    });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const p = profile.toJSON();
    // The host's tier sets the prestige: the six count tiers (Task #3106); Nano 2 and Emerging 1 are new.
    const prestige = { mega: 8, macro: 6, mid: 4, micro: 3, nano: 2, emerging: 1 }[p.follower_tier] || 3;

    // Find venue
    const eventAutomation = require('../../services/eventAutomationService');
    const fakeCalEvent = { cultural_category: p.content_category || 'creator_economy' };
    let venue = await eventAutomation.findVenue(fakeCalEvent, models, profile);

    // Auto-create venue in WorldLocations if none exists
    if (!venue) {
      try {
        venue = await eventAutomation.ensureVenueLocation(
          `${p.display_name || p.handle}'s Venue`,
          null,
          p.content_category,
          models
        );
      } catch { /* non-blocking */ }
    }
    const venueAddress = venue ? [venue.street_address, venue.district, venue.city].filter(Boolean).join(', ') : null;

    // Assemble guest list
    let guestList = [];
    try {
      guestList = await eventAutomation.assembleGuestList(profile, fakeCalEvent, models, 6);
    } catch { /* non-blocking */ }

    // Derive fields from prestige/profile
    const costCoins = prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50;
    const strictness = Math.min(10, prestige + Math.floor(Math.random() * 2));
    const deadlineType = prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low';
    // Task #1765: a creator's brand partnership is their sponsor, not the
    // event's organizer. This route used to write the first partnership's
    // brand to host_brand and automation.host_brand, and
    // resolveEventOrganizer (frontend eventReadiness.js) lets any brand
    // there win over the creator, so the Event Package read "Organized by
    // <sponsor>". host_brand is null in both homes (the keys are kept, so a
    // profile with no partnerships creates the same event as before) and
    // left for Evoni to set in the Event Package.
    // Task #1790: the creator is not the organizer either. Starting an event
    // from a Feed creator no longer decides their role (docs/
    // EVENT_EPISODE_FLOW.md §8(r): organizer, host/face, sponsor, featured
    // attendees). This route writes no organizer field — not `host`, not
    // source_profile_id (§8(p) ruling 6's interim creator-organizer home),
    // not the automation.host_* copy — and records the creator only as
    // automation.started_from_profile_id, which means "started from" and
    // nothing more. The Event Package offers them as the organizer and as a
    // featured attendee; nothing is saved until Evoni accepts.
    // The partnerships are kept as automation.brand_partnerships (read by
    // characterSyncService.generatePostEventOpportunities as brand sources)
    // and in the narrative sentence below; the profile row still holds them.
    const partnerships = Array.isArray(p.brand_partnerships)
      ? p.brand_partnerships.filter(b => b && typeof b === 'object' && b.brand)
      : [];
    // Same value the narrative sentence always used (first partnership).
    const sponsorBrand = p.brand_partnerships?.[0]?.brand || null;

    // Task #1757: no time and no dress code. This route used to derive the
    // time from prestige (20:00/19:00/18:00) and the dress code (and its
    // keywords) from the profile's content_category (falling back to
    // 'chic'), and saved both to the columns and to the automation copy —
    // so the Event Package showed "Set" for values nobody chose. A profile
    // supplies neither, so the event is created with neither; the Event
    // Package offers suggestions (src/utils/eventBasics.js on the frontend).
    // Task #1755: the system default date (45 days out), replacing the
    // random 7-20 days this route used to pick; flagged below as
    // automation.event_date_auto so the Event Package labels it.
    const eventDateStr = autoScheduledEventDate();

    // Invitation style derived from archetype + category + aesthetic_dna
    const ARCHETYPE_STYLES = {
      polished_curator:  { theme: 'refined editorial', mood: 'curated, intentional, elevated', color_palette: ['ivory', 'charcoal', 'gold leaf'], floral_style: 'single stem arrangement', border_style: 'embossed letterpress' },
      messy_transparent: { theme: 'raw authentic', mood: 'unfiltered, confessional, real', color_palette: ['kraft brown', 'black ink', 'off-white'], floral_style: 'wildflowers, imperfect', border_style: 'torn edge, handwritten' },
      soft_life:         { theme: 'dreamy luxury', mood: 'serene, aspirational, soft', color_palette: ['lavender', 'champagne', 'cloud white'], floral_style: 'cascading peonies', border_style: 'watercolor wash' },
      explicitly_paid:   { theme: 'brand flex', mood: 'unapologetic, bold, sponsored', color_palette: ['hot pink', 'gold', 'white'], floral_style: 'none — logo placement', border_style: 'metallic foil' },
      overnight_rise:    { theme: 'viral moment', mood: 'electric, urgent, now', color_palette: ['neon green', 'black', 'chrome'], floral_style: 'none', border_style: 'glitch effect' },
      cautionary:        { theme: 'faded glamour', mood: 'nostalgic, bittersweet, warning', color_palette: ['dusty rose', 'faded gold', 'grey'], floral_style: 'dried flowers', border_style: 'vintage distressed' },
      the_peer:          { theme: 'inclusive warmth', mood: 'welcoming, relatable, cozy', color_palette: ['warm terracotta', 'cream', 'sage'], floral_style: 'garden flowers', border_style: 'rounded, friendly' },
      the_watcher:       { theme: 'mysterious observer', mood: 'understated, knowing, quiet power', color_palette: ['slate', 'navy', 'silver'], floral_style: 'single dark bloom', border_style: 'thin precise line' },
      chaos_creator:     { theme: 'controlled chaos', mood: 'unpredictable, provocative, memorable', color_palette: ['electric red', 'acid yellow', 'black'], floral_style: 'none — graffiti texture', border_style: 'ripped, asymmetric' },
      community_builder: { theme: 'gathering place', mood: 'collective, warm, purposeful', color_palette: ['sunset orange', 'deep teal', 'cream'], floral_style: 'abundant mixed arrangements', border_style: 'woven pattern' },
    };
    const CATEGORY_STYLE_TWEAKS = {
      fashion:   { mood_add: 'fashion-forward', floral_tweak: 'fashion show florals' },
      beauty:    { mood_add: 'luminous', floral_tweak: 'rose and peony' },
      lifestyle: { mood_add: 'aspirational living', floral_tweak: 'eucalyptus accent' },
      music:     { mood_add: 'rhythmic energy', color_swap: ['deep purple'] },
      food:      { mood_add: 'indulgent', floral_tweak: 'herbs and citrus' },
      drama:     { mood_add: 'tension-filled', color_swap: ['crimson'] },
    };

    const archStyle = ARCHETYPE_STYLES[p.archetype] || ARCHETYPE_STYLES.polished_curator;
    const catTweak = CATEGORY_STYLE_TWEAKS[(p.content_category || '').toLowerCase()] || {};
    const aestheticDna = p.aesthetic_dna || {};

    // Merge: archetype base + category tweaks + profile aesthetic DNA
    const invStyle = {
      theme: aestheticDna.visual_style || archStyle.theme,
      mood: [archStyle.mood, catTweak.mood_add].filter(Boolean).join(', '),
      color_palette: aestheticDna.color_palette?.length > 0
        ? aestheticDna.color_palette
        : (catTweak.color_swap ? [...archStyle.color_palette.slice(0, -1), ...catTweak.color_swap] : archStyle.color_palette),
      floral_style: catTweak.floral_tweak || archStyle.floral_style,
      border_style: archStyle.border_style,
    };
    // Task #1790: neither the name nor the description says the creator
    // hosts or organizes the event. Task #2141 (doctrine rule 12): the
    // description is attendee copy, so it no longer states a guest count;
    // the guest list itself is unchanged (automation.guest_profiles).
    const creatorName = p.display_name || p.handle;
    const templateDescription = `An exclusive ${p.content_category || 'creator'} event with ${creatorName}${venue ? ` at ${venue.name}` : ''}.`;

    // Task #2122 (§8(u) R1, R8; §8(v)): one Haiku 4.5 call drafts a concept,
    // an activity and the public description. It never blocks creation:
    // draftEventConcept returns null on any failure, its own rate limit or a
    // budget refusal, and the event keeps the template description with no
    // draft keys. auto_drafted records what was drafted, for step 4's
    // "Auto-drafted · <source>" label.
    const draft = await draftEventConcept(p, { venueName: venue?.name || null, userId: req.user?.id, models: req.app.locals.db || require('../../models'), showId: req.params.showId });
    const descriptionText = draft ? draft.description : templateDescription;
    // Task #2124 (§8(u) R7): the same draft may carry styling. With it,
    // dress_code and dress_code_keywords go to their columns and the brief
    // to automation.styling_brief; without it, all three are as before.
    const styling = draft?.styling || null;
    // Task #2126 (§8(u) R3): the draft's category, format and start time,
    // each present only when valid. A field not drafted is saved as before
    // (null) and the Event Package still suggests it.
    const draftedTaxonomy = {};
    for (const field of ['category', 'format', 'event_time']) {
      if (draft?.[field]) draftedTaxonomy[field] = draft[field];
    }
    // Task #2135 (§8(u) R1, R3, R9): the draft's name, present only when
    // valid (under 40 characters, not the fallback). Without one the event
    // keeps "Event with <creator>" as before.
    const draftedName = draft?.name || null;
    const draftAutomation = draft
      ? {
        concept: draft.concept,
        activity: draft.activity,
        ...(styling ? { styling_brief: styling.styling_brief } : {}),
        auto_drafted: {
          description: 'ai_draft',
          concept: 'ai_draft',
          activity: 'ai_draft',
          ...(styling ? { dress_code: 'ai_draft', dress_code_keywords: 'ai_draft', styling_brief: 'ai_draft' } : {}),
          ...Object.fromEntries(Object.keys(draftedTaxonomy).map((field) => [field, 'ai_draft'])),
          ...(draftedName ? { name: 'ai_draft' } : {}),
        },
        // Task #2128 (rule 14): a copy of each drafted column value. The
        // Event Package shows a field Auto-drafted while its column equals
        // this copy and Edited once it differs (the date's event_date_auto
        // pattern). Only fields actually drafted get a copy.
        drafted_values: {
          description: draft.description,
          ...(styling ? { dress_code: styling.dress_code, dress_code_keywords: styling.dress_code_keywords } : {}),
          ...draftedTaxonomy,
          ...(draftedName ? { name: draftedName } : {}),
        },
      }
      : {};
    const narrativeText = `This event could ${prestige >= 6 ? 'elevate' : 'establish'} Lala's position in the ${p.content_category || 'creator'} scene. ${sponsorBrand ? `Brand opportunity with ${sponsorBrand}.` : ''}`;

    const eventData = {
      show_id: showId,
      name: draftedName || `${event_template || 'Event'} with ${creatorName}`,
      event_type: 'invite',
      host: null,
      host_brand: null,
      source_profile_id: null,
      prestige,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      dress_code: styling ? styling.dress_code : null,
      ...(styling ? { dress_code_keywords: styling.dress_code_keywords } : {}),
      location_hint: venueAddress || null,
      // Top-level FK to the WorldLocation. Without this, the venue only
      // lives nested in canon_consequences.automation and Overview's
      // Locations card (which reads venue_location_id directly off the
      // event row) shows nothing for feed-profile-spawned events.
      venue_location_id: venue?.id || null,
      venue_name: venue?.name || null,
      venue_address: venueAddress || null,
      event_date: eventDateStr,
      event_time: draftedTaxonomy.event_time || null,
      ...(draftedTaxonomy.category ? { category: draftedTaxonomy.category } : {}),
      ...(draftedTaxonomy.format ? { format: draftedTaxonomy.format } : {}),
      description: descriptionText,
      narrative_stakes: narrativeText,
      theme: invStyle.theme,
      mood: invStyle.mood,
      color_palette: invStyle.color_palette,
      floral_style: invStyle.floral_style,
      border_style: invStyle.border_style,
      canon_consequences: {
        automation: {
          started_from_profile_id: p.id,
          host_brand: null,
          ...(partnerships.length > 0 ? { brand_partnerships: partnerships } : {}),
          venue_location_id: venue?.id,
          venue_name: venue?.name,
          venue_address: venueAddress,
          guest_profiles: guestList,
          event_date: eventDateStr,
          [AUTO_DATE_KEY]: eventDateStr,
          cost_coins: costCoins,
          strictness,
          deadline_type: deadlineType,
          description: descriptionText,
          ...draftAutomation,
          narrative_stakes: narrativeText,
          theme: invStyle.theme,
          mood: invStyle.mood,
          color_palette: invStyle.color_palette,
          floral_style: invStyle.floral_style,
          border_style: invStyle.border_style,
          // Follow psychology — drives Lala's emotional arc in episodes
          follow_motivation: p.follow_motivation || null,
          follow_emotion: p.follow_emotion || null,
          follow_trigger: p.follow_trigger || null,
          event_excitement: p.event_excitement || 5,
          lifestyle_claim: p.lifestyle_claim || null,
          lifestyle_reality: p.lifestyle_reality || null,
          lifestyle_gap: p.lifestyle_gap || null,
          beauty_factor: p.beauty_factor || 0,
          beauty_description: p.beauty_description || null,
          aesthetic_power: p.aesthetic_power || null,
          content_category: p.content_category || null,
          // Auto-generated social tasks
          social_tasks: (() => {
            try {
              const { buildSocialTasks } = require('../../services/episodeGeneratorService');
              // T9 (§8(cc); Task #2395): goals written from this event's
              // fields, their count set by its prestige.
              return buildSocialTasks('invite', { platform: 'pulse', content_category: p.content_category || 'creator_economy' }, [], {
                prestige,
                event_name: draftedName || `${event_template || 'Event'} with ${creatorName}`,
                venue_name: venue?.name || null,
                dress_code: styling ? styling.dress_code : null,
                description: descriptionText,
                guest_names: (guestList || []).map((g) => g?.display_name || g?.handle).filter(Boolean),
              });
            } catch { return []; }
          })(),
        },
      },
      status: 'draft',
    };

    let event;
    try {
      if (models.WorldEvent) {
        event = await models.WorldEvent.create(eventData);
      }
    } catch (createErr) {
      console.warn('WorldEvent.create failed, using raw SQL:', createErr.message);
      event = null;
    }

    if (!event) {
      const { v4: uuidv4 } = require('uuid');
      eventData.id = uuidv4();
      // Try full insert first, then minimal fallback
      try {
        await models.sequelize.query(
          `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, prestige, cost_coins,
           strictness, deadline_type, dress_code, dress_code_keywords, description, narrative_stakes, location_hint, venue_name,
           venue_address, event_date, event_time, category, format, canon_consequences, status, created_at, updated_at)
           VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :prestige, :cost_coins,
           :strictness, :deadline_type, :dress_code, :dress_code_keywords::jsonb, :description, :narrative_stakes, :location_hint, :venue_name,
           :venue_address, :event_date, :event_time, :category, :format, :canon_consequences, 'draft', NOW(), NOW())`,
          { replacements: {
            ...eventData,
            // Task #2126: null when not drafted, as the columns are today.
            category: eventData.category || null,
            format: eventData.format || null,
            // Task #2124: the column's default is []; a drafted list replaces it.
            dress_code_keywords: JSON.stringify(eventData.dress_code_keywords || []),
            canon_consequences: JSON.stringify(eventData.canon_consequences),
          } }
        );
      } catch (sqlErr) {
        console.warn('Full SQL insert failed, trying minimal:', sqlErr.message);
        // Minimal fallback — only guaranteed columns
        try {
          await models.sequelize.query(
            `INSERT INTO world_events (id, show_id, name, event_type, host, description, prestige, location_hint, canon_consequences, status, created_at, updated_at)
             VALUES (:id, :show_id, :name, :event_type, :host, :description, :prestige, :location_hint, :canon_consequences, 'draft', NOW(), NOW())`,
            { replacements: {
              id: eventData.id, show_id: showId, name: eventData.name,
              event_type: eventData.event_type, host: eventData.host,
              description: eventData.description, prestige: eventData.prestige,
              location_hint: eventData.location_hint,
              canon_consequences: JSON.stringify(eventData.canon_consequences),
            } }
          );
        } catch (minErr) {
          return res.status(500).json({ success: false, error: `Event creation failed: ${minErr.message}` });
        }
      }
      event = eventData;
    }

    // The deal type's first draft (Task #2330; dealTypeDraftService).
    const dealDraft = await syncDraftedDealType(models.sequelize, event.id || eventData.id, { initial: true });
    if (dealDraft.deal_type) {
      if (typeof event.set === 'function') {
        event.set('deal_type', dealDraft.deal_type);
        event.set('deal_components', dealDraft.deal_components);
      } else {
        event.deal_type = dealDraft.deal_type;
        event.deal_components = dealDraft.deal_components;
      }
    }

    res.status(201).json({ success: true, event: event.toJSON ? event.toJSON() : event });
  } catch (err) {
    console.error('POST /world/:showId/events/from-profile error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
