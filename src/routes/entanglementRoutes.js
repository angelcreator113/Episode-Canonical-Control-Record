'use strict';
/**
 * entanglementRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   const entanglementRoutes = require('./routes/entanglementRoutes');
 *   app.use('/api/v1/entanglements', entanglementRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Routes:
 *
 * ENTANGLEMENTS
 *   GET    /characters/:characterId/entanglements     — all entanglements for a character
 *   GET    /profiles/:profileId/orbit                 — all characters entangled with a profile
 *   POST   /characters/:characterId/entanglements     — create entanglement (or Amber proposes)
 *   PATCH  /entanglements/:id                         — update dimension, intensity, type, notes
 *   DELETE /entanglements/:id                         — deactivate (soft delete)
 *
 * STATE CHANGES (triggers ripple)
 *   PATCH  /profiles/:profileId/state                 — change influencer state → fires ripple
 *
 * EVENTS
 *   GET    /events                                     — all unresolved events (Pressure Dashboard)
 *   GET    /events/:id                                 — single event with proposals
 *   POST   /events/:id/resolve                         — resolve event + clear turbulence flags
 *   POST   /events/:eventId/proposals/:characterId/approve — approve a scene proposal → StoryTeller
 *
 * UNFOLLOWS
 *   GET    /characters/:characterId/unfollows          — all unfollows for a character
 *   POST   /characters/:characterId/unfollows          — log an unfollow
 *   PATCH  /unfollows/:id/confirm                      — author confirms reason + visibility
 */
const express  = require('express');
const router   = express.Router();
const { Op }   = require('sequelize');
const { optionalAuth } = require('../middleware/auth');
const { fireRipple, resolveEvent } = require('../services/rippleEngine');

// Apply optionalAuth to all routes
router.use(optionalAuth);

// ── Helper: load models ──────────────────────────────────────────────────────
function getModels(req) {
  return req.app.get('models') || require('../models');
}

// ────────────────────────────────────────────────────────────────────────────
// ENTANGLEMENTS
// ────────────────────────────────────────────────────────────────────────────

// GET /characters/:characterId/entanglements
router.get('/characters/:characterId/entanglements', async (req, res) => {
  const models = getModels(req);
  const { CharacterEntanglement, SocialProfile } = models;
  try {
    const entanglements = await CharacterEntanglement.findAll({
      where:   { character_id: req.params.characterId },
      include: [{ model: SocialProfile, as: 'profile',
        attributes: ['id', 'handle', 'display_name', 'platform', 'current_state', 'follower_count'] }],
      order:   [['intensity', 'DESC'], ['created_at', 'ASC']],
    });
    res.json({ entanglements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /profiles/:profileId/orbit
router.get('/profiles/:profileId/orbit', async (req, res) => {
  const models = getModels(req);
  const { CharacterEntanglement, RegistryCharacter } = models;
  try {
    const orbit = await CharacterEntanglement.findAll({
      where:   { profile_id: req.params.profileId, is_active: true },
      include: [{ model: RegistryCharacter, as: 'character',
        attributes: ['id', 'selected_name', 'role_type'] }],
      order:   [['intensity', 'DESC']],
    });
    res.json({ orbit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /characters/:characterId/entanglements
router.post('/characters/:characterId/entanglements', async (req, res) => {
  const models = getModels(req);
  const { CharacterEntanglement } = models;
  const { characterId: character_id } = req.params;
  const {
    profile_id, dimension, intensity, directionality,
    entanglement_type, notes, amber_proposed,
  } = req.body;

  if (!profile_id || !dimension || !intensity || !entanglement_type) {
    return res.status(400).json({ error: 'profile_id, dimension, intensity, entanglement_type required' });
  }

  try {
    const entanglement = await CharacterEntanglement.create({
      character_id,
      profile_id,
      dimension,
      intensity,
      directionality:    directionality    || 'character_knows',
      entanglement_type,
      notes:             notes             || null,
      amber_proposed:    amber_proposed    || false,
      is_active:         true,
    });
    res.status(201).json({ entanglement });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Entanglement of this type already exists for this character-profile pair.' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /entanglements/:id
router.patch('/entanglements/:id', async (req, res) => {
  const models = getModels(req);
  const { CharacterEntanglement } = models;
  const allowed = ['dimension', 'intensity', 'directionality', 'entanglement_type', 'notes', 'is_active', 'amber_proposed'];

  try {
    const entanglement = await CharacterEntanglement.findByPk(req.params.id);
    if (!entanglement) return res.status(404).json({ error: 'Not found' });

    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await entanglement.update(updates);
    res.json({ entanglement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /entanglements/:id  (soft delete — sets is_active false)
router.delete('/entanglements/:id', async (req, res) => {
  const models = getModels(req);
  const { CharacterEntanglement } = models;

  try {
    const entanglement = await CharacterEntanglement.findByPk(req.params.id);
    if (!entanglement) return res.status(404).json({ error: 'Not found' });

    await entanglement.update({ is_active: false });
    res.json({ message: 'Entanglement deactivated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// STATE CHANGES — triggers ripple engine
// ────────────────────────────────────────────────────────────────────────────

// PATCH /profiles/:profileId/state
router.patch('/profiles/:profileId/state', async (req, res) => {
  const models = getModels(req);
  const { SocialProfile } = models;
  const { new_state } = req.body;

  const validStates = ['rising','peaking','plateauing','controversial','cancelled','reinventing','gone_dark','posthumous'];
  if (!new_state || !validStates.includes(new_state)) {
    return res.status(400).json({ error: `new_state must be one of: ${validStates.join(', ')}` });
  }

  try {
    const profile = await SocialProfile.findByPk(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const previousState = profile.current_state;

    // Update the profile state
    await profile.update({
      previous_state:   previousState,
      current_state:    new_state,
      state_changed_at: new Date(),
    });

    // Fire the ripple — this is the automation
    const rippleResult = await fireRipple({ profile, previousState, models });

    res.json({
      profile,
      ripple: {
        event:          rippleResult.event?.id || null,
        affected:       rippleResult.affected,
        proposals:      rippleResult.proposals,
        message:        rippleResult.affected > 0
          ? `${rippleResult.affected} character(s) flagged. ${rippleResult.proposals.length} scene proposal(s) generated.`
          : 'No characters affected.',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// EVENTS (Narrative Pressure Dashboard data)
// ────────────────────────────────────────────────────────────────────────────

// GET /events  — unresolved events for the dashboard
router.get('/events', async (req, res) => {
  const models = getModels(req);
  const { EntanglementEvent, SocialProfile } = models;
  const { resolved = 'false' } = req.query;

  try {
    const events = await EntanglementEvent.findAll({
      where:   { resolved: resolved === 'true' },
      include: [{ model: SocialProfile, as: 'profile',
        attributes: ['id', 'handle', 'display_name', 'platform', 'current_state'] }],
      order:   [['created_at', 'DESC']],
      limit:   50,
    });
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /events/:id
router.get('/events/:id', async (req, res) => {
  const models = getModels(req);
  const { EntanglementEvent, SocialProfile } = models;

  try {
    const event = await EntanglementEvent.findByPk(req.params.id, {
      include: [{ model: SocialProfile, as: 'profile' }],
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /events/:id/resolve
router.post('/events/:id/resolve', async (req, res) => {
  const models = getModels(req);
  try {
    const event = await resolveEvent({ eventId: req.params.id, models });
    res.json({ event, message: 'Event resolved. Turbulence flags cleared.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /events/:eventId/proposals/:characterId/approve
// Approve a scene proposal → sends to StoryTeller as pending line
router.post('/events/:eventId/proposals/:characterId/approve', async (req, res) => {
  const models = getModels(req);
  const { EntanglementEvent } = models;
  const { book_id, chapter_id } = req.body;

  try {
    const event = await EntanglementEvent.findByPk(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const proposals = event.scene_proposals || [];
    const proposal  = proposals.find(p => p.character_id === req.params.characterId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found for this character' });

    // Mark proposal approved
    proposal.approved = true;
    await event.update({ scene_proposals: proposals });

    // If book_id + chapter_id provided, create a StoryTeller pending line
    if (book_id && chapter_id && models.StorytellerLine) {
      await models.StorytellerLine.create({
        book_id,
        chapter_id,
        content:     `[SCENE BRIEF — from entanglement event]\n\n${proposal.brief}`,
        status:      'pending',
        source:      'amber_entanglement',
        character:   proposal.character_name,
      });
    }

    res.json({ proposal, message: 'Scene proposal approved.' + (book_id ? ' Sent to StoryTeller.' : '') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// UNFOLLOWS
// ────────────────────────────────────────────────────────────────────────────

// GET /characters/:characterId/unfollows
router.get('/characters/:characterId/unfollows', async (req, res) => {
  const models = getModels(req);
  const { EntanglementUnfollow, SocialProfile } = models;

  try {
    const unfollows = await EntanglementUnfollow.findAll({
      where:   { character_id: req.params.characterId },
      include: [{ model: SocialProfile, as: 'profile',
        attributes: ['id', 'handle', 'display_name', 'platform', 'current_state'] }],
      order:   [['created_at', 'DESC']],
    });
    res.json({ unfollows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /characters/:characterId/unfollows
router.post('/characters/:characterId/unfollows', async (req, res) => {
  const models = getModels(req);
  const { EntanglementUnfollow, CharacterEntanglement } = models;
  const { profile_id, reason, story_timestamp, visibility, noticed_by } = req.body;

  if (!profile_id) return res.status(400).json({ error: 'profile_id required' });

  try {
    // Deactivate the entanglement
    await CharacterEntanglement.update(
      { is_active: false },
      { where: { character_id: req.params.characterId, profile_id } }
    );

    const unfollow = await EntanglementUnfollow.create({
      character_id:     req.params.characterId,
      profile_id,
      reason:           reason           || null,
      story_timestamp:  story_timestamp  || null,
      visibility:       visibility       || 'unnoticed',
      noticed_by:       noticed_by       || [],
      author_confirmed: !!reason,  // confirmed if reason was provided
    });

    res.status(201).json({ unfollow, message: 'Unfollow logged. Entanglement deactivated.' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Unfollow already logged for this character-profile pair.' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /unfollows/:id/confirm
router.patch('/unfollows/:id/confirm', async (req, res) => {
  const models = getModels(req);
  const { EntanglementUnfollow } = models;
  const { reason, visibility, story_timestamp, noticed_by } = req.body;

  try {
    const unfollow = await EntanglementUnfollow.findByPk(req.params.id);
    if (!unfollow) return res.status(404).json({ error: 'Unfollow not found' });

    await unfollow.update({
      reason:           reason           || unfollow.reason,
      visibility:       visibility       || unfollow.visibility,
      story_timestamp:  story_timestamp  || unfollow.story_timestamp,
      noticed_by:       noticed_by       || unfollow.noticed_by,
      author_confirmed: true,
    });

    res.json({ unfollow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
