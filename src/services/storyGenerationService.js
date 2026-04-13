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

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const FORMAT_SPECS = {
  short_story: {
    name: 'Short Story',
    wordRange: '2000-3000',
    tone: 'Literary fiction. Cinematic prose. Fashion-forward but emotionally grounded. Think Candace Bushnell meets Instagram age.',
    structure: 'Opening hook → rising tension → climax at event → aftermath → final image. No chapters, continuous prose with scene breaks (***)',
  },
  social_fiction: {
    name: 'Social Fiction',
    wordRange: '800-1500',
    tone: 'Told entirely through social media artifacts: IG captions, DMs, story screenshots, comment threads, notifications. The story emerges from the digital breadcrumbs.',
    structure: 'Series of social media posts/messages. Each "post" is a self-contained moment. Use @handles, hashtags, likes/comments as storytelling devices.',
  },
  snippet: {
    name: 'Snippet',
    wordRange: '400-600',
    tone: 'Punchy, atmospheric. A single scene that captures the essence. Could be an IG caption, a TikTok voiceover, or a Substack teaser.',
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
 * Generate a prose story from an episode.
 */
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

  // Load event
  const [event] = await sequelize.query(
    `SELECT name, event_type, host, host_brand, prestige, dress_code, venue_name,
            narrative_stakes, outfit_pieces, canon_consequences
     FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
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
  let characters = [];
  try {
    let cc = event?.canon_consequences;
    if (typeof cc === 'string') try { cc = JSON.parse(cc); } catch { cc = {}; }
    const auto = cc?.automation || {};
    const profileIds = [auto.host_profile_id, ...(auto.guest_profiles || []).map(g => g.profile_id)].filter(Boolean);
    if (profileIds.length > 0) {
      const [rows] = await sequelize.query(
        `SELECT sp.handle, sp.display_name, sp.creator_name, sp.archetype, sp.posting_voice,
                rc.display_name as char_name, rc.core_belief, rc.role_type, rc.depth_level,
                rc.personality, rc.pressure_type,
                rc.core_wound, rc.core_desire, rc.core_fear,
                rc.mask_persona, rc.truth_persona, rc.therapy_primary_defense,
                rc.signature_trait, rc.character_archetype
         FROM social_profiles sp
         LEFT JOIN registry_characters rc ON rc.id = sp.registry_character_id
         WHERE sp.id IN (:ids) AND sp.deleted_at IS NULL`,
        { replacements: { ids: profileIds } }
      );
      characters = rows || [];
    }
  } catch { /* non-blocking */ }

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
    if (c.core_wound) block += `\n    Wound: "${c.core_wound}"`;
    if (c.core_desire) block += `\n    Desires: "${c.core_desire}"`;
    if (c.core_fear) block += `\n    Fears: "${c.core_fear}"`;
    if (c.mask_persona && c.truth_persona) block += `\n    Shows: ${c.mask_persona.slice(0, 50)} | Underneath: ${c.truth_persona.slice(0, 50)}`;
    if (c.therapy_primary_defense) block += `\n    Defense mechanism: ${c.therapy_primary_defense}`;
    if (c.signature_trait) block += `\n    Signature trait: ${c.signature_trait}`;
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

SCRIPT EXCERPT:
${scriptExcerpt}

FRANCHISE RULES:
- Lala is the protagonist. She's ambitious, fashion-obsessed, financially aware, and navigating the creator economy.
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
  } catch (err) {
    console.warn('[StoryGen] Save failed:', err.message);
  }

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
  getStories,
  FORMAT_SPECS,
};
