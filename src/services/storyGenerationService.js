'use strict';

/**
 * Story Generation Service
 *
 * Transforms episode scripts into prose stories. Each episode can
 * generate multiple format variants (short story, social fiction, snippet).
 *
 * Uses all available episode data: script, characters (with literary depth),
 * outfit, event, evaluation, social tasks, financial context.
 */

const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
const { LINKED_CHARACTER_JOIN } = require('../utils/registryLink');
const { pulsePromptRules } = require('../utils/pulsePlatform');
const { storyBrief, BRIEF_COLUMNS } = require('./characterStoryBrief');
const { secretsFor } = require('./characterSecrets');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const FORMAT_SPECS = {
  short_story: {
    name: 'Short Story',
    wordRange: '2000-3000',
    tone: 'Literary fiction. Cinematic prose. Fashion-forward but emotionally grounded. Think Candace Bushnell meets the age of The Pulse.',
    structure: 'Opening hook → rising tension → climax at event → aftermath → final image. No chapters, continuous prose with scene breaks (***)',
  },
  social_fiction: {
    name: 'Social Fiction',
    wordRange: '800-1500',
    tone: 'Told entirely through The Pulse: Pulse posts and captions, DMs, Pulse stories, comment threads, notifications. The story emerges from the digital breadcrumbs.',
    structure: 'Series of social media posts/messages. Each "post" is a self-contained moment. Use @handles, hashtags, likes/comments as storytelling devices.',
  },
  snippet: {
    name: 'Snippet',
    wordRange: '400-600',
    tone: 'Punchy, atmospheric. A single scene that captures the essence. Could be a Pulse caption, a Pulse video voiceover, or a teaser.',
    structure: 'One continuous paragraph or very short scene. No scene breaks. Ends with a hook.',
  },
  recap: {
    name: 'Episode Recap',
    wordRange: '500-800',
    tone: 'Conversational, second-person. Like a friend telling you what happened. "So basically..." energy.',
    structure: 'Casual recap with key moments highlighted. Reference outfit, drama, outcome. End with teaser for next episode.',
  },
};

/**
 * Canon for every story of Lala's world (docs/CANON.md; Evoni, 2026-10-15).
 * Lala is a sentient fashion game and AI character JustAWoman created, and
 * she does not know. JustAWoman is the player and host, outside Lala's world:
 * the script's JustAWoman segments (the opening ritual, the login, her picks
 * in the closet) never appear in Lala's story; Lala lives her choices as her
 * own. The LalaVerse's one social app is The Pulse (utils/pulsePlatform).
 * The recap is the one format told to the viewer, so it may name the show.
 */
function CANON_RULES(format) {
  const inWorld = format !== 'recap';
  return [
    '- Lala does not know she was built, that she is in a show or a game, or that JustAWoman exists. Her world feels complete and real to her.',
    '- JustAWoman (the player and host) is outside Lala\'s world. Never put her, her life or her family in the story. The script\'s JustAWoman parts (the opening ritual, the login, her choices) are not scenes: Lala lives those choices as her own.',
    pulsePromptRules('lalaverse').trim(),
    inWorld
      ? '- Stay in the world: nothing about a show, an episode, a game, filming, a player or a studio.'
      : '- This recap speaks to the viewer, so it may name the show and the episode; it still never says Lala knows she is in one.',
    format === 'short_story'
      ? '- At the event, give one vivid moment that leaves a question hanging (who, what, why) before the story answers it. A short animated piece of it plays in the episode at beat 11 (The Event).'
      : '',
  ].filter(Boolean).join('\n');
}

/**
 * Generate a prose story from an episode.
 */
/**
 * The episode's people: the event's host and guests, each with the registry
 * character linked to their feed profile (ruling C3, utils/registryLink),
 * its story-brief columns and char_id. [] when there is no event or none.
 */
async function episodeCast(sequelize, event) {
  let characters = [];
  try {
    let cc = event?.canon_consequences;
    if (typeof cc === 'string') try { cc = JSON.parse(cc); } catch { cc = {}; }
    const auto = cc?.automation || {};
    // g.id is the pre-fix shape a guest written by the opportunity
    // pipeline may still carry (Task #1686, docs/GUEST_OWNERSHIP_READ.md
    // §6) — g.profile_id is preferred, g.id is the fallback.
    const profileIds = [eventCreatorOrganizer(event)?.profileId, ...(auto.guest_profiles || []).map(g => g.profile_id || g.id)].filter(Boolean);
    if (profileIds.length > 0) {
      // The newest registry entry should two be linked. The join on
      // sp.registry_character_id compared an integer to a UUID and failed.
      const [rows] = await sequelize.query(
        `SELECT sp.handle, sp.display_name, sp.creator_name, sp.archetype, sp.posting_voice,
                rc.id as char_id, rc.display_name as char_name, rc.core_belief, rc.role_type, rc.depth_level,
                rc.personality, rc.pressure_type, rc.therapy_primary_defense,
                rc.signature_trait, rc.character_archetype,
                ${BRIEF_COLUMNS.map((col) => `rc.${col}`).join(', ')}
         FROM social_profiles sp
         ${LINKED_CHARACTER_JOIN}
         WHERE sp.id IN (:ids) AND sp.deleted_at IS NULL`,
        { replacements: { ids: profileIds } }
      );
      characters = rows || [];
    }
  } catch (err) {
    console.error('[StoryGeneration] the episode cast could not be read (non-blocking):', err.message);
  }
  return characters;
}

async function generateEpisodeStory(episodeId, showId, sequelize, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const format = options.format || 'short_story';
  const povCharacter = options.povCharacter || 'lala';
  const spec = FORMAT_SPECS[format] || FORMAT_SPECS.short_story;

  // Load episode
  const [episode] = await sequelize.query(
    `SELECT id, title, description, episode_number, script_content, evaluation_json, total_income, total_expenses
     FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!episode) throw new Error('Episode not found');

  // Load the episode's event (utils/episodeEventSql; Task #1917)
  const [event] = await sequelize.query(
    `SELECT name, event_type, host, host_brand, prestige, dress_code, venue_name,
            narrative_stakes, outfit_pieces, canon_consequences, source_profile_id
     FROM world_events WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  // Parse data
  let outfitPieces = event?.outfit_pieces;
  if (typeof outfitPieces === 'string') try { outfitPieces = JSON.parse(outfitPieces); } catch { outfitPieces = []; }
  if (!Array.isArray(outfitPieces)) outfitPieces = [];

  let evalData = episode.evaluation_json;
  if (typeof evalData === 'string') try { evalData = JSON.parse(evalData); } catch { evalData = null; }

  const net = (parseFloat(episode.total_income) || 0) - (parseFloat(episode.total_expenses) || 0);

  // Load character profiles for this episode
  const characters = await episodeCast(sequelize, event);

  // What each is known for on The Pulse against their job: a hook for the
  // story (services/characterContentType; null when none).
  if (characters.length) {
    const db = require('../models');
    const { contentHookFor } = require('./characterContentType');
    await Promise.all(characters.map(async (c) => {
      if (!c.char_id) return;
      try {
        c.content_hook = await contentHookFor(db, await db.RegistryCharacter.findByPk(c.char_id));
      } catch (err) {
        console.error('[StoryGeneration] the content hook could not be read:', err.message);
      }
    }));
  }

  // Their kept secrets, for the brief's revelation budget (services/characterSecrets).
  const secretsByCharacter = await secretsFor(sequelize, characters.map((c) => c.char_id));
  // The season's reveal plan for this episode (services/seasonRevealPlan).
  const plan = await require('./seasonRevealPlan').planForEpisode(sequelize, episodeId);

  // The approved Episode Story Record: what the audience saw, which the
  // story goes beneath and never against (services/episodeStoryRecord).
  const record = await require('./episodeStoryRecord').recordBlock(sequelize, episodeId);

  // Build the prompt
  const scriptExcerpt = episode.script_content ? episode.script_content.slice(0, 4000) : 'No script available';
  const outfitText = outfitPieces.length > 0
    ? outfitPieces.map(p => `${p.name}${p.brand ? ` by ${p.brand}` : ''} (${p.tier || 'mid'})`).join(', ')
    : 'No outfit details';

  const charContext = characters.map(c => {
    let block = `${c.creator_name || c.display_name || c.handle} (@${c.handle})`;
    if (c.role_type) block += ` [${c.role_type}]`;
    if (c.depth_level) block += ` (depth: ${c.depth_level})`;
    if (c.core_belief) block += `\n    Believes: "${c.core_belief}"`;
    // What was happening beneath the episode (services/characterStoryBrief).
    const brief = storyBrief(c, { layer: 'short_story', secrets: require('./seasonRevealPlan').withPlan(secretsByCharacter.get(c.char_id), plan, 'short_story') });
    if (brief.lines.length) block += `\n    ${brief.lines.join('\n    ')}`;
    if (c.therapy_primary_defense) block += `\n    Defense mechanism: ${c.therapy_primary_defense}`;
    if (c.signature_trait) block += `\n    Signature trait: ${c.signature_trait}`;
    if (c.content_hook) block += `\n    ${c.content_hook}`;
    return block;
  }).join('\n\n') || 'No character details';

  const prompt = `You are writing a ${spec.name.toLowerCase()} based on an episode of "Styling Adventures with Lala" — a luxury fashion life simulator in the LalaVerse franchise (Mary-Kate & Ashley style).

FORMAT: ${spec.name}
WORD COUNT: ${spec.wordRange} words
TONE: ${spec.tone}
STRUCTURE: ${spec.structure}
POV: ${povCharacter === 'lala' ? 'Third-person limited, following Lala. We see the world through her eyes — her observations, anxieties, triumphs.' : `From the perspective of ${povCharacter}. Show how THEY see Lala and the event.`}

EPISODE: ${episode.title} (Episode ${episode.episode_number})
${episode.description ? `SYNOPSIS: ${episode.description}` : ''}

EVENT: ${event?.name || 'Unknown event'}
Host: ${event?.host || 'Unknown'} | Prestige: ${event?.prestige || 5}/10
Venue: ${event?.venue_name || 'Exclusive venue'}
Dress Code: ${event?.dress_code || 'Chic'}
${event?.narrative_stakes ? `STAKES: ${event.narrative_stakes}` : ''}

OUTFIT: ${outfitText}

CHARACTERS:
${charContext}

${evalData ? `OUTCOME: ${evalData.tier_final?.toUpperCase()} (${evalData.score}/100) — ${evalData.narrative_lines?.short || ''}` : ''}
${net !== 0 ? `FINANCIAL: ${net >= 0 ? '+' : ''}${net} coins net` : ''}

${record ? `${record}\n\n` : ''}${format === 'short_story' ? 'CANON: go beneath the episode, never against it. Do not invent a major new event that contradicts what the episode showed; anything new you add is proposed to the author for canon, not canon yet.\n\n' : ''}SCRIPT EXCERPT:
${scriptExcerpt}

FRANCHISE RULES:
- Lala is the protagonist. She's ambitious, fashion-obsessed, financially aware, and navigating the creator economy.
${CANON_RULES(format)}
- The LalaVerse feels real but heightened — luxury fantasy grounded in real emotional stakes.
- Fashion choices have consequences. What you wear is strategy, not vanity.
- Every character has their own agenda. No one is purely good or evil.
- Money matters. Coin balance creates real tension.

Write the ${spec.name.toLowerCase()} now. Return ONLY the prose — no commentary, no headers, no word count notes.`;

  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const storyText = response.content?.[0]?.text || '';
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  const wordCount = storyText.split(/\s+/).filter(Boolean).length;

  // Save story
  const storyId = uuidv4();
  let saved = false;
  try {
    await sequelize.query(
      `INSERT INTO stories
       (id, show_id, episode_id, event_id, title, subtitle, content, summary, word_count,
        format, pov_character, pov_type, source_type, status,
        generation_model, generation_tokens, context_snapshot,
        tags, created_at, updated_at)
       VALUES (:id, :showId, :episodeId, :eventId, :title, :subtitle, :content, :summary, :wordCount,
        :format, :povCharacter, 'third_limited', 'episode', 'draft',
        'claude-sonnet-4-6', :tokens, :context,
        :tags, NOW(), NOW())`,
      { replacements: {
        id: storyId,
        showId: showId || null,
        episodeId,
        eventId: event?.id || null,
        title: `${episode.title}`,
        subtitle: spec.name,
        content: storyText,
        summary: storyText.slice(0, 300) + '...',
        wordCount,
        format,
        povCharacter,
        tokens,
        context: JSON.stringify({
          episode_title: episode.title,
          event_name: event?.name,
          outfit_pieces: outfitPieces.length,
          characters: characters.length,
          evaluation_tier: evalData?.tier_final,
          evaluation_score: evalData?.score,
        }),
        tags: JSON.stringify([format, evalData?.tier_final, event?.event_type].filter(Boolean)),
      }}
    );
    saved = true;
  } catch (err) {
    console.warn('[StoryGen] Save failed:', err.message);
  }

  // What a short story adds is proposed for canon, not canon (stage D,
  // services/storyCanon): read it now, unawaited; nothing blocks on it.
  if (saved && format === 'short_story') require('./storyCanon').reviewLater(sequelize, storyId);

  return {
    id: storyId,
    title: episode.title,
    format: spec.name,
    content: storyText,
    wordCount,
    povCharacter,
    tokens,
  };
}

/**
 * Get all stories for a show or episode.
 */
async function getStories(sequelize, options = {}) {
  const where = ['deleted_at IS NULL'];
  const replacements = {};

  if (options.showId) { where.push('show_id = :showId'); replacements.showId = options.showId; }
  if (options.episodeId) { where.push('episode_id = :episodeId'); replacements.episodeId = options.episodeId; }
  if (options.format) { where.push('format = :format'); replacements.format = options.format; }
  if (options.status) { where.push('status = :status'); replacements.status = options.status; }

  const [rows] = await sequelize.query(
    `SELECT id, show_id, episode_id, title, subtitle, word_count, format, pov_character,
            source_type, status, published_at, tags, created_at
     FROM stories WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT :limit`,
    { replacements: { ...replacements, limit: options.limit || 50 } }
  );

  return rows || [];
}

module.exports = {
  generateEpisodeStory,
  episodeCast,
  getStories,
  FORMAT_SPECS,
  CANON_RULES,
};
