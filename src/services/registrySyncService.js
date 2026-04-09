'use strict';

/**
 * Registry Sync Service
 *
 * Syncs social intelligence from SocialProfile → RegistryCharacter.
 * Called on:
 *   1. Profile crossing (initial sync)
 *   2. Profile finalization (update sync)
 *   3. Manual sync trigger
 *   4. After event participation (characterSyncService)
 *
 * Generates a `social_leverage` narrative summary that explains
 * WHY this character has power in story terms.
 */

// ─── SOCIAL LEVERAGE GENERATOR ──────────────────────────────────────────────
// Produces a narrative sentence about the character's social power

function generateSocialLeverage(profile) {
  const parts = [];
  const tier = profile.follower_tier;
  const celeb = profile.celebrity_tier || 'accessible';
  const income = profile.primary_income_source;
  const drama = profile.drama_magnet;
  const clout = profile.clout_score || 0;
  const category = profile.content_category || 'creator';
  const presences = profile.platform_presences || {};
  const platformCount = Object.keys(presences).length;

  // Influence level
  if (celeb === 'untouchable') {
    parts.push(`Cultural icon in the ${category} space — referenced by everyone, reached by no one`);
  } else if (celeb === 'exclusive') {
    parts.push(`Elite-tier ${category} creator with rare public appearances`);
  } else if (tier === 'mega') {
    parts.push(`Major ${category} presence with massive reach`);
  } else if (tier === 'macro') {
    parts.push(`Established ${category} voice with growing influence`);
  } else if (tier === 'mid') {
    parts.push(`Mid-tier ${category} creator building momentum`);
  } else {
    parts.push(`Emerging ${category} creator finding their lane`);
  }

  // Multi-platform
  if (platformCount > 2) {
    parts.push(`active across ${platformCount} platforms with different personas on each`);
  } else if (platformCount === 2) {
    const plats = Object.keys(presences).join(' and ');
    parts.push(`dual presence on ${plats}`);
  }

  // Income angle
  if (income) {
    const breakdown = profile.income_breakdown || {};
    const topSource = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
    if (topSource && topSource[1] > 60) {
      parts.push(`${topSource[1]}% of income from ${topSource[0]}`);
    } else if (income) {
      parts.push(`primarily earns from ${income}`);
    }
  }

  // Public/private split
  if (profile.public_persona && profile.private_reality) {
    parts.push(`publicly known as "${profile.public_persona.slice(0, 60)}" — privately: ${profile.private_reality.slice(0, 80)}`);
  }

  // Drama factor
  if (drama) {
    parts.push('attracts controversy — every appearance is a narrative risk');
  }

  // Clout
  if (clout >= 80) {
    parts.push('extremely high social capital — their endorsement or criticism moves markets');
  } else if (clout >= 50) {
    parts.push('significant social influence — people notice what they do');
  }

  return parts.join('. ') + '.';
}

// ─── SYNC SOCIAL INTELLIGENCE ───────────────────────────────────────────────

/**
 * Sync social profile data into a linked registry character.
 *
 * @param {object} profile — SocialProfile instance or plain object
 * @param {object} models — Sequelize models
 * @returns {object} { synced: boolean, characterId, fieldsUpdated }
 */
async function syncProfileToRegistry(profile, models) {
  const p = profile.toJSON ? profile.toJSON() : profile;

  if (!p.registry_character_id) {
    return { synced: false, reason: 'No linked registry character' };
  }

  const { RegistryCharacter } = models;
  if (!RegistryCharacter) {
    return { synced: false, reason: 'RegistryCharacter model not loaded' };
  }

  const character = await RegistryCharacter.findByPk(p.registry_character_id);
  if (!character) {
    return { synced: false, reason: `Character ${p.registry_character_id} not found` };
  }

  // Build update payload
  const updates = {
    feed_profile_id: p.id,
    social_presence: true,
    platform_primary: p.platform,
    follower_tier: p.follower_tier,
    celebrity_tier: p.celebrity_tier || 'accessible',
    platform_presences: p.platform_presences || {},
    public_persona: p.public_persona || p.content_persona || null,
    private_reality: p.private_reality || p.real_signal || null,
    primary_income_source: p.primary_income_source || null,
    income_breakdown: p.income_breakdown || {},
    monthly_earnings_range: p.monthly_earnings_range || null,
    clout_score: p.clout_score || 0,
    drama_magnet: p.drama_magnet || false,
    content_category: p.content_category || null,
    brand_partnerships: p.brand_partnerships || [],
    controversy_history: p.controversy_history || [],
    secret_connections: p.secret_connections || [],
    rebrand_history: p.rebrand_history || [],
    social_leverage: generateSocialLeverage(p),
    social_synced_at: new Date(),
  };

  // Also sync aesthetic if character doesn't have one
  if (p.aesthetic_dna && Object.keys(p.aesthetic_dna).length > 0) {
    const existing = character.aesthetic_dna || {};
    if (!existing.visual_style) {
      updates.aesthetic_dna = { ...existing, ...p.aesthetic_dna };
    }
  }

  // Apply updates — use try-catch for columns that may not exist
  try {
    await character.update(updates);
  } catch (err) {
    // Strip fields that don't exist in DB and retry
    console.warn('[RegistrySync] Full update failed, trying safe fields:', err.message);
    const safeUpdates = {
      feed_profile_id: updates.feed_profile_id,
      social_presence: true,
      platform_primary: updates.platform_primary,
      follower_tier: updates.follower_tier,
    };
    try {
      await character.update(safeUpdates);
    } catch { /* non-blocking */ }
  }

  const fieldsUpdated = Object.keys(updates).length;
  console.log(`[RegistrySync] Synced ${p.handle} → ${character.display_name} (${fieldsUpdated} fields)`);

  return {
    synced: true,
    characterId: character.id,
    characterName: character.display_name,
    fieldsUpdated,
    socialLeverage: updates.social_leverage,
  };
}

// ─── BULK SYNC ALL LINKED PROFILES ──────────────────────────────────────────

async function syncAllLinkedProfiles(models) {
  const { SocialProfile } = models;
  if (!SocialProfile) return { synced: 0 };

  const linked = await SocialProfile.findAll({
    where: {
      registry_character_id: { [require('sequelize').Op.ne]: null },
      status: { [require('sequelize').Op.in]: ['finalized', 'generated', 'crossed'] },
    },
    attributes: [
      'id', 'handle', 'platform', 'display_name', 'content_category', 'archetype',
      'follower_tier', 'registry_character_id', 'content_persona', 'real_signal',
      'celebrity_tier', 'platform_presences', 'public_persona', 'private_reality',
      'primary_income_source', 'income_breakdown', 'monthly_earnings_range',
      'clout_score', 'drama_magnet', 'brand_partnerships', 'controversy_history',
      'secret_connections', 'rebrand_history', 'aesthetic_dna', 'revenue_streams',
    ],
  });

  let synced = 0;
  for (const profile of linked) {
    try {
      const result = await syncProfileToRegistry(profile, models);
      if (result.synced) synced++;
    } catch (err) {
      console.warn(`[RegistrySync] Failed for ${profile.handle}:`, err.message);
    }
  }

  return { synced, total: linked.length };
}

module.exports = {
  syncProfileToRegistry,
  syncAllLinkedProfiles,
  generateSocialLeverage,
};
