'use strict';
/**
 * calendarRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   const calendarRoutes = require('./routes/calendarRoutes');
 *   app.use('/api/v1/calendar', calendarRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MARKERS
 *   GET    /markers                         — list by series_id, ordered by sequence_order
 *   POST   /markers                         — create marker; enforce one is_present=true per series
 *   PUT    /markers/:id/set-present         — set is_present=true, clear others for same series
 *
 * EVENTS
 *   GET    /events                          — list; query: series_id, event_type, story_position, visibility
 *   POST   /events                          — create event
 *   PUT    /events/:id                      — update event
 *   DELETE /events/:id                      — delete event
 *
 * ATTENDEES
 *   GET    /events/:id/attendees            — list attendees for event
 *   POST   /events/:id/attendees            — add attendee
 *   PUT    /events/:id/attendees/:attendeeId — update attendee
 *
 * RIPPLES
 *   POST   /events/:id/ripples/generate     — Amber generates ripple threads via Claude
 *   PUT    /ripples/:id/confirm             — set thread_confirmed=true
 *
 * SPECIAL
 *   GET    /simultaneous                    — all events active at a story-time moment + attendees
 *   POST   /auto-detect                     — Claude scans text for temporal markers; proposes event
 */
const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { optionalAuth, authenticateToken } = require('../middleware/auth');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

// ────────────────────────────────────────────────────────────────────────────
// MARKERS
// ────────────────────────────────────────────────────────────────────────────

// GET /markers
router.get('/markers', async (req, res) => {
  const { StoryClockMarker } = getModels(req);
  try {
    const where = {};
    if (req.query.series_id) where.series_id = req.query.series_id;
    const markers = await StoryClockMarker.findAll({
      where,
      order: [['sequence_order', 'ASC']],
    });
    res.json({ markers });
  } catch (err) {
    console.error('[Calendar] GET /markers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /markers
router.post('/markers', authenticateToken, async (req, res) => {
  const models = getModels(req);
  const { StoryClockMarker } = models;
  try {
    const { name, description, calendar_date, sequence_order, is_present, series_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Wrap in transaction to prevent race condition on is_present toggle
    const transaction = await models.sequelize.transaction();
    try {
      if (is_present && series_id) {
        await StoryClockMarker.update({ is_present: false }, {
          where: { series_id, is_present: true }, transaction,
        });
      }

      const marker = await StoryClockMarker.create({
        name, description, calendar_date,
        sequence_order: sequence_order || 0,
        is_present: is_present || false,
        series_id,
      }, { transaction });

      await transaction.commit();
      res.status(201).json({ marker });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[Calendar] POST /markers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /markers/:id/set-present
router.put('/markers/:id/set-present', authenticateToken, async (req, res) => {
  const models = getModels(req);
  const { StoryClockMarker } = models;
  try {
    const transaction = await models.sequelize.transaction();
    try {
      const marker = await StoryClockMarker.findByPk(req.params.id, { transaction, lock: true });
      if (!marker) { await transaction.rollback(); return res.status(404).json({ error: 'Marker not found' }); }

      if (marker.series_id) {
        await StoryClockMarker.update({ is_present: false }, {
          where: { series_id: marker.series_id, is_present: true }, transaction,
        });
      }
      marker.is_present = true;
      await marker.save({ transaction });
      await transaction.commit();
      res.json({ marker });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[Calendar] PUT /markers/:id/set-present error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// EVENTS
// ────────────────────────────────────────────────────────────────────────────

// GET /events
router.get('/events', async (req, res) => {
  const { StoryCalendarEvent, StoryClockMarker } = getModels(req);
  try {
    const where = {};
    if (req.query.series_id)         where.series_id = req.query.series_id;
    if (req.query.event_type)        where.event_type = req.query.event_type;
    if (req.query.story_position)    where.story_position = req.query.story_position;
    if (req.query.visibility)        where.visibility = req.query.visibility;
    if (req.query.cultural_category) where.cultural_category = req.query.cultural_category;
    if (req.query.severity_level)    where.severity_level = req.query.severity_level;
    if (req.query.is_micro_event !== undefined) {
      where.is_micro_event = req.query.is_micro_event === 'true';
    }

    const events = await StoryCalendarEvent.findAll({
      where,
      include: [{ model: StoryClockMarker, as: 'marker', attributes: ['id', 'name', 'sequence_order'] }],
      order: [['start_datetime', 'ASC']],
    });
    res.json({ events });
  } catch (err) {
    console.error('[Calendar] GET /events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /events
router.post('/events', authenticateToken, async (req, res) => {
  const { StoryCalendarEvent } = getModels(req);
  try {
    const {
      title, event_type, start_datetime, end_datetime,
      is_recurring, recurrence_pattern, location_name, location_address,
      lalaverse_district, visibility, what_world_knows, what_only_we_know,
      logged_by, source_line_id, story_position, series_id,
    } = req.body;
    if (!title || !event_type || !start_datetime) {
      return res.status(400).json({ error: 'title, event_type, and start_datetime are required' });
    }
    const event = await StoryCalendarEvent.create({
      title, event_type, start_datetime, end_datetime,
      is_recurring: is_recurring || false,
      recurrence_pattern, location_name, location_address,
      lalaverse_district, visibility: visibility || 'public',
      what_world_knows, what_only_we_know,
      logged_by: logged_by || 'evoni',
      source_line_id, story_position, series_id,
    });
    res.status(201).json({ event });
  } catch (err) {
    console.error('[Calendar] POST /events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /events/:id
router.put('/events/:id', authenticateToken, async (req, res) => {
  const { StoryCalendarEvent } = getModels(req);
  try {
    const event = await StoryCalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await event.update(req.body);
    res.json({ event });
  } catch (err) {
    console.error('[Calendar] PUT /events/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /events/:id
router.delete('/events/:id', authenticateToken, async (req, res) => {
  const { StoryCalendarEvent } = getModels(req);
  try {
    const event = await StoryCalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await event.destroy();
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    console.error('[Calendar] DELETE /events/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// ATTENDEES
// ────────────────────────────────────────────────────────────────────────────

// GET /events/:id/attendees
router.get('/events/:id/attendees', async (req, res) => {
  const { CalendarEventAttendee, RegistryCharacter } = getModels(req);
  try {
    const attendees = await CalendarEventAttendee.findAll({
      where: { event_id: req.params.id },
      include: [{
        model: RegistryCharacter, as: 'character',
        attributes: ['id', 'selected_name', 'display_name', 'role_type'],
      }],
      order: [['created_at', 'ASC']],
    });
    res.json({ attendees });
  } catch (err) {
    console.error('[Calendar] GET /events/:id/attendees error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /events/:id/attendees
router.post('/events/:id/attendees', authenticateToken, async (req, res) => {
  const { CalendarEventAttendee, StoryCalendarEvent } = getModels(req);
  try {
    const event = await StoryCalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { character_id, feed_profile_id, attendee_type, knew_about_event_before, left_early, what_they_experienced, author_note } = req.body;
    if (!character_id && !feed_profile_id) {
      return res.status(400).json({ error: 'character_id or feed_profile_id required' });
    }
    if (!attendee_type) {
      return res.status(400).json({ error: 'attendee_type required' });
    }
    const attendee = await CalendarEventAttendee.create({
      event_id: req.params.id,
      character_id, feed_profile_id, attendee_type,
      knew_about_event_before, left_early,
      what_they_experienced, author_note,
    });
    res.status(201).json({ attendee });
  } catch (err) {
    console.error('[Calendar] POST /events/:id/attendees error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /events/:id/attendees/:attendeeId
router.put('/events/:id/attendees/:attendeeId', authenticateToken, async (req, res) => {
  const { CalendarEventAttendee } = getModels(req);
  try {
    const attendee = await CalendarEventAttendee.findOne({
      where: { id: req.params.attendeeId, event_id: req.params.id },
    });
    if (!attendee) return res.status(404).json({ error: 'Attendee not found' });
    await attendee.update(req.body);
    res.json({ attendee });
  } catch (err) {
    console.error('[Calendar] PUT attendee error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// RIPPLES
// ────────────────────────────────────────────────────────────────────────────

// POST /events/:id/ripples/generate — Amber generates ripple threads via Claude
router.post('/events/:id/ripples/generate', authenticateToken, async (req, res) => {
  const models = getModels(req);
  const { StoryCalendarEvent, CalendarEventAttendee, CalendarEventRipple, RegistryCharacter } = models;
  try {
    const event = await StoryCalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Get all attendees with character details
    const attendees = await CalendarEventAttendee.findAll({
      where: { event_id: event.id },
      include: [{ model: RegistryCharacter, as: 'character' }],
    });

    if (attendees.length === 0) {
      return res.json({ ripples: [], message: 'No attendees to generate ripples for' });
    }

    // Build context for Claude
    const attendeeContext = attendees
      .filter(a => a.character)
      .map(a => `- ${a.character.selected_name || a.character.display_name} (${a.attendee_type}): ${a.what_they_experienced || 'no details'}`)
      .join('\n');

    let proposals = [];
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are Amber, production intelligence for a narrative fiction project called "Before Lala". You generate ripple thread proposals — short story threads that describe how an event propagates through the world and affects characters who weren't necessarily present. Each proposal is 2–3 sentences.

Return a JSON array of objects: [{"affected_character_name": "...", "ripple_type": "witnessed|heard_secondhand|affected_by_outcome|doesnt_know_yet", "dimension": "ambition|desire|visibility|grief|class|body|habits|belonging", "intensity": 1-10, "thread": "..."}]`,
        messages: [{
          role: 'user',
          content: `Event: "${event.title}" (${event.event_type})
Location: ${event.location_name || 'unknown'}, ${event.lalaverse_district || 'unknown district'}
What the world knows: ${event.what_world_knows || 'nothing public yet'}
What actually happened: ${event.what_only_we_know || 'same as public'}

Attendees:
${attendeeContext}

Generate ripple proposals for characters who may be affected — consider who was there, who heard about it, who is affected by the outcome, and who doesn't know yet. Return JSON array only.`,
        }],
      });

      const text = response.content[0]?.text || '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      proposals = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (aiErr) {
      console.warn('[Calendar] Claude ripple generation failed, using empty proposals:', aiErr.message);
      proposals = [];
    }

    // Save proposals as unconfirmed ripples
    const ripples = [];
    for (const p of proposals) {
      const ripple = await CalendarEventRipple.create({
        event_id: event.id,
        affected_character_id: attendees.find(a =>
          a.character && (a.character.selected_name === p.affected_character_name || a.character.display_name === p.affected_character_name)
        )?.character_id || null,
        ripple_type: p.ripple_type || 'heard_secondhand',
        deep_profile_dimension: p.dimension || null,
        intensity: p.intensity || 5,
        proposed_thread: p.thread,
        thread_confirmed: false,
      });
      ripples.push(ripple);
    }

    res.json({ ripples, count: ripples.length });
  } catch (err) {
    console.error('[Calendar] POST ripples/generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /ripples/:id/confirm
router.put('/ripples/:id/confirm', authenticateToken, async (req, res) => {
  const { CalendarEventRipple } = getModels(req);
  try {
    const ripple = await CalendarEventRipple.findByPk(req.params.id);
    if (!ripple) return res.status(404).json({ error: 'Ripple not found' });
    ripple.thread_confirmed = true;
    await ripple.save();
    res.json({ ripple });
  } catch (err) {
    console.error('[Calendar] PUT /ripples/:id/confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// SPECIAL QUERIES
// ────────────────────────────────────────────────────────────────────────────

// GET /simultaneous — alibi view: all events active at a story-time moment
router.get('/simultaneous', async (req, res) => {
  const { StoryCalendarEvent, CalendarEventAttendee, RegistryCharacter } = getModels(req);
  try {
    const { datetime } = req.query;
    if (!datetime) return res.status(400).json({ error: 'datetime query param required' });

    const moment = new Date(datetime);
    const events = await StoryCalendarEvent.findAll({
      where: {
        start_datetime: { [Op.lte]: moment },
        [Op.or]: [
          { end_datetime: { [Op.gte]: moment } },
          { end_datetime: null },
        ],
      },
      include: [{
        model: CalendarEventAttendee, as: 'attendees',
        include: [{
          model: RegistryCharacter, as: 'character',
          attributes: ['id', 'selected_name', 'display_name', 'role_type'],
        }],
      }],
      order: [['start_datetime', 'ASC']],
    });
    res.json({ datetime, events, count: events.length });
  } catch (err) {
    console.error('[Calendar] GET /simultaneous error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /auto-detect — Claude scans text for temporal markers, proposes event
router.post('/auto-detect', authenticateToken, async (req, res) => {
  try {
    const { line_text, series_id } = req.body;
    if (!line_text) return res.status(400).json({ error: 'line_text required' });

    let proposal = null;
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You are Amber, production intelligence for a narrative fiction project. You scan approved storyteller lines for temporal markers and propose calendar events.

If the text contains temporal markers (day names, dates, 'that night', 'the morning after', relative time references), return a JSON object:
{"detected": true, "title": "...", "event_type": "world_event|story_event|character_event", "suggested_datetime": "YYYY-MM-DDTHH:mm:ss", "location": "...", "characters_mentioned": ["..."], "confidence": 0.0-1.0}

If no temporal markers detected: {"detected": false}

The story is set in year 8385. Use real months/days but year 8385.`,
        messages: [{
          role: 'user',
          content: `Scan this approved line for temporal markers:\n\n"${line_text}"`,
        }],
      });

      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      proposal = jsonMatch ? JSON.parse(jsonMatch[0]) : { detected: false };
    } catch (aiErr) {
      console.warn('[Calendar] Claude auto-detect failed:', aiErr.message);
      proposal = { detected: false, error: 'AI unavailable' };
    }

    // NEVER auto-write — return proposal for author review
    res.json({ proposal, series_id, note: 'Proposal only — requires author confirmation to create event' });
  } catch (err) {
    console.error('[Calendar] POST /auto-detect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /events/:id/spawn-world-event — Create a world event from a calendar event
// ═══════════════════════════════════════════════════════════════════════

router.post('/events/:id/spawn-world-event', authenticateToken, async (req, res) => {
  try {
    const models = getModels(req);
    const { StoryCalendarEvent, WorldEvent, WorldLocation } = models;

    if (!StoryCalendarEvent) return res.status(500).json({ error: 'StoryCalendarEvent model not loaded' });

    const calendarEvent = await StoryCalendarEvent.findByPk(req.params.id, {
      include: WorldLocation ? [{ model: WorldLocation, as: 'location' }] : [],
    });
    if (!calendarEvent) return res.status(404).json({ error: 'Calendar event not found' });

    // Build world event from calendar event data
    const {
      show_id,
      event_name: _event_name, name: _eventName, event_type: _ceType,
      // Override fields from request body
    } = req.body;

    if (!show_id) return res.status(400).json({ error: 'show_id is required — which show should this event belong to?' });

    // Resolve venue from calendar event's location
    const venue = calendarEvent.location || null;
    const venueAddress = venue
      ? [venue.street_address, venue.district, venue.city].filter(Boolean).join(', ')
      : calendarEvent.location_address || null;

    // Map calendar event_type to world event_type
    const typeMap = {
      'lalaverse_cultural': 'invite',
      'world_event': 'invite',
      'story_event': 'invite',
      'character_event': 'guest',
    };

    if (WorldEvent) {
      const worldEvent = await WorldEvent.create({
        show_id,
        name: req.body.name || calendarEvent.title,
        event_type: req.body.event_type || typeMap[calendarEvent.event_type] || 'invite',
        host: req.body.host || null,
        host_brand: req.body.host_brand || null,
        description: req.body.description || calendarEvent.what_world_knows || calendarEvent.title,
        venue_location_id: calendarEvent.location_id || null,
        venue_name: req.body.venue_name || venue?.name || calendarEvent.location_name || null,
        venue_address: req.body.venue_address || venueAddress || null,
        event_date: req.body.event_date || (calendarEvent.start_datetime ? new Date(calendarEvent.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null),
        event_time: req.body.event_time || null,
        location_hint: calendarEvent.location_name || calendarEvent.lalaverse_district || null,
        dress_code: req.body.dress_code || null,
        prestige: req.body.prestige || Math.min(10, (calendarEvent.severity_level || 5) + 2),
        narrative_stakes: req.body.narrative_stakes || calendarEvent.what_only_we_know || null,
        source_calendar_event_id: calendarEvent.id,
        scene_set_id: req.body.scene_set_id || null,
        status: 'draft',
      });

      return res.status(201).json({
        success: true,
        event: worldEvent.toJSON(),
        source: {
          calendar_event_id: calendarEvent.id,
          calendar_event_title: calendarEvent.title,
        },
      });
    }

    // Fallback: raw SQL if WorldEvent model not available
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO world_events (id, show_id, name, event_type, description, location_hint, source_calendar_event_id, status, created_at, updated_at)
       VALUES (:id, :show_id, :name, :event_type, :desc, :location_hint, :source_id, 'draft', NOW(), NOW())`,
      {
        replacements: {
          id, show_id,
          name: req.body.name || calendarEvent.title,
          event_type: req.body.event_type || 'invite',
          desc: calendarEvent.what_world_knows || calendarEvent.title,
          location_hint: calendarEvent.location_name || null,
          source_id: calendarEvent.id,
        },
      }
    );

    res.status(201).json({ success: true, event: { id, name: req.body.name || calendarEvent.title }, source: { calendar_event_id: calendarEvent.id } });
  } catch (err) {
    console.error('POST /events/:id/spawn-world-event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /events/:id/spawned — List world events spawned from a calendar event
// ═══════════════════════════════════════════════════════════════════════

router.get('/events/:id/spawned', authenticateToken, async (req, res) => {
  try {
    const models = getModels(req);
    if (models.WorldEvent) {
      const events = await models.WorldEvent.findAll({
        where: { source_calendar_event_id: req.params.id },
        order: [['created_at', 'DESC']],
      });
      return res.json({ success: true, events });
    }

    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE source_calendar_event_id = :id ORDER BY created_at DESC`,
      { replacements: { id: req.params.id } }
    );
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /events/:id/auto-spawn — Auto-generate world events from calendar
// Uses AI matching: picks host from feed, venue from locations, builds guest list
// ═══════════════════════════════════════════════════════════════════════

router.post('/events/:id/auto-spawn', authenticateToken, async (req, res) => {
  try {
    const models = getModels(req);
    const { StoryCalendarEvent } = models;
    if (!StoryCalendarEvent) return res.status(500).json({ error: 'Calendar model not loaded' });

    const calendarEvent = await StoryCalendarEvent.findByPk(req.params.id);
    if (!calendarEvent) return res.status(404).json({ error: 'Calendar event not found' });

    const { show_id, event_count = 1, max_guests = 8 } = req.body;
    if (!show_id) return res.status(400).json({ error: 'show_id is required' });

    const eventAutomation = require('../services/eventAutomationService');
    const events = await eventAutomation.spawnEventsFromCalendar(
      calendarEvent, show_id, models,
      { eventCount: Math.min(3, parseInt(event_count) || 1), maxGuests: parseInt(max_guests) || 8 }
    );

    res.status(201).json({
      success: true,
      data: {
        events_created: events.length,
        events,
        source: { calendar_event_id: calendarEvent.id, title: calendarEvent.title },
      },
    });
  } catch (err) {
    console.error('POST /events/:id/auto-spawn error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /events/generate-seasonal — Auto-generate seasonal events for a month
// ═══════════════════════════════════════════════════════════════════════

router.post('/events/generate-seasonal', authenticateToken, async (req, res) => {
  try {
    const { month, count = 4, year = 2026, show_id } = req.body;
    if (month === undefined || month < 0 || month > 11) {
      return res.status(400).json({ error: 'month is required (0-11)' });
    }

    const seasonalService = require('../services/seasonalEventService');
    const models = getModels(req);
    const result = await seasonalService.generateSeasonalEvents(month, show_id, models, { count, year });

    res.status(201).json({
      success: true,
      data: result,
      message: `Generated ${result.count} seasonal events for ${result.month}`,
    });
  } catch (err) {
    console.error('POST /events/generate-seasonal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /events/feed-templates — Get feed event templates with seasonal affinities
// ═══════════════════════════════════════════════════════════════════════

router.get('/events/feed-templates', (req, res) => {
  const seasonalService = require('../services/seasonalEventService');
  const month = req.query.month !== undefined ? parseInt(req.query.month) : new Date().getMonth();
  const relevant = seasonalService.getRelevantTemplates(month);
  res.json({
    success: true,
    data: {
      all: seasonalService.FEED_EVENT_TEMPLATES,
      relevant,
      month,
      seasons: seasonalService.MONTH_SEASONS[month] || [],
    },
  });
});

module.exports = router;
