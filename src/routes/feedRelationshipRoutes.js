'use strict';
/**
 * feedRelationshipRoutes.js — Feed Relationship Map
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/feed-relationships', feedRelationshipRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /              — list; query: influencer_a_id, type
 * POST   /              — create
 * PUT    /:id           — update
 * DELETE /:id           — delete
 * GET    /canvas        — nodes + edges formatted for SVG renderer
 * POST   /:id/generate-ripples — generate caught-in-middle flags
 */
const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

const EDGE_STYLES = {
  beef:             { color: '#ef4444', dash: '6,4', label: 'beef' },
  collab:           { color: '#22c55e', dash: null,   label: 'collab' },
  silent_alliance:  { color: '#9ca3af', dash: '2,4', label: 'silent alliance' },
  mentor:           { color: '#3b82f6', dash: null,   label: 'mentor' },
  orbit:            { color: '#9ca3af', dash: null,   label: 'orbit', arrow: true },
  public_shade:     { color: '#f59e0b', dash: '6,4', label: 'shade' },
  copy_cat:         { color: '#a855f7', dash: '4,4', label: 'copycat' },
  former_friends:   { color: '#ef4444', dash: '8,4', label: 'former friends' },
  competitors:      { color: '#f97316', dash: null,   label: 'competitors' },
};

// GET /
router.get('/', async (req, res) => {
  const { FeedProfileRelationship, SocialProfile } = getModels(req);
  try {
    const where = {};
    if (req.query.influencer_a_id) where.influencer_a_id = req.query.influencer_a_id;
    if (req.query.type)            where.relationship_type = req.query.type;

    const relationships = await FeedProfileRelationship.findAll({
      where,
      include: [
        { model: SocialProfile, as: 'influencerA', attributes: ['id', 'handle', 'display_name', 'platform', 'current_state'] },
        { model: SocialProfile, as: 'influencerB', attributes: ['id', 'handle', 'display_name', 'platform', 'current_state'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ relationships });
  } catch (err) {
    console.error('[FeedRelationships] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  const { FeedProfileRelationship } = getModels(req);
  try {
    const { influencer_a_id, influencer_b_id, relationship_type, is_public, story_position, notes } = req.body;
    if (!influencer_a_id || !influencer_b_id || !relationship_type) {
      return res.status(400).json({ error: 'influencer_a_id, influencer_b_id, and relationship_type required' });
    }
    const rel = await FeedProfileRelationship.create({
      influencer_a_id, influencer_b_id, relationship_type,
      is_public: is_public !== undefined ? is_public : true,
      story_position, notes,
    });
    res.status(201).json({ relationship: rel });
  } catch (err) {
    console.error('[FeedRelationships] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  const { FeedProfileRelationship } = getModels(req);
  try {
    const rel = await FeedProfileRelationship.findByPk(req.params.id);
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });
    await rel.update(req.body);
    res.json({ relationship: rel });
  } catch (err) {
    console.error('[FeedRelationships] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  const { FeedProfileRelationship } = getModels(req);
  try {
    const rel = await FeedProfileRelationship.findByPk(req.params.id);
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });
    await rel.destroy();
    res.json({ success: true, message: 'Relationship deleted' });
  } catch (err) {
    console.error('[FeedRelationships] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /canvas — nodes + edges for SVG renderer
router.get('/canvas', async (req, res) => {
  const { FeedProfileRelationship, SocialProfile } = getModels(req);
  try {
    const relationships = await FeedProfileRelationship.findAll({
      include: [
        { model: SocialProfile, as: 'influencerA', attributes: ['id', 'handle', 'display_name', 'platform', 'current_state', 'archetype'] },
        { model: SocialProfile, as: 'influencerB', attributes: ['id', 'handle', 'display_name', 'platform', 'current_state', 'archetype'] },
      ],
    });

    // Collect unique nodes
    const nodeMap = new Map();
    for (const rel of relationships) {
      if (rel.influencerA && !nodeMap.has(rel.influencerA.id)) {
        nodeMap.set(rel.influencerA.id, {
          id: rel.influencerA.id,
          handle: rel.influencerA.handle,
          display_name: rel.influencerA.display_name,
          platform: rel.influencerA.platform,
          state: rel.influencerA.current_state,
          archetype: rel.influencerA.archetype,
        });
      }
      if (rel.influencerB && !nodeMap.has(rel.influencerB.id)) {
        nodeMap.set(rel.influencerB.id, {
          id: rel.influencerB.id,
          handle: rel.influencerB.handle,
          display_name: rel.influencerB.display_name,
          platform: rel.influencerB.platform,
          state: rel.influencerB.current_state,
          archetype: rel.influencerB.archetype,
        });
      }
    }

    const edges = relationships.map(r => ({
      id: r.id,
      source: r.influencer_a_id,
      target: r.influencer_b_id,
      type: r.relationship_type,
      is_public: r.is_public,
      style: EDGE_STYLES[r.relationship_type] || EDGE_STYLES.orbit,
    }));

    res.json({ nodes: Array.from(nodeMap.values()), edges });
  } catch (err) {
    console.error('[FeedRelationships] GET /canvas error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/generate-ripples — caught-in-middle flags for beef/former_friends
router.post('/:id/generate-ripples', async (req, res) => {
  const models = getModels(req);
  const { FeedProfileRelationship, CharacterEntanglement, RegistryCharacter, SocialProfile } = models;
  try {
    const rel = await FeedProfileRelationship.findByPk(req.params.id, {
      include: [
        { model: SocialProfile, as: 'influencerA' },
        { model: SocialProfile, as: 'influencerB' },
      ],
    });
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });

    // Find characters entangled with BOTH influencers
    const entangledA = await CharacterEntanglement.findAll({
      where: { profile_id: rel.influencer_a_id, is_active: true },
      attributes: ['character_id'],
    });
    const entangledB = await CharacterEntanglement.findAll({
      where: { profile_id: rel.influencer_b_id, is_active: true },
      attributes: ['character_id'],
    });
    const idsA = new Set(entangledA.map(e => e.character_id));
    const caughtIds = entangledB.filter(e => idsA.has(e.character_id)).map(e => e.character_id);

    if (caughtIds.length === 0) {
      return res.json({ flags: [], message: 'No characters entangled with both parties' });
    }

    const characters = await RegistryCharacter.findAll({
      where: { id: caughtIds },
      attributes: ['id', 'selected_name', 'display_name', 'role_type'],
    });

    const handleA = rel.influencerA?.handle || 'Profile A';
    const handleB = rel.influencerB?.handle || 'Profile B';
    const flags = characters.map(c => ({
      character_id: c.id,
      character_name: c.selected_name || c.display_name,
      flag: `Caught in the middle between @${handleA} and @${handleB}. Which side does this character choose, and what does that choice cost?`,
      relationship_type: rel.relationship_type,
    }));

    res.json({ flags, count: flags.length, note: 'Surface on Dashboard Pressure Wave for Evoni review' });
  } catch (err) {
    console.error('[FeedRelationships] generate-ripples error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
