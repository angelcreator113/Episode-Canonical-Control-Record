'use strict';

/**
 * feedAutoGeneration.js — Auto-creates a Feed (SocialProfile) record
 * when a registry character is created. Respects layer-aware caps.
 */

const {
  generateHandleFromCharacter,
  inferArchetypeFromRole,
  inferLalaRelationship,
  inferCareerPressure,
  inferFollowerTier,
} = require('../utils/feedProfileUtils');

const LALAVERSE_CAP = 200;
const REAL_WORLD_CAP = 443;

/**
 * Auto-create a Feed profile from a registry character.
 * @param {object} db - Sequelize models object
 * @param {object} character - RegistryCharacter instance
 * @param {string} feedLayer - 'real_world' or 'lalaverse'
 * @param {object} [opts] - Optional overrides (city, platform, etc.)
 * @returns {{ feedProfile: object|null, skipped: boolean, reason?: string, cap?: number, current?: number }}
 */
async function autoCreateFeedProfile(db, character, feedLayer, opts = {}) {
  const cap = feedLayer === 'lalaverse' ? LALAVERSE_CAP : REAL_WORLD_CAP;

  // Check cap — don't block registry creation, just skip Feed profile
  const count = await db.SocialProfile.count({
    where: {
      feed_layer: feedLayer,
      deleted_at: null,
      lalaverse_cap_exempt: false,
    },
  });

  if (count >= cap) {
    return {
      feedProfile: null,
      skipped: true,
      reason: 'cap_reached',
      cap,
      current: count,
    };
  }

  const isLalaverse = feedLayer === 'lalaverse';
  const roleType = character.role_type || 'support';

  const feedProfile = await db.SocialProfile.create({
    // Layer
    feed_layer:            feedLayer,
    registry_character_id: character.id,

    // Identity — pulled from registry character
    handle:         opts.handle || generateHandleFromCharacter(character),
    display_name:   character.selected_name || character.display_name,
    platform:       opts.platform || 'instagram',
    vibe_sentence:  opts.vibe_sentence || `${character.selected_name || character.display_name} — auto-generated from registry`,
    follower_tier:  opts.follower_tier || inferFollowerTier(roleType),
    archetype:      inferArchetypeFromRole(roleType),
    current_state:  'rising',
    status:         'generated',

    // LalaVerse-specific fields
    city:              isLalaverse ? (opts.city || character.current_city || null) : null,
    lala_relationship: isLalaverse ? inferLalaRelationship(roleType) : null,
    career_pressure:   isLalaverse ? inferCareerPressure(roleType) : null,
    mirror_profile_id: null,

    // Cap flags
    is_justawoman_record: false,
    lalaverse_cap_exempt: false,
  });

  return { feedProfile, skipped: false };
}

module.exports = { autoCreateFeedProfile };
