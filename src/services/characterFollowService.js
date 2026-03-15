'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Content categories the follow engine recognizes ──────────────────────────
const CONTENT_CATEGORIES = [
  'fashion', 'beauty', 'lifestyle', 'motherhood', 'family', 'faith',
  'fitness', 'relationships', 'luxury', 'entrepreneurship', 'cooking', 'home',
  'mental health', 'travel', 'music', 'comedy', 'gossip', 'drama',
  'adult content', 'sex work', 'onlyfans', 'finance', 'tech', 'gaming',
  'crypto', 'sports', 'politics', 'art', 'education', 'wellness',
];

// ── Creator archetypes the follow engine recognizes ──────────────────────────
const CREATOR_ARCHETYPES = [
  'polished_curator', 'messy_transparent', 'soft_life', 'explicitly_paid',
  'overnight_rise', 'cautionary', 'the_peer', 'the_watcher',
  'chaos_creator', 'community_builder',
];

// ── Follow motivations ───────────────────────────────────────────────────────
const FOLLOW_MOTIVATIONS = ['identity', 'aspiration', 'entertainment', 'information', 'parasocial'];

// ── Consumption styles ───────────────────────────────────────────────────────
const CONSUMPTION_STYLES = [
  'late_night_scroller',    // scrolls alone, privately, at night
  'passive_observer',       // sees content through others, doesn't seek it
  'active_engager',         // likes, comments, shares
  'hate_watcher',           // follows people they resent or judge
  'study_mode',             // analyzing the craft, the business model
  'share_with_friends',     // consumes to have something to talk about
];

/**
 * Build the prompt to generate a follow profile from character DNA.
 */
function buildFollowProfilePrompt(character) {
  return `You are a character psychologist analyzing a fictional character's social media consumption patterns.

Given this character's psychological profile, generate their follow profile — what kinds of social media creators they'd naturally gravitate toward, and WHY based on their wound, desires, and psychology.

## CHARACTER: ${character.display_name || character.character_key}

**Role:** ${character.role_type || 'unknown'}
**Age:** ${character.age || 'unknown'}
**Gender:** ${character.gender || 'unknown'}
**Occupation:** ${character.career_history || character.description || 'unknown'}

**Core Desire:** ${character.core_desire || 'unknown'}
**Core Fear:** ${character.core_fear || 'unknown'}
**Core Wound:** ${character.core_wound || 'unknown'}
**Hidden Want:** ${character.hidden_want || 'unknown'}
**Mask Persona:** ${character.mask_persona || 'unknown'}
**Truth Persona:** ${character.truth_persona || 'unknown'}

**Emotional Baseline:** ${character.emotional_baseline || 'unknown'}
**Self-Narrative:** ${character.self_narrative || character.de_self_narrative_origin || 'unknown'}
**Operative Cosmology:** ${character.operative_cosmology || character.de_operative_cosmology || 'unknown'}
**Forbidden Joy:** ${character.de_forbidden_joy || 'unknown'}
**Change Capacity:** ${character.de_change_capacity || 'unknown'}

**Relationship Status:** ${character.relationship_status || 'unknown'}
**Class Origin → Current:** ${character.class_origin || character.de_money_origin_class || '?'} → ${character.current_class || character.de_money_current_class || '?'}

**Social Presence:** ${character.social_presence ? 'Yes — they post/create content' : 'No — they consume but do not post'}
${character.platform_primary ? `**Primary Platform:** ${character.platform_primary}` : ''}

## INSTRUCTIONS

Generate a JSON follow profile that captures this character's social media consumption psychology. Every weight should reflect their specific wound, desire, and personality — NOT generic preferences.

**Content Categories** — Rate each 0.0 to 1.0 based on how drawn this character would be:
${CONTENT_CATEGORIES.map(c => `- ${c}`).join('\n')}

**Creator Archetypes** — Rate each 0.0 to 1.0:
- polished_curator: Perfect aesthetic, everything curated, aspirational
- messy_transparent: Raw, unfiltered, shows the cracks
- soft_life: Luxury, ease, "I don't do stress"
- explicitly_paid: Clearly monetized, brand deals, sponsored
- overnight_rise: Came from nowhere, sudden fame
- cautionary: Fall from grace, scandal, public unraveling
- the_peer: Same level, relatable, comfortable
- the_watcher: Quiet, observing, barely posts but sees everything
- chaos_creator: Drama, beef, spectacle, unpredictable
- community_builder: Teaches, gathers, builds something real

**Follow Motivations** — How much each motivation drives their following (should sum roughly to 1.0):
- identity: "someone like me" — recognition, mirroring
- aspiration: "who I want to become" — reaching up
- entertainment: drama, humor, spectacle — consumption for pleasure
- information: learning, authority, expertise
- parasocial: emotional investment in a stranger's life

**Consumption Style** — Pick ONE: ${CONSUMPTION_STYLES.join(', ')}

**Consumption Context** — One or two sentences describing WHEN and HOW they scroll. Be specific to this character. Example: "Scrolls in bed after his wife falls asleep. Never likes anything. Watches fitness content and women who remind him of a version of his wife he hasn't met yet."

**Behavioral Modifiers:**
- drama_bonus: -0.10 to 0.20 (how much drama pulls them beyond baseline)
- adult_penalty: -0.30 to 0.0 (negative = avoids adult content, zero = unbothered)
- base_follow_threshold: 0.25 to 0.50 (lower = follows more freely, higher = selective)
- same_platform_bonus: { instagram, tiktok, youtube, twitter } each 0.0 to 0.15
- follower_tier_affinity: { micro, mid, macro, mega } each 0.0 to 1.0

**Generation Reasoning** — 2-3 sentences explaining WHY this character consumes content this way, rooted in their wound and desire. This is the psychological thesis.

Return ONLY valid JSON with this exact structure:
{
  "category_affinity": { ... },
  "archetype_affinity": { ... },
  "motivation_weights": { ... },
  "consumption_style": "...",
  "consumption_context": "...",
  "drama_bonus": 0.0,
  "adult_penalty": -0.10,
  "base_follow_threshold": 0.35,
  "same_platform_bonus": { "instagram": 0.0, "tiktok": 0.0, "youtube": 0.0, "twitter": 0.0 },
  "follower_tier_affinity": { "micro": 0.0, "mid": 0.0, "macro": 0.0, "mega": 0.0 },
  "generation_reasoning": "..."
}`;
}

/**
 * Generate a follow profile from character DNA using Claude.
 */
async function generateFollowProfile(character) {
  const prompt = buildFollowProfilePrompt(character);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse follow profile JSON from Claude response');

  const profile = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!profile.category_affinity || !profile.archetype_affinity || !profile.motivation_weights) {
    throw new Error('Generated profile missing required affinity fields');
  }

  return profile;
}

/**
 * Create or update a character's follow profile from their registry data.
 */
async function createFollowProfileFromDNA(db, characterKey) {
  const character = await db.RegistryCharacter.findOne({
    where: { character_key: characterKey },
  });
  if (!character) throw new Error(`Character not found: ${characterKey}`);

  const generated = await generateFollowProfile(character);

  const [profile, created] = await db.CharacterFollowProfile.findOrCreate({
    where: { character_key: characterKey },
    defaults: {
      character_name: character.display_name || characterKey,
      registry_character_id: character.id,
      category_affinity: generated.category_affinity,
      archetype_affinity: generated.archetype_affinity,
      motivation_weights: generated.motivation_weights,
      drama_bonus: generated.drama_bonus ?? 0.05,
      adult_penalty: generated.adult_penalty ?? -0.10,
      same_platform_bonus: generated.same_platform_bonus || {},
      follower_tier_affinity: generated.follower_tier_affinity || { micro: 0.60, mid: 0.70, macro: 0.75, mega: 0.65 },
      base_follow_threshold: generated.base_follow_threshold ?? 0.35,
      consumption_style: generated.consumption_style || null,
      consumption_context: generated.consumption_context || null,
      has_social_presence: character.social_presence || false,
      generated_from_dna: true,
      generation_reasoning: generated.generation_reasoning || null,
    },
  });

  if (!created) {
    // Update existing — but don't overwrite hand-tuned profiles
    if (!profile.hand_tuned) {
      await profile.update({
        character_name: character.display_name || characterKey,
        registry_character_id: character.id,
        category_affinity: generated.category_affinity,
        archetype_affinity: generated.archetype_affinity,
        motivation_weights: generated.motivation_weights,
        drama_bonus: generated.drama_bonus ?? profile.drama_bonus,
        adult_penalty: generated.adult_penalty ?? profile.adult_penalty,
        same_platform_bonus: generated.same_platform_bonus || profile.same_platform_bonus,
        follower_tier_affinity: generated.follower_tier_affinity || profile.follower_tier_affinity,
        base_follow_threshold: generated.base_follow_threshold ?? profile.base_follow_threshold,
        consumption_style: generated.consumption_style || profile.consumption_style,
        consumption_context: generated.consumption_context || profile.consumption_context,
        has_social_presence: character.social_presence || false,
        generated_from_dna: true,
        generation_reasoning: generated.generation_reasoning || profile.generation_reasoning,
      });
    }
  }

  return { profile: created ? profile : await db.CharacterFollowProfile.findOne({ where: { character_key: characterKey } }), created, generated };
}

/**
 * Build follow influence context for story engine injection.
 * Returns a narrative-ready block describing what this character watches and why.
 */
async function buildFollowInfluenceContext(db, characterKey, options = {}) {
  const { limit = 10, includeSharedWith } = options;

  // Get the character's followers (profiles they follow)
  const followers = await db.SocialProfileFollower.findAll({
    where: { character_key: characterKey },
    include: [{
      model: db.SocialProfile,
      as: 'socialProfile',
      attributes: ['handle', 'display_name', 'platform', 'content_category', 'archetype',
        'follower_count_approx', 'content_persona', 'current_trajectory'],
    }],
    order: [['influence_level', 'DESC']],
    limit,
  });

  if (followers.length === 0) return null;

  // Get the follow profile for consumption context
  const followProfile = await db.CharacterFollowProfile.findOne({
    where: { character_key: characterKey },
  });

  // Build the context
  const lines = [];
  const charName = followProfile?.character_name || characterKey;

  if (followProfile?.consumption_context) {
    lines.push(followProfile.consumption_context);
  }

  lines.push('');
  lines.push(`${charName} follows ${followers.length} creator${followers.length > 1 ? 's' : ''}:`);

  for (const f of followers) {
    const p = f.socialProfile;
    if (!p) continue;
    const influenceWord = f.influence_level >= 8 ? 'deeply influenced by'
      : f.influence_level >= 5 ? 'regularly watches'
      : 'casually follows';
    lines.push(`- ${influenceWord} @${p.handle} (${p.platform}, ${p.content_category || 'mixed content'})`);
    if (f.follow_context) lines.push(`  ${f.follow_context}`);
  }

  // Shared follows with another character (tension/connection detection)
  if (includeSharedWith) {
    const otherFollows = await db.SocialProfileFollower.findAll({
      where: { character_key: includeSharedWith },
      attributes: ['social_profile_id'],
      raw: true,
    });
    const otherIds = new Set(otherFollows.map(f => f.social_profile_id));
    const shared = followers.filter(f => otherIds.has(f.social_profile_id));

    if (shared.length > 0) {
      lines.push('');
      lines.push(`Shared follows with ${includeSharedWith}:`);
      for (const f of shared) {
        const p = f.socialProfile;
        if (p) lines.push(`- Both watch @${p.handle} — but for different reasons`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Detect follow tensions between two characters.
 * Returns narrative-ready tension descriptions.
 */
async function detectFollowTensions(db, charKeyA, charKeyB) {
  const [followsA, followsB] = await Promise.all([
    db.SocialProfileFollower.findAll({
      where: { character_key: charKeyA },
      include: [{ model: db.SocialProfile, as: 'socialProfile', attributes: ['id', 'handle', 'platform', 'content_category', 'archetype', 'adult_content_present'] }],
    }),
    db.SocialProfileFollower.findAll({
      where: { character_key: charKeyB },
      include: [{ model: db.SocialProfile, as: 'socialProfile', attributes: ['id', 'handle', 'platform', 'content_category', 'archetype', 'adult_content_present'] }],
    }),
  ]);

  const idsA = new Set(followsA.map(f => f.social_profile_id));
  const idsB = new Set(followsB.map(f => f.social_profile_id));

  const shared = followsA.filter(f => idsB.has(f.social_profile_id));
  const onlyA = followsA.filter(f => !idsB.has(f.social_profile_id));
  const onlyB = followsB.filter(f => !idsA.has(f.social_profile_id));

  const tensions = [];

  // Shared follows — potential conversation or unspoken connection
  for (const f of shared) {
    const p = f.socialProfile;
    if (!p) continue;
    const fB = followsB.find(fb => fb.social_profile_id === f.social_profile_id);
    if (f.follow_motivation !== fB?.follow_motivation) {
      tensions.push({
        type: 'shared_different_reason',
        profile: p.handle,
        description: `Both follow @${p.handle} — ${charKeyA} for ${f.follow_motivation}, ${charKeyB} for ${fB?.follow_motivation}. Same creator, different hunger.`,
      });
    } else {
      tensions.push({
        type: 'shared_same_reason',
        profile: p.handle,
        description: `Both follow @${p.handle} for ${f.follow_motivation}. Neither has mentioned it to the other.`,
      });
    }
  }

  // Secret follows — adult or high-influence content one follows privately
  for (const f of onlyA) {
    const p = f.socialProfile;
    if (!p) continue;
    if (p.adult_content_present && f.influence_level >= 5) {
      tensions.push({
        type: 'secret_follow',
        character: charKeyA,
        profile: p.handle,
        description: `${charKeyA} follows @${p.handle} (adult content). ${charKeyB} does not know.`,
      });
    }
  }
  for (const f of onlyB) {
    const p = f.socialProfile;
    if (!p) continue;
    if (p.adult_content_present && f.influence_level >= 5) {
      tensions.push({
        type: 'secret_follow',
        character: charKeyB,
        profile: p.handle,
        description: `${charKeyB} follows @${p.handle} (adult content). ${charKeyA} does not know.`,
      });
    }
  }

  return {
    shared_count: shared.length,
    only_a_count: onlyA.length,
    only_b_count: onlyB.length,
    tensions,
  };
}

module.exports = {
  generateFollowProfile,
  createFollowProfileFromDNA,
  buildFollowInfluenceContext,
  detectFollowTensions,
  CONTENT_CATEGORIES,
  CREATOR_ARCHETYPES,
  FOLLOW_MOTIVATIONS,
  CONSUMPTION_STYLES,
};
