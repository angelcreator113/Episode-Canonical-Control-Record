'use strict';
/**
 * feedRelationshipRoutes.js — Feed Relationship Map
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/feed-relationships', feedRelationshipRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /              — list; query: influencer_a_id (either side), type
 * POST   /              — create
 * PUT    /:id           — update
 * DELETE /:id           — delete
 * GET    /canvas        — nodes + edges formatted for SVG renderer; with
 *                          ?show_id=, each edge's Pulse closeness (read only)
 * POST   /:id/generate-ripples — generate caught-in-middle flags
 * GET    /suggestions   — suggested pairs waiting for Evoni (services/pairSuggestions)
 * POST   /suggestions   — { limit? }: new ones, by audience overlap and one AI call (ADMIN)
 * POST   /suggestions/:key/keep    — { type?, why?, drama_level? }: make it a relationship (ADMIN)
 * POST   /suggestions/:key/dismiss — never suggest this pair again (ADMIN)
 * POST   /:id/storyline-seed — { show_id }: a title and premise for a Pulse
 *                          storyline between the pair; nothing saved
 *                          (services/pairStorylines; ADMIN)
 *
 * Since Task #3115 (Evoni, 2026-10-13: "go with (a)") the map reads and edits
 * social_profile_relationships, the table The Pulse reads for the kind of
 * relationship and its closeness: an edit here changes The Pulse.
 * feed_profile_relationships, the old table, was copied over by migration
 * 20261013130000 and dropped by 20261023230000 (Evoni, 2026-10-23: "feed
 * profiles and pulse profiles should be the same thing now"). The responses
 * keep the map's old field names (influencer_a_id, influencerA, is_public,
 * notes) so the pages read as before; the API path stays /feed-relationships.
 * A Pulse pair between two people with registry characters is linked to
 * their story pair (character_relationship_id, services/relationshipTruth).
 */
const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

router.use(requireAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

const { RELATIONSHIP_KINDS, CONFLICT_KINDS } = require('../utils/relationshipKinds');
const KINDS = new Set(RELATIONSHIP_KINDS);

const EDGE_STYLES = {
  collab:         { color: '#22c55e', dash: null,  label: 'collab' },
  bestie:         { color: '#16a34a', dash: null,  label: 'bestie' },
  mentor:         { color: '#3b82f6', dash: null,  label: 'mentor' },
  management:     { color: '#0ea5e9', dash: '2,4', label: 'management' },
  family:         { color: '#6366f1', dash: null,  label: 'family' },
  couple:         { color: '#ec4899', dash: null,  label: 'couple' },
  situationship:  { color: '#f472b6', dash: '4,4', label: 'situationship' },
  ex:             { color: '#db2777', dash: '8,4', label: 'ex' },
  baby_daddy:     { color: '#be185d', dash: null,  label: 'baby daddy' },
  baby_mama:      { color: '#be185d', dash: null,  label: 'baby mama' },
  rival:          { color: '#f97316', dash: null,  label: 'rival' },
  feud:           { color: '#ef4444', dash: '6,4', label: 'feud' },
  shade:          { color: '#f59e0b', dash: '6,4', label: 'shade' },
  former_friends: { color: '#ef4444', dash: '8,4', label: 'former friends' },
  copycat:        { color: '#a855f7', dash: '4,4', label: 'copycat' },
  secret_link:    { color: '#9ca3af', dash: '2,4', label: 'secret link' },
  orbit:          { color: '#9ca3af', dash: null,  label: 'orbit', arrow: true },
};

const PROFILE_ATTRS = ['id', 'handle', 'display_name', 'platform', 'current_state'];
const CANVAS_ATTRS = [...PROFILE_ATTRS, 'archetype', 'visibility_tier'];
const includes = (SocialProfile, attributes) => [
  { model: SocialProfile, as: 'sourceProfile', attributes },
  { model: SocialProfile, as: 'targetProfile', attributes },
];

/**
 * A row in the map's field names, with The Pulse's own fields alongside;
 * is_conflict marks the kinds the Pressure Wave lists for ripples.
 */
function asMapRow(rel) {
  const r = rel.get({ plain: true });
  return {
    ...r,
    influencer_a_id: r.source_profile_id,
    influencer_b_id: r.target_profile_id,
    influencerA: r.sourceProfile || null,
    influencerB: r.targetProfile || null,
    is_public: r.public_visibility !== 'hidden',
    notes: r.description,
    is_conflict: CONFLICT_KINDS.includes(r.relationship_type),
  };
}

const asId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** Another row of this kind for the pair, either way round (the table's unique index is one way only). */
function findTwin(SocialProfileRelationship, a, b, type, exceptId) {
  const where = {
    relationship_type: type,
    [Op.or]: [
      { source_profile_id: a, target_profile_id: b },
      { source_profile_id: b, target_profile_id: a },
    ],
  };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  return SocialProfileRelationship.findOne({ where });
}

// GET /
// ── Suggested pairs (Evoni's idea 4, PR 2; services/pairSuggestions) ──────
// Creators who share or compete for an audience but have no relationship
// yet. Nothing is made until Evoni keeps one.
const pairError = (res, err) => {
  const { PairError } = require('../services/pairSuggestions');
  if (err instanceof PairError) { res.status(err.status).json({ success: false, error: err.message }); return true; }
  return false;
};

router.get('/suggestions', async (req, res) => {
  try {
    return res.json({ success: true, pairs: await require('../services/pairSuggestions').listPending(getModels(req)) });
  } catch (err) {
    console.error('[FeedRelationships] GET /suggestions error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/suggestions', authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const result = await require('../services/pairSuggestions').suggestPairs(getModels(req), { limit: req.body?.limit });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[FeedRelationships] POST /suggestions error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/suggestions/:key/keep', authorize(['ADMIN']), async (req, res) => {
  try {
    try {
      const rel = await require('../services/pairSuggestions').keepPair(getModels(req), req.params.key, req.body || {});
      return res.status(201).json({ success: true, relationship: rel });
    } catch (err) {
      if (pairError(res, err)) return undefined;
      throw err;
    }
  } catch (err) {
    console.error('[FeedRelationships] POST /suggestions/:key/keep error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/suggestions/:key/dismiss', authorize(['ADMIN']), async (req, res) => {
  try {
    try {
      await require('../services/pairSuggestions').dismissPair(getModels(req), req.params.key);
      return res.json({ success: true });
    } catch (err) {
      if (pairError(res, err)) return undefined;
      throw err;
    }
  } catch (err) {
    console.error('[FeedRelationships] POST /suggestions/:key/dismiss error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { SocialProfileRelationship, SocialProfile } = getModels(req);
  try {
    const where = {};
    if (req.query.influencer_a_id) {
      const id = asId(req.query.influencer_a_id);
      if (!id) return res.status(400).json({ error: 'influencer_a_id must be a profile id.' });
      where[Op.or] = [{ source_profile_id: id }, { target_profile_id: id }];
    }
    if (req.query.type) where.relationship_type = req.query.type;
    if (where.relationship_type && !KINDS.has(where.relationship_type)) {
      return res.status(400).json({ error: `type must be one of: ${RELATIONSHIP_KINDS.join(', ')}` });
    }

    const relationships = await SocialProfileRelationship.findAll({
      where,
      include: includes(SocialProfile, PROFILE_ATTRS),
      order: [['created_at', 'DESC']],
    });
    res.json({ relationships: relationships.map(asMapRow) });
  } catch (err) {
    console.error('[FeedRelationships] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  const { SocialProfileRelationship, SocialProfile } = getModels(req);
  try {
    const { relationship_type, is_public, notes } = req.body || {};
    const a = asId(req.body?.influencer_a_id);
    const b = asId(req.body?.influencer_b_id);
    if (!a || !b || !relationship_type) {
      return res.status(400).json({ error: 'influencer_a_id, influencer_b_id, and relationship_type required' });
    }
    if (a === b) return res.status(400).json({ error: 'A profile cannot have a relationship with itself.' });
    if (!KINDS.has(relationship_type)) {
      return res.status(400).json({ error: `relationship_type must be one of: ${RELATIONSHIP_KINDS.join(', ')}` });
    }
    if ((await SocialProfile.count({ where: { id: [a, b] } })) !== 2) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const twin = await findTwin(SocialProfileRelationship, a, b, relationship_type);
    if (twin) return res.status(409).json({ error: 'These two already have this relationship.', relationship_id: twin.id });

    const rel = await SocialProfileRelationship.create({
      source_profile_id: a,
      target_profile_id: b,
      relationship_type,
      direction: 'mutual',
      public_visibility: is_public === false ? 'hidden' : 'public',
      description: notes || null,
      auto_generated: false,
    });
    res.status(201).json({ relationship: asMapRow(rel) });
  } catch (err) {
    console.error('[FeedRelationships] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — only these fields; the pair itself is not changed here.
router.put('/:id', async (req, res) => {
  const { SocialProfileRelationship } = getModels(req);
  try {
    const id = asId(req.params.id);
    const rel = id && await SocialProfileRelationship.findByPk(id);
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });

    const body = req.body || {};
    const patch = {};
    if (body.relationship_type !== undefined) {
      if (!KINDS.has(body.relationship_type)) {
        return res.status(400).json({ error: `relationship_type must be one of: ${RELATIONSHIP_KINDS.join(', ')}` });
      }
      patch.relationship_type = body.relationship_type;
    }
    if (body.public_visibility !== undefined) {
      if (!['public', 'rumored', 'hidden'].includes(body.public_visibility)) {
        return res.status(400).json({ error: 'public_visibility must be public, rumored or hidden.' });
      }
      patch.public_visibility = body.public_visibility;
    } else if (body.is_public !== undefined) {
      patch.public_visibility = body.is_public === false ? 'hidden' : 'public';
    }
    if (body.direction !== undefined) {
      if (!['mutual', 'source_to_target', 'target_to_source'].includes(body.direction)) {
        return res.status(400).json({ error: 'direction must be mutual, source_to_target or target_to_source.' });
      }
      patch.direction = body.direction;
    }
    if (body.drama_level !== undefined) {
      const level = Number(body.drama_level);
      if (!Number.isInteger(level) || level < 0 || level > 10) {
        return res.status(400).json({ error: 'drama_level must be a whole number from 0 to 10.' });
      }
      patch.drama_level = level;
    }
    if (body.notes !== undefined) patch.description = body.notes || null;
    if (body.description !== undefined) patch.description = body.description || null;
    for (const key of ['timeline_notes', 'narrative_function']) {
      if (body[key] !== undefined) patch[key] = body[key] || null;
    }

    if (patch.relationship_type && patch.relationship_type !== rel.relationship_type) {
      const twin = await findTwin(SocialProfileRelationship, rel.source_profile_id, rel.target_profile_id, patch.relationship_type, rel.id);
      if (twin) return res.status(409).json({ error: 'These two already have this relationship.', relationship_id: twin.id });
    }
    await rel.update(patch);
    res.json({ relationship: asMapRow(rel) });
  } catch (err) {
    console.error('[FeedRelationships] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  const { SocialProfileRelationship } = getModels(req);
  try {
    const id = asId(req.params.id);
    const rel = id && await SocialProfileRelationship.findByPk(id);
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });
    await rel.destroy();
    res.json({ success: true, message: 'Relationship deleted' });
  } catch (err) {
    console.error('[FeedRelationships] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /canvas — nodes + edges for SVG renderer
// ?author_mode=true → include underground profiles (shown with ◎ indicator)
// Default: excludes edges where either node is underground
router.get('/canvas', async (req, res) => {
  const { SocialProfileRelationship, SocialProfile } = getModels(req);
  const authorMode = req.query.author_mode === 'true';
  if (req.query.show_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.query.show_id))) {
    return res.status(400).json({ error: 'show_id must be a show id.' });
  }
  try {
    const relationships = (await SocialProfileRelationship.findAll({ include: includes(SocialProfile, CANVAS_ATTRS) })).map(asMapRow);

    // Collect unique nodes, filtering underground unless author_mode
    const nodeMap = new Map();
    const filteredRels = relationships.filter(rel => {
      if (!rel.influencerA || !rel.influencerB) return false;
      if (authorMode) return true;
      const tierA = rel.influencerA.visibility_tier || 'public';
      const tierB = rel.influencerB.visibility_tier || 'public';
      return tierA !== 'underground' && tierB !== 'underground';
    });

    for (const rel of filteredRels) {
      for (const p of [rel.influencerA, rel.influencerB]) {
        if (nodeMap.has(p.id)) continue;
        const tier = p.visibility_tier || 'public';
        nodeMap.set(p.id, {
          id: p.id,
          handle: p.handle,
          display_name: p.display_name,
          platform: p.platform,
          state: p.current_state,
          archetype: p.archetype,
          visibility_tier: tier,
          is_underground: tier === 'underground',
        });
      }
    }

    // The Pulse's closeness for each pair at the show's present (Task #3072):
    // read only. It starts from these same kinds, moved by the closeness ledger.
    let closeness = null;
    if (req.query.show_id) {
      const models = getModels(req);
      const at = await require('../services/storyClock').presentOrder(models, req.query.show_id);
      closeness = await require('../services/pulseCloseness').closenessOfPairs(
        models, req.query.show_id, filteredRels.map(r => [r.influencer_a_id, r.influencer_b_id]), at);
    }
    const { pairOf } = require('../services/pulseCloseness');
    // Lala's relationships follow the show's story: no storyline seed (decision c).
    const lalaId = await require('../services/lalaFeedProfile').lalaProfileId(getModels(req).sequelize);
    const edges = filteredRels.map(r => ({
      id: r.id,
      source: r.influencer_a_id,
      target: r.influencer_b_id,
      type: r.relationship_type,
      is_public: r.is_public,
      is_conflict: r.is_conflict,
      style: EDGE_STYLES[r.relationship_type] || EDGE_STYLES.orbit,
      closeness: closeness ? (closeness.get(pairOf(r.influencer_a_id, r.influencer_b_id).join(':')) ?? null) : null,
      seedable: lalaId == null || (Number(r.influencer_a_id) !== Number(lalaId) && Number(r.influencer_b_id) !== Number(lalaId)),
    }));

    res.json({ nodes: Array.from(nodeMap.values()), edges, author_mode: authorMode });
  } catch (err) {
    console.error('[FeedRelationships] GET /canvas error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /profiles — list social profiles for picker UI
// ?author_mode=true → include underground profiles
// Default: excludes underground
router.get('/profiles', async (req, res) => {
  const { SocialProfile } = getModels(req);
  const authorMode = req.query.author_mode === 'true';
  try {
    const where = {};
    if (!authorMode) {
      where.visibility_tier = { [Op.or]: ['public', 'semi_private', null] };
    }
    const profiles = await SocialProfile.findAll({
      where,
      attributes: ['id', 'handle', 'display_name', 'platform', 'current_state', 'visibility_tier'],
      order: [['handle', 'ASC']],
    });
    res.json({ profiles, author_mode: authorMode });
  } catch (err) {
    console.error('[FeedRelationships] GET /profiles error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/generate-ripples — caught-in-middle flags for a pair in conflict (CONFLICT_KINDS)
router.post('/:id/generate-ripples', aiRateLimiter, async (req, res) => {
  const models = getModels(req);
  const { SocialProfileRelationship, CharacterEntanglement, RegistryCharacter, SocialProfile } = models;
  try {
    const id = asId(req.params.id);
    const found = id && await SocialProfileRelationship.findByPk(id, { include: includes(SocialProfile, PROFILE_ATTRS) });
    if (!found) return res.status(404).json({ error: 'Relationship not found' });
    const rel = asMapRow(found);

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

// POST /:id/storyline-seed — a Pulse storyline between a kept pair (Evoni's
// idea 4, PR 3): one AI call, nothing saved; she starts it on The Pulse.
router.post('/:id/storyline-seed', authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const seed = await require('../services/pairStorylines').seedStoryline(getModels(req), req.params.id, { showId: req.body?.show_id });
    return res.json({ success: true, ...seed });
  } catch (err) {
    const { SeedError } = require('../services/pairStorylines');
    // RequestCapError: today's manual requests are used.
    if (err instanceof SeedError || err instanceof require('../services/pulseRequests').RequestCapError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    console.error('[FeedRelationships] POST /:id/storyline-seed error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
