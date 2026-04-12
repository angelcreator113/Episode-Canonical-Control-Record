'use strict';

/**
 * Distribution Service — Platform-Specific Content Generation
 *
 * Generates marketing descriptions, hashtags, and metadata for each platform
 * from REAL episode data: event, outfit, evaluation, social tasks, financials.
 *
 * Platform rules:
 *   YouTube:   100-char title, 5000-char description, 3-5 tags, SEO-heavy, timestamps
 *   TikTok:    150-char title, 2200-char caption, 4-8 hashtags, hook-first, trending
 *   Instagram: 2200-char caption, 20-30 hashtags, visual storytelling, emojis
 *   Facebook:  255-char title, unlimited description, 2-3 hashtags, conversational
 */

const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── PLATFORM SPECS ──────────────────────────────────────────────────────────

const PLATFORM_SPECS = {
  youtube: {
    name: 'YouTube',
    title_limit: 100,
    description_limit: 5000,
    hashtag_count: '3-5',
    hashtag_style: 'Mix of broad (#fashion, #grwm) and niche (#luxuryfashionchallenge). Place at end of description.',
    tone: 'Search-optimized. Curiosity gap title. Description has hook → context → timestamps → call to action. Think MrBeast meets fashion vlog.',
    format: 'Include timestamps for key moments (based on beats). Add "Subscribe" CTA. Mention playlist if series.',
  },
  tiktok: {
    name: 'TikTok',
    title_limit: 150,
    description_limit: 2200,
    hashtag_count: '4-8',
    hashtag_style: 'Trending + niche. Start with 2-3 trending (#fyp, #fashiontok), then niche (#luxurygrwm, #outfitcheck). No more than 8.',
    tone: 'Punchy, hook-first. First line must stop the scroll. Use line breaks. Emoji-forward. Gen-Z energy. "POV:" or "When..." format works.',
    format: 'Caption IS the hook. No timestamps. Keep it under 300 chars ideally. Hashtags at the end, not in the caption body.',
  },
  instagram: {
    name: 'Instagram Reels',
    title_limit: 0, // No separate title
    description_limit: 2200,
    hashtag_count: '20-30',
    hashtag_style: 'Three tiers: 10 broad (#fashion #ootd), 10 mid (#luxurystyle #eventoutfit), 10 niche (#lalaverse #stylingadventures). In first comment or end of caption.',
    tone: 'Visual storytelling. Emojis as section markers. Aspirational but personal. "The kind of night that changes everything ✨" energy.',
    format: 'Caption tells a mini-story. Use line breaks generously. Emoji bullets for outfit breakdown. Tag brands with @. Hashtags in separate block.',
  },
  facebook: {
    name: 'Facebook',
    title_limit: 255,
    description_limit: 63206,
    hashtag_count: '2-3',
    hashtag_style: 'Minimal. Only 2-3 broad hashtags. Facebook penalizes hashtag stuffing.',
    tone: 'Conversational, shareable. "You won\'t believe what happened at..." energy. Longer form storytelling OK. Ask questions to drive comments.',
    format: 'Story-first, then link. Ask a question at the end. Encourage sharing. Mention specific moments people can relate to.',
  },
};

// ─── GATHER EPISODE CONTEXT ──────────────────────────────────────────────────

async function gatherEpisodeContext(episodeId, showId, sequelize) {
  const ctx = {};

  // Episode
  const [episode] = await sequelize.query(
    `SELECT id, title, description, episode_number, air_date, categories, evaluation_json, total_income, total_expenses
     FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!episode) throw new Error('Episode not found');
  ctx.episode = episode;
  ctx.evaluation = episode.evaluation_json ? (typeof episode.evaluation_json === 'string' ? JSON.parse(episode.evaluation_json) : episode.evaluation_json) : null;

  // Show
  const [show] = await sequelize.query(
    `SELECT id, title, description, genre, distribution_defaults FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);
  ctx.show = show || {};
  ctx.showDefaults = show?.distribution_defaults ? (typeof show.distribution_defaults === 'string' ? JSON.parse(show.distribution_defaults) : show.distribution_defaults) : {};

  // Event
  const [event] = await sequelize.query(
    `SELECT name, event_type, host, host_brand, prestige, dress_code, venue_name, cost_coins, payment_amount, is_paid, narrative_stakes, outfit_pieces, outfit_score, canon_consequences
     FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);
  ctx.event = event || null;

  // Parse outfit
  if (event?.outfit_pieces) {
    ctx.outfitPieces = typeof event.outfit_pieces === 'string' ? JSON.parse(event.outfit_pieces) : event.outfit_pieces;
  } else {
    ctx.outfitPieces = [];
  }

  // Social tasks
  try {
    const [todoList] = await sequelize.query(
      `SELECT social_tasks, financial_summary FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    ctx.socialTasks = todoList?.social_tasks ? (typeof todoList.social_tasks === 'string' ? JSON.parse(todoList.social_tasks) : todoList.social_tasks) : [];
    ctx.financials = todoList?.financial_summary ? (typeof todoList.financial_summary === 'string' ? JSON.parse(todoList.financial_summary) : todoList.financial_summary) : null;
  } catch { ctx.socialTasks = []; ctx.financials = null; }

  // Arc context
  try {
    const [arc] = await sequelize.query(
      `SELECT name, current_phase, phase_title FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    ctx.arc = arc || null;
  } catch { ctx.arc = null; }

  return ctx;
}

// ─── BUILD CONTEXT STRING ────────────────────────────────────────────────────

function buildContextBlock(ctx) {
  const ep = ctx.episode;
  const ev = ctx.event;
  const eval_ = ctx.evaluation;
  const pieces = ctx.outfitPieces || [];
  const brands = [...new Set(pieces.map(p => p.brand).filter(Boolean))];
  const totalCost = pieces.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);
  const socialCompleted = (ctx.socialTasks || []).filter(t => t.completed).length;
  const socialTotal = (ctx.socialTasks || []).length;

  let block = `SHOW: "${ctx.show?.title || 'Styling Adventures with Lala'}"
Genre: ${ctx.show?.genre || 'reality/fashion'}
${ctx.arc ? `Season Arc: ${ctx.arc.name} — Phase: ${ctx.arc.phase_title || ctx.arc.current_phase}` : ''}

EPISODE: ${ep.title} (Episode ${ep.episode_number})
${ep.description ? `Synopsis: ${ep.description}` : ''}
${ep.air_date ? `Air Date: ${new Date(ep.air_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
${ep.categories?.length > 0 ? `Tags: ${(typeof ep.categories === 'string' ? JSON.parse(ep.categories) : ep.categories).join(', ')}` : ''}`;

  if (ev) {
    block += `\n\nEVENT: ${ev.name}
Type: ${ev.event_type} | Prestige: ${ev.prestige}/10
Host: ${ev.host || 'Unknown'}${ev.host_brand ? ` (${ev.host_brand})` : ''}
Venue: ${ev.venue_name || 'Exclusive venue'}
Dress Code: ${ev.dress_code || 'Chic'}
${ev.narrative_stakes ? `Stakes: ${ev.narrative_stakes}` : ''}
${ev.is_paid ? `💰 Paid event: $${ev.payment_amount}` : `Entry cost: ${ev.cost_coins} coins`}`;
  }

  if (pieces.length > 0) {
    block += `\n\nOUTFIT (${pieces.length} pieces, $${totalCost} total):
${pieces.map(p => `  - ${p.name}${p.brand ? ` by ${p.brand}` : ''} (${p.tier || 'mid'}, $${p.price || 0})`).join('\n')}
${brands.length > 0 ? `Brands: ${brands.join(', ')}` : ''}`;
  }

  if (eval_) {
    block += `\n\nEVALUATION: ${eval_.tier_final?.toUpperCase() || 'N/A'} (${eval_.score || 0}/100)
${eval_.narrative_lines?.short || ''}`;
  }

  if (socialTotal > 0) {
    block += `\nSocial Tasks: ${socialCompleted}/${socialTotal} completed`;
  }

  const netProfit = (parseFloat(ep.total_income) || 0) - (parseFloat(ep.total_expenses) || 0);
  if (ep.total_income || ep.total_expenses) {
    block += `\nFinancials: +$${ep.total_income || 0} income, -$${ep.total_expenses || 0} expenses = ${netProfit >= 0 ? '+' : ''}$${netProfit} net`;
  }

  return block;
}

// ─── GENERATE PLATFORM DESCRIPTIONS ──────────────────────────────────────────

async function generateDistribution(episodeId, showId, sequelize, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const ctx = await gatherEpisodeContext(episodeId, showId, sequelize);
  const contextBlock = buildContextBlock(ctx);

  // Get show-level defaults for hashtags
  const showDefaults = ctx.showDefaults || {};
  const platforms = options.platforms || ['youtube', 'tiktok', 'instagram', 'facebook'];

  const platformPrompts = platforms.map(p => {
    const spec = PLATFORM_SPECS[p];
    const defaults = showDefaults[p] || {};
    const defaultHashtags = defaults.default_hashtags || [];
    return `"${p}": {
  RULES:
  - ${spec.tone}
  - ${spec.format}
  - Title limit: ${spec.title_limit || 'N/A'} chars
  - Description/caption limit: ${spec.description_limit} chars
  - Hashtags: ${spec.hashtag_count} total. ${spec.hashtag_style}
  ${defaultHashtags.length > 0 ? `- Show-level hashtags (ALWAYS include): ${defaultHashtags.join(', ')}` : ''}
  ${defaults.default_description_template ? `- Template hint: ${defaults.default_description_template}` : ''}
}`;
  }).join('\n\n');

  const prompt = `You are a social media strategist writing platform-specific descriptions for an episode of a luxury fashion reality show.

${contextBlock}

Generate platform-specific content for each platform below. Every detail must come from the REAL data above — reference specific outfit pieces by name, mention actual brands, use the real event name, host, and venue. Nothing generic.

PLATFORMS:
${platformPrompts}

Return JSON:
{
  "youtube": {
    "title": "YouTube title (max 100 chars, curiosity gap)",
    "description": "Full YouTube description with hook, context, timestamps, CTA, hashtags at end",
    "hashtags": ["tag1", "tag2", "tag3"],
    "tags": ["searchable", "seo", "tags", "for", "youtube"]
  },
  "tiktok": {
    "title": "TikTok caption/title (max 150 chars, hook-first)",
    "description": "TikTok caption with hashtags at end",
    "hashtags": ["fyp", "fashiontok", "grwm", "ootd"]
  },
  "instagram": {
    "title": "",
    "description": "Instagram caption with emoji formatting, brand tags, story arc",
    "hashtags": ["fashion", "ootd", "luxurystyle", "reels"]
  },
  "facebook": {
    "title": "Facebook post title (max 255 chars)",
    "description": "Conversational Facebook post with question at end",
    "hashtags": ["fashion", "style"]
  }
}

Return ONLY the JSON. Every description must reference SPECIFIC data from above (outfit pieces, brands, event name, host, venue, tier result).`;

  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid JSON');

  const generated = JSON.parse(match[0]);

  // Build distribution_metadata structure
  const metadata = {};
  for (const platform of platforms) {
    const gen = generated[platform] || {};
    const defaults = showDefaults[platform] || {};
    metadata[platform] = {
      title: gen.title || '',
      description: gen.description || '',
      hashtags: gen.hashtags || [],
      tags: gen.tags || [],
      status: 'draft',
      scheduled_time: null,
      thumbnail_url: null,
      platform_url: null,
      generated_at: new Date().toISOString(),
      // Merge show-level defaults
      account_name: defaults.account_name || null,
      account_url: defaults.account_url || null,
    };
  }

  // Save to episode
  try {
    await sequelize.query(
      `UPDATE episodes SET distribution_metadata = :metadata, updated_at = NOW() WHERE id = :episodeId`,
      { replacements: { metadata: JSON.stringify(metadata), episodeId } }
    );
  } catch (err) {
    console.warn('[Distribution] Save failed (non-blocking):', err.message);
  }

  return {
    platforms: metadata,
    context_used: {
      event: ctx.event?.name || null,
      outfit_pieces: (ctx.outfitPieces || []).length,
      evaluation_tier: ctx.evaluation?.tier_final || null,
      social_tasks_completed: (ctx.socialTasks || []).filter(t => t.completed).length,
    },
  };
}

// ─── SAVE SHOW DISTRIBUTION DEFAULTS ─────────────────────────────────────────

async function saveShowDefaults(showId, defaults, sequelize) {
  await sequelize.query(
    `UPDATE shows SET distribution_defaults = :defaults, updated_at = NOW() WHERE id = :showId`,
    { replacements: { defaults: JSON.stringify(defaults), showId } }
  );
  return defaults;
}

module.exports = {
  PLATFORM_SPECS,
  gatherEpisodeContext,
  generateDistribution,
  saveShowDefaults,
};
