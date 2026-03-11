'use strict';
/**
 * rippleEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The automation core of the entanglement layer.
 *
 * What it does:
 *   1. When an influencer's state changes → find all active entanglements
 *   2. Flag affected characters (turbulence_flag = true)
 *   3. Log an entanglement_event with affected_character_ids + affected_dimensions
 *   4. Generate Amber scene proposals for identity_anchor characters
 *   5. Auto-propose unfollows for identity_anchor characters when state is
 *      'cancelled' or 'gone_dark'
 *
 * Called by: entanglementRoutes.js → PATCH /api/v1/entanglements/profiles/:id/state
 * ─────────────────────────────────────────────────────────────────────────────
 */
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * fireRipple
 * Call this whenever a social_profile's current_state changes.
 *
 * @param {object} params
 * @param {object} params.profile        - SocialProfile instance (after state update)
 * @param {string} params.previousState  - The state before the change
 * @param {object} params.models         - Sequelize models object
 * @returns {object} rippleResult        - Event record + proposals summary
 */
async function fireRipple({ profile, previousState, models }) {
  const {
    CharacterEntanglement,
    EntanglementEvent,
    EntanglementUnfollow,
    RegistryCharacter,
  } = models;

  // ── 1. Find all active entanglements for this profile ───────────────────
  const entanglements = await CharacterEntanglement.findAll({
    where: {
      profile_id: profile.id,
      is_active:  true,
    },
    include: [{
      model: RegistryCharacter,
      as:    'character',
      attributes: ['id', 'selected_name', 'role_type'],
    }],
  });

  if (!entanglements.length) {
    return { event: null, affected: 0, proposals: [] };
  }

  // ── 2. Flag all affected characters ─────────────────────────────────────
  const affectedCharacterIds = entanglements.map(e => e.character_id);
  const affectedDimensions   = [...new Set(entanglements.map(e => e.dimension))];

  await CharacterEntanglement.update(
    {
      turbulence_flag:   true,
      turbulence_reason: `${profile.handle || profile.display_name} shifted from ${previousState} to ${profile.current_state}`,
    },
    {
      where: {
        profile_id:  profile.id,
        is_active:   true,
      },
    }
  );

  // ── 3. Generate scene proposals for identity_anchor characters ──────────
  const anchorEntanglements = entanglements.filter(
    e => e.intensity === 'identity_anchor' || e.entanglement_type === 'identity_anchor'
  );

  const sceneProposals = [];

  for (const entanglement of anchorEntanglements) {
    const character = entanglement.character;
    if (!character) continue;

    try {
      const proposal = await generateSceneProposal({
        character,
        profile,
        previousState,
        newState:  profile.current_state,
        dimension: entanglement.dimension,
      });
      sceneProposals.push({
        character_id:   character.id,
        character_name: character.selected_name,
        brief:          proposal,
        approved:       false,  // author must confirm
        dimension:      entanglement.dimension,
      });
    } catch (err) {
      console.error(`[rippleEngine] Scene proposal failed for ${character.id}:`, err.message);
    }
  }

  // ── 4. Auto-propose unfollows for identity_anchor on cancelled/gone_dark ─
  const unfolowTriggerStates = ['cancelled', 'gone_dark'];

  if (unfolowTriggerStates.includes(profile.current_state)) {
    for (const entanglement of anchorEntanglements) {
      // Check if unfollow already exists
      const existing = await EntanglementUnfollow.findOne({
        where: {
          character_id: entanglement.character_id,
          profile_id:   profile.id,
        },
      });

      if (!existing) {
        await EntanglementUnfollow.create({
          character_id:          entanglement.character_id,
          profile_id:            profile.id,
          reason:                null,  // author confirms reason
          amber_proposed_reason: `${profile.current_state === 'cancelled' ? 'Cancellation' : 'Disappearance'} of an identity anchor — forced re-evaluation`,
          author_confirmed:      false,
          visibility:            'unnoticed',  // author sets visibility
        });
      }
    }
  }

  // ── 5. Write the entanglement_event record ───────────────────────────────
  const event = await EntanglementEvent.create({
    profile_id:             profile.id,
    event_type:             'state_change',
    previous_state:         previousState,
    new_state:              profile.current_state,
    affected_character_ids: affectedCharacterIds,
    affected_dimensions:    affectedDimensions,
    scene_proposals:        sceneProposals.length ? sceneProposals : null,
    description:            `${profile.handle || profile.display_name} shifted from ${previousState} → ${profile.current_state}. ${affectedCharacterIds.length} character(s) flagged.`,
    resolved:               false,
  });

  return {
    event,
    affected:  affectedCharacterIds.length,
    proposals: sceneProposals,
  };
}

/**
 * generateSceneProposal
 * Calls Claude to generate a scene brief for a flagged character.
 * This is the moment the story writes itself.
 */
async function generateSceneProposal({ character, profile, previousState, newState, dimension }) {
  const systemPrompt = `You are Amber, production intelligence for the LalaVerse franchise.
You generate scene briefs — not full scenes, just the pressure point and the opportunity.
A scene brief is 2–4 sentences: the situation, the character's internal stake, and a suggested opening image.
Be specific. Be pressured. Do not be generic.`;

  const userPrompt = `A character in our story has just been affected by a shift in their social media world.

Character: ${character.selected_name}
Role: ${character.role_type || 'unknown'}
Influencer: ${profile.handle || profile.display_name}
State shift: ${previousState} → ${newState}
Deep Profile dimension affected: ${dimension}

This influencer is an identity anchor for this character — meaning their decisions, aesthetics, and self-worth have been shaped by watching this person.

Generate a scene brief: what is the pressure point this character is now sitting inside? What does this shift cost them emotionally? What is the scene?`;

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',  // fast + cheap for proposals
    max_tokens: 300,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  return response.content[0]?.text || 'Scene proposal unavailable.';
}

/**
 * resolveEvent
 * Mark an entanglement_event as resolved and clear turbulence flags
 * for all affected characters.
 */
async function resolveEvent({ eventId, models }) {
  const { EntanglementEvent, CharacterEntanglement } = models;

  const event = await EntanglementEvent.findByPk(eventId);
  if (!event) throw new Error('Event not found');

  // Clear turbulence flags for affected characters
  if (event.affected_character_ids?.length) {
    await CharacterEntanglement.update(
      { turbulence_flag: false, turbulence_reason: null },
      {
        where: {
          character_id: event.affected_character_ids,
          profile_id:   event.profile_id,
        },
      }
    );
  }

  await event.update({ resolved: true });
  return event;
}

module.exports = { fireRipple, resolveEvent, generateSceneProposal };
