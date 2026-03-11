'use strict';
/**
 * wantFieldRoutes.js — The Want Field
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/character-entanglements', wantFieldRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PUT  /:id/want            — update what_they_want and want_category
 * POST /:id/unfollow-thread — generate story thread proposal from unfollow + want
 */
const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

// PUT /:id/want
router.put('/:id/want', async (req, res) => {
  const { CharacterEntanglement } = getModels(req);
  try {
    const entanglement = await CharacterEntanglement.findByPk(req.params.id);
    if (!entanglement) return res.status(404).json({ error: 'Entanglement not found' });

    const { what_they_want, want_category } = req.body;
    if (what_they_want !== undefined) entanglement.what_they_want = what_they_want;
    if (want_category !== undefined)  entanglement.want_category = want_category;
    await entanglement.save();

    res.json({ entanglement });
  } catch (err) {
    console.error('[WantField] PUT /:id/want error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/unfollow-thread — generate story thread proposal
router.post('/:id/unfollow-thread', async (req, res) => {
  const models = getModels(req);
  const { CharacterEntanglement, RegistryCharacter, SocialProfile } = models;
  try {
    const entanglement = await CharacterEntanglement.findByPk(req.params.id, {
      include: [
        { model: RegistryCharacter, as: 'character' },
        { model: SocialProfile, as: 'profile' },
      ],
    });
    if (!entanglement) return res.status(404).json({ error: 'Entanglement not found' });

    if (!entanglement.want_category) {
      return res.status(400).json({ error: 'want_category must be set before generating unfollow thread' });
    }

    let thread = '';
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      const charName = entanglement.character?.selected_name || entanglement.character?.display_name || 'the character';
      const profileHandle = entanglement.profile?.handle || 'the profile';

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are Amber, production intelligence for "Before Lala". Generate a 2–3 sentence story thread proposal describing what an unfollow looks like for this character emotionally and narratively. This is a proposal — NEVER auto-write to manuscript.`,
        messages: [{
          role: 'user',
          content: `Character: ${charName} (${entanglement.character?.role_type || 'unknown'})
Unfollowed: @${profileHandle}
Entanglement dimension: ${entanglement.dimension}
Want category: ${entanglement.want_category}
What they wanted: ${entanglement.what_they_want || 'unspecified'}
Notes: ${entanglement.notes || 'none'}

What does this loss look like for ${charName}?`,
        }],
      });
      thread = response.content[0]?.text || '';
    } catch (aiErr) {
      console.warn('[WantField] Claude unfollow-thread failed:', aiErr.message);
      return res.status(503).json({ error: 'AI service unavailable' });
    }

    // Return proposal — never auto-write
    res.json({
      entanglement_id: entanglement.id,
      character: entanglement.character?.selected_name,
      profile: entanglement.profile?.handle,
      want_category: entanglement.want_category,
      proposed_thread: thread,
      note: 'Proposal only — surface on Dashboard Hot Zones for author review',
    });
  } catch (err) {
    console.error('[WantField] unfollow-thread error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
